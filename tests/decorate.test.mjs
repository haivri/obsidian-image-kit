import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './_load.mjs';

const { window } = new JSDOM('<div class="markdown-source-view"><div class="image-embed" src="photo.jpg" alt="A caption|center|400"><img><div class="embed-actions"><div class="embed-action" aria-label="Zoom in"></div><div class="embed-action edit-block-button" aria-label="Edit this block"></div></div></div></div>');
globalThis.HTMLImageElement = window.HTMLImageElement;
window.HTMLElement.prototype.instanceOf = function (type) { return this instanceof type; };
window.HTMLElement.prototype.createEl = function (tag, options = {}) {
  const el = window.document.createElement(tag);
  el.className = options.cls ?? '';
  if (options.text) el.textContent = options.text;
  for (const [name, value] of Object.entries(options.attr ?? {})) el.setAttribute(name, value);
  this.append(el);
  return el;
};
const { decorate } = await loadModule('decorate');
const options = { grammar: {}, showCaptions: true, showEditButton: true };

test('adds the edit action between native actions without replacing their elements or handlers', () => {
  const embed = window.document.querySelector('.image-embed');
  const zoom = embed.querySelector('[aria-label="Zoom in"]');
  const source = embed.querySelector('.edit-block-button');
  let zoomClicks = 0;
  zoom.addEventListener('click', () => zoomClicks++);
  decorate(embed, options);
  decorate(embed, options);
  assert.deepEqual(Array.from(embed.querySelector('.embed-actions').children).map(el => el.getAttribute('aria-label')), ['Zoom in', 'Edit image', 'Edit this block']);
  assert.equal(embed.querySelector('.edit-block-button'), source);
  assert.equal(embed.querySelector('[aria-label="Zoom in"]'), zoom);
  assert.equal(embed.querySelectorAll('.ik-edit-btn').length, 1);
  assert.equal(embed.querySelector('.ik-edit-btn').tabIndex, 0);
  zoom.click();
  assert.equal(zoomClicks, 1);
  embed.setAttribute('alt', 'A caption|right|240');
  decorate(embed, options);
  assert.equal(embed.querySelectorAll('.ik-edit-btn').length, 1);
  assert.equal(embed.querySelector('.ik-caption').textContent, 'A caption');
  assert.equal(embed.querySelector('.edit-block-button'), source);
});

test('upgrades a Live Preview fallback when native controls become available', () => {
  const embed = window.document.createElement('span');
  embed.className = 'image-embed';
  embed.setAttribute('src', 'photo.jpg');
  embed.innerHTML = '<img>';
  window.document.querySelector('.markdown-source-view').append(embed);
  decorate(embed, options);
  assert.ok(embed.querySelector(':scope > .ik-edit-fallback'));
  const actions = window.document.createElement('div');
  actions.className = 'embed-actions';
  actions.innerHTML = '<div class="embed-action edit-block-button"></div>';
  embed.append(actions);
  decorate(embed, options);
  assert.equal(embed.querySelectorAll('.ik-edit-btn').length, 1);
  assert.ok(actions.firstElementChild.classList.contains('ik-edit-native'));
});

test('reading view removes editing controls while preserving captions, alignment, and native viewing', () => {
  const root = window.document.createElement('div');
  root.className = 'markdown-source-view';
  root.innerHTML = '<span class="image-embed" src="photo.jpg" alt="A caption|center|240"><img><div class="embed-actions"><button aria-label="Zoom in"></button></div></span>';
  window.document.body.append(root);
  const embed = root.querySelector('.image-embed');
  const zoom = embed.querySelector('[aria-label="Zoom in"]');
  decorate(embed, options);
  assert.ok(embed.querySelector('.ik-edit-btn'));
  root.className = 'markdown-reading-view';
  decorate(embed, options);
  assert.equal(embed.querySelector('.ik-edit-btn'), null);
  assert.equal(embed.querySelector('.ik-caption').textContent, 'A caption');
  assert.ok(embed.classList.contains('ik-align-center'));
  assert.equal(embed.querySelector('[aria-label="Zoom in"]'), zoom);
  // Reading view without a native strip must not receive a fallback button.
  embed.querySelector('.embed-actions').remove();
  decorate(embed, options);
  assert.equal(embed.querySelector('.ik-edit-btn'), null);
  root.className = 'markdown-source-view';
  decorate(embed, options);
  assert.ok(embed.querySelector('.ik-edit-fallback'));
  root.remove();
});

test('reading view decorates late-loaded images, repairs native replacements, and stops observing on unload', async () => {
  const { ReadingImages } = await loadModule('reading-view');
  globalThis.MutationObserver = window.MutationObserver;
  const frames = new Map(); let next = 0;
  window.requestAnimationFrame = callback => { frames.set(++next, callback); return next; };
  window.cancelAnimationFrame = id => frames.delete(id);
  const flush = async () => {
    await Promise.resolve();
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback());
  };
  const root = window.document.createElement('div');
  root.className = 'markdown-reading-view';
  root.innerHTML = '<span class="internal-embed" src="photo.jpg" alt="A caption|center|240"></span>';
  window.document.body.append(root);
  const embed = root.querySelector('.internal-embed');
  const child = new ReadingImages(root, () => decorate(embed, options));
  child.onload(); await flush();
  assert.equal(embed.querySelector('.ik-caption'), null);
  embed.classList.add('image-embed');
  embed.innerHTML = '<img width="240">';
  await flush();
  assert.equal(embed.querySelector('.ik-caption').textContent, 'A caption');
  assert.ok(embed.classList.contains('ik-align-center'));
  const draft = embed.querySelector('.ik-caption');
  draft.classList.add('ik-caption-editing');
  draft.textContent = 'Uncommitted caption';
  await flush();
  assert.equal(embed.querySelector('.ik-caption'), draft);
  assert.equal(draft.textContent, 'Uncommitted caption', 'observer must preserve active inline editing');
  // Native reloads can replace children without changing alt or the cache stamp.
  embed.innerHTML = '<img width="240">';
  await flush();
  assert.equal(embed.querySelectorAll('.ik-caption').length, 1);
  assert.equal(embed.querySelector('.ik-caption').textContent, 'A caption');
  await flush(); await flush();
  assert.equal(frames.size, 0, 'decoration must settle without an observer loop');
  embed.querySelector('img').dispatchEvent(new window.Event('load'));
  assert.equal(frames.size, 1, 'non-bubbling image loads schedule decoration');
  await flush();
  embed.querySelector('img').setAttribute('height', '160');
  await Promise.resolve();
  assert.equal(frames.size, 1, 'native height changes schedule decoration');
  child.unload();
  assert.equal(frames.size, 0, 'unload cancels pending decoration');
  embed.querySelector('img').dispatchEvent(new window.Event('load'));
  assert.equal(frames.size, 0, 'unload removes the capturing load listener');
  embed.setAttribute('alt', 'Changed|right|240');
  await flush();
  assert.equal(embed.querySelector('.ik-caption').textContent, 'A caption');
  root.remove();
});

test('desktop mouse hover opens editing once per entry without swallowing click or closing on leave', () => {
  const embed = window.document.createElement('span');
  embed.className = 'image-embed';
  embed.setAttribute('src', 'photo.jpg');
  embed.innerHTML = '<img>';
  window.document.querySelector('.markdown-source-view').append(embed);
  const opened = [];
  const hoverOptions = { ...options, onEditHover: container => opened.push(container) };
  decorate(embed, hoverOptions);
  decorate(embed, hoverOptions);
  const button = embed.querySelector('.ik-edit-btn');
  const enter = (pointerType, buttons = 0) => {
    const event = new window.Event('pointerenter');
    Object.assign(event, { pointerType, buttons });
    button.dispatchEvent(event);
  };
  enter('touch');
  enter('pen');
  enter('mouse', 1);
  assert.equal(opened.length, 0, 'touch, pen, and dragging must not open on hover');
  enter('mouse');
  assert.deepEqual(opened, [embed]);
  button.dispatchEvent(new window.Event('pointerleave'));
  assert.deepEqual(opened, [embed], 'leaving for the toolbar must not toggle editing');
  let clicks = 0;
  button.addEventListener('click', () => clicks++);
  button.click();
  assert.equal(clicks, 1, 'click remains available');
  embed.remove();
});

test('caption appearance updates without replacing an active draft or native controls', () => {
  const root = window.document.createElement('div');
  root.className = 'markdown-source-view';
  root.innerHTML = '<span class="image-embed" src="a.png" alt="Caption"><img></span>';
  window.document.body.append(root);
  const embed = root.firstElementChild;
  decorate(embed, options);
  const caption = embed.querySelector('.ik-caption');
  const edit = embed.querySelector('.ik-edit-btn');
  caption.classList.add('ik-caption-editing'); caption.textContent = 'Unsaved draft';
  decorate(embed, { ...options, captionAppearance: { captionStyle: 'normal', captionBold: true, captionStrikethrough: true, captionSize: 'large' } });
  assert.equal(embed.querySelector('.ik-caption'), caption);
  assert.equal(caption.textContent, 'Unsaved draft');
  assert.equal(embed.querySelector('.ik-edit-btn'), edit);
  assert.equal(embed.style.getPropertyValue('--ik-caption-style'), 'normal');
  assert.equal(embed.style.getPropertyValue('--ik-caption-weight'), 'var(--font-bold, 700)');
  assert.equal(embed.style.getPropertyValue('--ik-caption-decoration'), 'line-through');
  root.remove();
});

test('Reading SVG auto width survives loading and clears for native sizing, raster images, and Live Preview', () => {
  const root = window.document.createElement('div');
  root.className = 'markdown-reading-view';
  root.innerHTML = '<span class="image-embed" src="diagram.svg" alt="Odd Quarter-Wave Symmetry"><img></span>';
  window.document.body.append(root);
  const embed = root.firstElementChild;
  const img = embed.querySelector('img');
  decorate(embed, options);
  assert.ok(embed.classList.contains('ik-svg-auto'));
  assert.equal(embed.style.getPropertyValue('--ik-svg-width'), '300px');
  Object.defineProperty(img, 'naturalWidth', { value: 640, configurable: true });
  decorate(embed, options); // Same decoration key, image has now loaded.
  assert.equal(embed.style.getPropertyValue('--ik-svg-width'), '640px');
  for (const attribute of ['width', 'height']) {
    img.setAttribute(attribute, '200');
    decorate(embed, options);
    assert.equal(embed.classList.contains('ik-svg-auto'), false);
    assert.equal(embed.style.getPropertyValue('--ik-svg-width'), '');
    img.removeAttribute(attribute);
  }
  embed.setAttribute('alt', 'Caption|200');
  decorate(embed, options);
  assert.equal(embed.classList.contains('ik-svg-auto'), false);
  embed.setAttribute('alt', 'Caption');
  embed.setAttribute('src', 'diagram.png');
  decorate(embed, options);
  assert.equal(embed.classList.contains('ik-svg-auto'), false);
  embed.setAttribute('src', 'diagram.SVG?version=2');
  decorate(embed, options);
  assert.equal(embed.style.getPropertyValue('--ik-svg-width'), '640px');
  root.className = 'markdown-source-view';
  decorate(embed, options);
  assert.equal(embed.classList.contains('ik-svg-auto'), false);
  assert.equal(embed.style.getPropertyValue('--ik-svg-width'), '');
  root.remove();
});

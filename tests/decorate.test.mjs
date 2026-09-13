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
  child.unload();
  embed.setAttribute('alt', 'Changed|right|240');
  await flush();
  assert.equal(embed.querySelector('.ik-caption').textContent, 'A caption');
  root.remove();
});

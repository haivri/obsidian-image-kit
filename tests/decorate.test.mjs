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

test('upgrades a reading-view fallback when native controls become available', () => {
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

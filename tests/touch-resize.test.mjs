import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './_load.mjs';

const { TouchResize, widthFromDrag } = await loadModule('touch-resize');

test('diagonal resizing preserves proportions and bounds in both directions', () => {
  assert.equal(widthFromDrag(240, 120, 80, 40, 'end', 600), 320);
  assert.equal(widthFromDrag(240, 120, -80, -40, 'start', 600), 320);
  assert.equal(widthFromDrag(240, 120, 80, 40, 'start', 600), 160);
  assert.equal(widthFromDrag(240, 120, -900, -900, 'end', 600), 32);
  assert.equal(widthFromDrag(240, 120, 900, 900, 'end', 600), 600);
});

function fixture() {
  const dom = new JSDOM('<div class="cm-content"><div class="image-embed"><img width="240"></div></div>');
  const { window } = dom;
  globalThis.HTMLImageElement = window.HTMLImageElement;
  const proto = window.HTMLElement.prototype;
  proto.instanceOf = function(type) { return this instanceof type; };
  proto.createEl = function(tag) { return this.appendChild(window.document.createElement(tag)); };
  proto.setCssProps = function(props) { for (const [name, value] of Object.entries(props)) this.style.setProperty(name, value); };
  proto.setPointerCapture = function() { this.captured = true; };
  proto.hasPointerCapture = function() { return this.captured; };
  proto.releasePointerCapture = function() { this.captured = false; };
  const container = window.document.querySelector('.image-embed');
  const img = container.querySelector('img');
  img.getBoundingClientRect = () => {
    const width = parseFloat(img.style.width) || 240;
    return { left: 40, top: 100, width, height: width / 2, right: 40 + width, bottom: 100 + width / 2 };
  };
  window.document.querySelector('.cm-content').getBoundingClientRect = () => ({ width: 600 });
  let editable = true;
  const resize = new TouchResize(container, () => editable, () => {});
  const grips = [...window.document.querySelectorAll('.ik-resize-grip')];
  const fire = (index, type, x = 0, y = 0) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, button: 0, clientX: x, clientY: y });
    grips[index].dispatchEvent(event);
  };
  return { dom, img, resize, fire, lock: () => { editable = false; } };
}

test('dragging previews without rewriting the source width and cleanup restores the image', () => {
  const f = fixture();
  f.fire(1, 'pointerdown'); f.fire(1, 'pointermove', 80, 40); f.fire(1, 'pointerup', 80, 40);
  assert.equal(f.resize.pendingWidth, 320);
  assert.equal(f.img.style.width, '320px');
  assert.equal(f.img.getAttribute('width'), '240');
  f.resize.destroy();
  assert.equal(f.img.style.width, '');
  assert.equal(f.dom.window.document.querySelectorAll('.ik-resize-grip').length, 0);
  f.dom.window.close();
});

test('canceling a later gesture restores the previous pending preview', () => {
  const f = fixture();
  f.fire(0, 'pointerdown'); f.fire(0, 'pointermove', -80, -40); f.fire(0, 'pointerup');
  f.fire(1, 'pointerdown'); f.fire(1, 'pointermove', 80, 40); f.fire(1, 'pointercancel');
  assert.equal(f.resize.pendingWidth, 320);
  assert.equal(f.img.style.width, '320px');
  f.resize.destroy(); f.dom.window.close();
});

test('locking before or during a gesture prevents an editable preview', () => {
  const f = fixture();
  f.fire(1, 'pointerdown'); f.fire(1, 'pointermove', 80, 40);
  f.lock(); f.fire(1, 'pointerup');
  assert.equal(f.resize.pendingWidth, undefined);
  assert.equal(f.img.style.width, '');
  f.fire(1, 'pointerdown'); f.fire(1, 'pointermove', 80, 40);
  assert.equal(f.resize.pendingWidth, undefined);
  f.resize.destroy(); f.dom.window.close();
});

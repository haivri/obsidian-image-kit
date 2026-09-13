import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './_load.mjs';

const { followVisibleViewport } = await loadModule('modal-viewport');

test('dialog follows keyboard resize, viewport panning, and rotation and releases listeners on close', () => {
  const dom = new JSDOM('<div></div>');
  const win = dom.window;
  const viewport = Object.assign(new win.EventTarget(), { offsetTop: 0, offsetLeft: 0, width: 390, height: 844 });
  Object.defineProperty(win, 'visualViewport', { value: viewport });
  const frames = new Map(); let next = 0;
  win.requestAnimationFrame = cb => { frames.set(++next, cb); return next; };
  win.cancelAnimationFrame = id => frames.delete(id);
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb()); };
  const el = win.document.querySelector('div');
  const stop = followVisibleViewport(el);
  assert.equal(el.style.getPropertyValue('--ik-dialog-height'), '844px');
  viewport.height = 430; viewport.offsetTop = 90;
  viewport.dispatchEvent(new win.Event('resize'));
  viewport.dispatchEvent(new win.Event('scroll'));
  assert.equal(frames.size, 1);
  flush();
  assert.equal(el.style.getPropertyValue('--ik-dialog-height'), '430px');
  assert.equal(el.style.getPropertyValue('--ik-dialog-top'), '90px');
  viewport.width = 844; viewport.height = 230; viewport.offsetTop = 0;
  win.dispatchEvent(new win.Event('resize')); flush();
  assert.equal(el.style.getPropertyValue('--ik-dialog-width'), '844px');
  assert.equal(el.style.getPropertyValue('--ik-dialog-height'), '230px');
  viewport.height = 390; viewport.dispatchEvent(new win.Event('resize'));
  stop(); flush();
  viewport.dispatchEvent(new win.Event('scroll'));
  assert.equal(frames.size, 0);
  assert.equal(el.style.getPropertyValue('--ik-dialog-height'), '230px');
  dom.window.close();
});

test('dialog falls back to the window dimensions without VisualViewport', () => {
  const dom = new JSDOM('<div></div>');
  const el = dom.window.document.querySelector('div');
  const stop = followVisibleViewport(el);
  assert.equal(el.style.getPropertyValue('--ik-dialog-height'), `${dom.window.innerHeight}px`);
  stop(); dom.window.close();
});

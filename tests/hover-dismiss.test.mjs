import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './_load.mjs';

const { HoverDismiss } = await loadModule('hover-dismiss');
function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { window } = new JSDOM('<button id="edit"></button><div id="toolbar"><input><button id="more"></button></div><div id="outside"></div>');
  t.mock.method(window, 'setTimeout', (callback, ms) => setTimeout(callback, ms));
  t.mock.method(window, 'clearTimeout', timer => clearTimeout(timer));
  const doc = window.document;
  const button = doc.querySelector('#edit');
  const toolbar = doc.querySelector('#toolbar');
  const outside = doc.querySelector('#outside');
  let closed = 0;
  const hover = new HoverDismiss(doc, target => target instanceof window.Node && (button.contains(target) || toolbar.contains(target)), () => closed++);
  t.after(() => { hover.stop(); window.close(); });
  const event = (target, type, relatedTarget = null, pointerType = 'mouse') => {
    const e = new window.Event(type, { bubbles: true });
    Object.assign(e, { relatedTarget, pointerType });
    target.dispatchEvent(e);
  };
  return { button, toolbar, outside, hover, event, closed: () => closed, tick: ms => t.mock.timers.tick(ms) };
}

test('crossing the gap within 300ms keeps the menu open; leaving it dismisses once', t => {
  const f = fixture(t);
  f.event(f.button, 'pointerout', f.outside);
  f.tick(200);
  assert.equal(f.closed(), 0);
  f.event(f.toolbar, 'pointerover', f.outside);
  f.tick(500);
  assert.equal(f.closed(), 0);
  f.event(f.toolbar, 'pointerout', f.outside);
  f.tick(299);
  assert.equal(f.closed(), 0);
  f.tick(1);
  assert.equal(f.closed(), 1);
  f.tick(1000);
  assert.equal(f.closed(), 1);
});

test('moving between controls, back to the button, or reentering cancels dismissal', t => {
  const f = fixture(t);
  f.event(f.button, 'pointerout', f.toolbar);
  f.event(f.toolbar, 'pointerout', f.toolbar.querySelector('input'));
  f.tick(500);
  assert.equal(f.closed(), 0);
  f.event(f.toolbar, 'pointerout', f.outside);
  f.tick(200);
  f.event(f.button, 'pointerover', f.outside);
  f.tick(500);
  assert.equal(f.closed(), 0);
});

for (const interaction of ['button click', 'width focus', 'More actions']) {
  test(`${interaction} pins the menu and cancels a pending close`, t => {
    const f = fixture(t);
    f.event(f.button, 'pointerout', f.outside);
    const target = interaction === 'button click' ? f.button : f.toolbar.querySelector(interaction === 'width focus' ? 'input' : 'button');
    f.event(target, interaction === 'width focus' ? 'focusin' : 'pointerdown');
    f.event(target, 'pointerout', f.outside);
    f.tick(500);
    assert.equal(f.closed(), 0);
  });
}

test('touch and pen exits do not dismiss; cleanup cancels a pending timer', t => {
  const f = fixture(t);
  for (const type of ['touch', 'pen']) f.event(f.button, 'pointerout', f.outside, type);
  f.tick(500);
  assert.equal(f.closed(), 0);
  f.event(f.button, 'pointerout');
  f.hover.stop();
  f.tick(500);
  assert.equal(f.closed(), 0);
});

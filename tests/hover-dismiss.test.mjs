import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './_load.mjs';

const { HoverDismiss, inHoverArea } = await loadModule('hover-dismiss');
function fixture(t, pointInside) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { window } = new JSDOM('<button id="edit"></button><div id="toolbar"><input><button id="more"></button></div><div id="outside"></div>');
  t.mock.method(window, 'setTimeout', (callback, ms) => setTimeout(callback, ms));
  t.mock.method(window, 'clearTimeout', timer => clearTimeout(timer));
  const doc = window.document;
  const button = doc.querySelector('#edit');
  const toolbar = doc.querySelector('#toolbar');
  const outside = doc.querySelector('#outside');
  let closed = 0;
  const hover = new HoverDismiss(doc, target => target instanceof window.Node && (button.contains(target) || toolbar.contains(target)), () => closed++, pointInside);
  t.after(() => { hover.stop(); window.close(); });
  const event = (target, type, relatedTarget = null, pointerType = 'mouse', point = {}) => {
    const e = new window.Event(type, { bubbles: true });
    Object.assign(e, { relatedTarget, pointerType, ...point });
    target.dispatchEvent(e);
  };
  return { button, toolbar, outside, hover, event, closed: () => closed, tick: ms => t.mock.timers.tick(ms) };
}

test('crossing the gap within 700ms keeps the menu open; leaving it dismisses once', t => {
  const f = fixture(t);
  f.event(f.button, 'pointerout', f.outside);
  f.tick(200);
  assert.equal(f.closed(), 0);
  f.event(f.toolbar, 'pointerover', f.outside);
  f.tick(900);
  assert.equal(f.closed(), 0);
  f.event(f.toolbar, 'pointerout', f.outside);
  f.tick(699);
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
  f.tick(900);
  assert.equal(f.closed(), 0);
  f.event(f.toolbar, 'pointerout', f.outside);
  f.tick(200);
  f.event(f.button, 'pointerover', f.outside);
  f.tick(900);
  assert.equal(f.closed(), 0);
});

for (const interaction of ['button click', 'button focus']) {
  test(`${interaction} does not permanently pin the menu`, t => {
    const f = fixture(t);
    f.event(f.button, 'pointerout', f.outside);
    const target = interaction === 'button click' ? f.button : f.toolbar.querySelector('button');
    f.event(target, interaction === 'button focus' ? 'focusin' : 'pointerdown');
    f.event(target, 'pointerout', f.outside);
    f.tick(900);
    assert.equal(f.closed(), 1);
  });
}

test('touch and pen exits do not dismiss; cleanup cancels a pending timer', t => {
  const f = fixture(t);
  for (const type of ['touch', 'pen']) f.event(f.button, 'pointerout', f.outside, type);
  f.tick(900);
  assert.equal(f.closed(), 0);
  f.event(f.button, 'pointerout');
  f.hover.stop();
  f.tick(900);
  assert.equal(f.closed(), 0);
});


const areaElements = [
  { getBoundingClientRect: () => ({ left: 100, right: 900, top: 300, bottom: 900, width: 800, height: 600 }) },
  { getBoundingClientRect: () => ({ left: 100, right: 600, top: 242, bottom: 292, width: 500, height: 50 }) }
];

test('only actual bounds and short overlapping vertical gaps count as inside', () => {
  for (const [x, y] of [[850, 800], [300, 250], [300, 296]]) assert.equal(inHoverArea(x, y, areaElements), true);
  for (const [x, y] of [[901, 800], [300, 99], [99, 225], [300, 901], [700, 250], [700, 296]]) assert.equal(inHoverArea(x, y, areaElements), false);
  const distant = { getBoundingClientRect: () => ({ left: 100, right: 600, top: 100, bottom: 150, width: 500, height: 50 }) };
  assert.equal(inHoverArea(300, 225, [areaElements[0], distant]), false);
  assert.equal(inHoverArea(0, 0, []), false);
});

test('crossing or resting in the gap stays open; outside movement does not postpone closing', t => {
  const f = fixture(t, (x, y) => inHoverArea(x, y, areaElements));
  const move = (x, y) => f.event(f.outside, 'pointermove', null, 'mouse', { clientX: x, clientY: y });
  f.event(f.button, 'pointerout', f.outside, 'mouse', { clientX: 300, clientY: 296 });
  move(300, 296); f.tick(1500);
  assert.equal(f.closed(), 0);
  move(850, 800); f.tick(1500);
  assert.equal(f.closed(), 0);
  move(1000, 800); f.tick(400);
  move(1100, 800); f.tick(299);
  assert.equal(f.closed(), 0);
  f.tick(1); assert.equal(f.closed(), 1);
});

test('returning to the gap cancels closing and a later exit gets the full 700ms', t => {
  const f = fixture(t, (x, y) => inHoverArea(x, y, areaElements));
  const move = (x, y) => f.event(f.outside, 'pointermove', null, 'mouse', { clientX: x, clientY: y });
  move(1000, 800); f.tick(600);
  move(300, 296); f.tick(1000);
  assert.equal(f.closed(), 0);
  move(1000, 800); f.tick(699);
  assert.equal(f.closed(), 0);
  f.tick(1); assert.equal(f.closed(), 1);
});

test('leaving the window from the connecting gap still dismisses', t => {
  const f = fixture(t, (x, y) => inHoverArea(x, y, areaElements));
  f.event(f.outside, 'pointermove', null, 'mouse', { clientX: 300, clientY: 296 });
  f.event(f.outside, 'pointerout', null, 'mouse', { clientX: 300, clientY: 296 });
  f.tick(700);
  assert.equal(f.closed(), 1);
});

test('exiting below the menu into empty space closes even without further movement', t => {
  const f = fixture(t, (x, y) => inHoverArea(x, y, areaElements));
  f.event(f.toolbar, 'pointerout', f.outside, 'mouse', { clientX: 700, clientY: 296 });
  f.tick(699);
  assert.equal(f.closed(), 0);
  f.tick(1);
  assert.equal(f.closed(), 1);
});

test('repeated outside boundary events do not restart the closing delay', t => {
  const f = fixture(t);
  f.event(f.toolbar, 'pointerout', f.outside);
  f.tick(400);
  f.event(f.outside, 'pointerout');
  f.tick(300);
  assert.equal(f.closed(), 1);
});

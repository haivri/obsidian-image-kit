import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './_load.mjs';

const { HoverOpen } = await loadModule('hover-open');

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { window } = new JSDOM('<button><span></span></button>');
  globalThis.Node = window.Node;
  globalThis.MutationObserver = window.MutationObserver;
  t.mock.method(window, 'setTimeout', (fn, ms) => setTimeout(fn, ms));
  t.mock.method(window, 'clearTimeout', id => clearTimeout(id));
  const button = window.document.querySelector('button');
  const hover = new HoverOpen();
  let opened = 0;
  const enter = () => hover.schedule(button, () => opened++);
  t.after(() => { hover.cancel(); window.close(); });
  return { window, button, hover, enter, opened: () => opened, tick: ms => t.mock.timers.tick(ms) };
}

test('continuous hover opens once at 350ms; a flyby cancels and reentry starts fresh', t => {
  const f = fixture(t);
  f.enter(); f.tick(200);
  f.button.dispatchEvent(new f.window.Event('pointerleave'));
  f.tick(500); assert.equal(f.opened(), 0);
  f.enter(); f.tick(349); assert.equal(f.opened(), 0);
  f.tick(1); assert.equal(f.opened(), 1);
  f.tick(1000); assert.equal(f.opened(), 1);
});

for (const type of ['pointerdown', 'pointercancel', 'click', 'blur']) {
  test(`${type} cancels pending hover opening`, t => {
    const f = fixture(t);
    f.enter(); f.tick(100);
    (type === 'blur' ? f.window : f.button).dispatchEvent(new f.window.Event(type, { bubbles: true }));
    f.tick(500); assert.equal(f.opened(), 0);
  });
}

test('moving within the edit button keeps the pending hover; leaving it cancels', t => {
  const f = fixture(t);
  const out = relatedTarget => {
    const event = new f.window.Event('pointerout', { bubbles: true });
    Object.assign(event, { relatedTarget });
    f.button.dispatchEvent(event);
  };
  f.enter(); out(f.button.firstElementChild); f.tick(350);
  assert.equal(f.opened(), 1);
  f.enter(); out(f.window.document.body); f.tick(350);
  assert.equal(f.opened(), 1);
});

test('removal cancels even if reattached later, and disposal blocks stale opening', async t => {
  const f = fixture(t);
  f.enter(); f.button.remove();
  await Promise.resolve();
  f.window.document.body.append(f.button);
  f.tick(350); assert.equal(f.opened(), 0);
  f.enter(); f.hover.cancel(); f.tick(350); assert.equal(f.opened(), 0);
  f.enter(); f.button.remove(); f.tick(350); assert.equal(f.opened(), 0);
});

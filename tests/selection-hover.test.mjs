import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './_load.mjs';
const { EditSession } = await loadModule('edit-session');

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { window } = new JSDOM('<div id="image"><button class="ik-edit-btn"></button></div><div id="toolbar"><input><button></button></div>');
  globalThis.Node = window.Node;
  t.mock.method(window, 'setTimeout', (fn, ms) => setTimeout(fn, ms));
  t.mock.method(window, 'clearTimeout', id => clearTimeout(id));
  const toolbar = window.document.querySelector('#toolbar');
  let inside = true;
  t.mock.method(toolbar, 'matches', selector => selector === ':hover' && inside);
  const s = Object.assign(Object.create(EditSession.prototype), {
    plugin: { settings: { openImageControls: 'hover' } },
    container: window.document.querySelector('#image'), toolbar,
    widthInput: toolbar.querySelector('input'), hoverDismiss: null,
    closed: false, busy: false, captionEditor: null, captionSheet: null, moreMenu: null,
    close() { this.closed = true; this.pin(); }
  });
  const leave = () => {
    inside = false;
    const e = new window.Event('pointerout', { bubbles: true });
    Object.assign(e, { pointerType: 'mouse', relatedTarget: window.document.body });
    toolbar.dispatchEvent(e);
  };
  t.after(() => { s.pin(); window.close(); });
  return { s, window, leave, tick: ms => t.mock.timers.tick(ms) };
}

test('a completed selection unpins hover mode and mouse-out closes after the delay', t => {
  const f = fixture(t);
  f.s.enableHoverDismiss();
  f.s.pin();
  f.s.resumeHoverAfterSelection();
  f.leave(); f.tick(299);
  assert.equal(f.s.closed, false);
  f.tick(1);
  assert.equal(f.s.closed, true);
});

test('selection finishing after mouse-out still dismisses without a second mouse event', t => {
  const f = fixture(t);
  f.s.pin(); f.s.busy = true;
  f.leave(); f.s.resumeHoverAfterSelection(); f.tick(400);
  assert.equal(f.s.closed, false);
  f.s.busy = false; f.s.resumeHoverAfterSelection(); f.tick(300);
  assert.equal(f.s.closed, true);
});

test('click-only, caption editing, width editing, and an open More menu remain protected', t => {
  const f = fixture(t);
  f.s.plugin.settings.openImageControls = 'click';
  f.s.resumeHoverAfterSelection(); assert.equal(f.s.hoverDismiss, null);
  f.s.plugin.settings.openImageControls = 'hover';
  for (const field of ['captionEditor', 'captionSheet', 'moreMenu']) {
    f.s[field] = {};
    f.s.resumeHoverAfterSelection(); assert.equal(f.s.hoverDismiss, null);
    f.s[field] = null;
  }
  f.s.widthInput.focus();
  f.s.resumeHoverAfterSelection(); assert.equal(f.s.hoverDismiss, null);
  f.s.widthInput.blur();
  f.s.resumeHoverAfterSelection(); assert.ok(f.s.hoverDismiss);
});

test('repeated selections replace old listeners and timers instead of closing prematurely', t => {
  const f = fixture(t);
  f.leave(); f.s.resumeHoverAfterSelection(); f.tick(200);
  f.s.resumeHoverAfterSelection(); f.tick(200);
  assert.equal(f.s.closed, false);
  f.tick(100);
  assert.equal(f.s.closed, true);
});

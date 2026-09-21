import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './_load.mjs';
const { SessionDismiss, modalIsOpen } = await loadModule('session-dismiss');

function fixture(t) {
  const { window } = new JSDOM('<div id="controls"><button></button><div class="menu"><button></button></div></div><button id="outside"></button>');
  globalThis.MutationObserver = window.MutationObserver;
  const doc = window.document;
  const controls = doc.querySelector('#controls');
  let closes = 0;
  const dismiss = new SessionDismiss(doc, target => target instanceof window.Node && controls.contains(target), () => { closes++; dismiss.stop(); });
  t.after(() => { dismiss.stop(); window.close(); });
  return { window, doc, dismiss, closes: () => closes, click: (target, type = 'click') => target.dispatchEvent(new window.Event(type, { bubbles: true })) };
}

test('inside controls and the owned menu stay open; an outside click without pointerdown closes', t => {
  const f = fixture(t);
  f.click(f.doc.querySelector('#controls button'));
  f.click(f.doc.querySelector('.menu button'), 'pointerdown');
  assert.equal(f.closes(), 0);
  f.click(f.doc.querySelector('#outside'));
  assert.equal(f.closes(), 1);
  f.click(f.doc.querySelector('#outside'), 'pointerdown');
  assert.equal(f.closes(), 1, 'cleanup prevents duplicate closes');
});

test('unrelated menus and settings are outside the controls', t => {
  const f = fixture(t);
  const other = f.doc.createElement('div');
  other.className = 'menu';
  f.doc.body.append(other);
  f.click(other, 'pointerdown');
  assert.equal(f.closes(), 1);
});

test('opening settings without a pointer event closes once and blocks hover until dismissed', async t => {
  const f = fixture(t);
  assert.equal(modalIsOpen(f.doc), false);
  const modal = f.doc.createElement('div');
  modal.className = 'modal-container';
  f.doc.body.append(modal);
  await Promise.resolve();
  assert.equal(f.closes(), 1);
  assert.equal(modalIsOpen(f.doc), true);
  modal.append(f.doc.createElement('div'));
  await Promise.resolve();
  assert.equal(f.closes(), 1);
  modal.remove();
  assert.equal(modalIsOpen(f.doc), false);
});

test('unload disconnects modal observation and outside listeners', async t => {
  const f = fixture(t);
  f.dismiss.stop();
  f.click(f.doc.querySelector('#outside'));
  const modal = f.doc.createElement('div');
  modal.className = 'modal-container';
  f.doc.body.append(modal);
  await Promise.resolve();
  assert.equal(f.closes(), 0);
});

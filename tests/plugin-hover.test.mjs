import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { loadModule } from './_load.mjs';

const { default: ImageKitPlugin } = await loadModule('main');

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { window } = new JSDOM('<div class="markdown-source-view"><div class="image-embed" src="photo.jpg"><img></div></div>');
  for (const key of ['Node', 'Element', 'HTMLElement', 'HTMLImageElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'MutationObserver']) globalThis[key] = window[key];
  globalThis.document = window.document;
  globalThis.window = window;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  window.HTMLElement.prototype.instanceOf = function (type) { return this instanceof type; };
  window.HTMLElement.prototype.createEl = function (tag, options = {}) {
    const el = window.document.createElement(tag);
    el.className = options.cls ?? '';
    if (options.text) el.textContent = options.text;
    for (const [name, value] of Object.entries(options.attr ?? {})) el.setAttribute(name, value);
    this.append(el);
    return el;
  };
  window.HTMLElement.prototype.createDiv = function (options) { return this.createEl('div', options); };
  window.HTMLElement.prototype.createSpan = function (options) { return this.createEl('span', options); };
  window.HTMLElement.prototype.setText = function (text) { this.textContent = text; };
  window.HTMLElement.prototype.addClass = function (cls) { this.classList.add(cls); };
  window.HTMLElement.prototype.removeClass = function (cls) { this.classList.remove(cls); };
  t.mock.method(window, 'setTimeout', (fn, ms) => setTimeout(fn, ms));
  t.mock.method(window, 'clearTimeout', id => clearTimeout(id));
  t.mock.method(window.document, 'hasFocus', () => true);
  const plugin = new ImageKitPlugin();
  plugin.app = { workspace: { on() {}, offref() {} } };
  plugin.resolver = { resolve: () => ({ sourcePath: 'note.md', link: { path: 'photo.jpg', form: 'wiki', raw: '![[photo.jpg]]' } }) };
  plugin.settings = { ...plugin.settings, openImageControls: 'hover' };
  const container = window.document.querySelector('.image-embed');
  plugin.decorateRoot(container);
  const button = container.querySelector('.ik-edit-btn');
  const enter = () => {
    const event = new window.Event('pointerenter');
    Object.assign(event, { pointerType: 'mouse', buttons: 0 });
    button.dispatchEvent(event);
  };
  t.after(() => { plugin.hoverOpen.cancel(); plugin.session?.close?.(false); window.close(); });
  return { plugin, window, container, button, enter, tick: ms => t.mock.timers.tick(ms) };
}

test('decorated button delays opening and clicks call the immediate session path', t => {
  const f = fixture(t);
  let opened = 0;
  t.mock.method(f.plugin, 'openSession', container => {
    assert.equal(container, f.container);
    f.plugin.hoverOpen.cancel();
    opened++;
  });
  f.enter(); f.tick(349); assert.equal(opened, 0);
  f.tick(1); assert.equal(opened, 1);
  f.enter(); f.tick(100);
  const event = new f.window.MouseEvent('click');
  Object.defineProperty(event, 'target', { value: f.button });
  f.plugin.onClick(event);
  assert.equal(opened, 2);
  f.tick(500); assert.equal(opened, 2);
});

for (const blocker of ['settings', 'modal', 'menu', 'blur', 'session', 'unload']) {
  test(`pending opening rechecks eligibility after ${blocker}`, t => {
    const f = fixture(t);
    let opened = 0;
    t.mock.method(f.plugin, 'openSession', () => opened++);
    f.enter(); f.tick(100);
    if (blocker === 'settings') f.plugin.settings.openImageControls = 'click';
    if (blocker === 'modal' || blocker === 'menu') {
      const el = f.window.document.createElement('div');
      el.className = blocker === 'modal' ? 'modal-container' : 'menu';
      f.window.document.body.append(el);
    }
    if (blocker === 'blur') t.mock.method(f.window.document, 'hasFocus', () => false);
    if (blocker === 'session') f.plugin.session = {};
    if (blocker === 'unload') f.plugin.onunload();
    f.tick(500); assert.equal(opened, 0);
  });
}

test('clicking the current image does not pin its existing session', t => {
  const f = fixture(t);
  f.container.classList.add('ik-editing');
  let pinned = 0;
  f.plugin.session = { pin: () => pinned++ };
  f.enter();
  f.plugin.openSession(f.container);
  f.tick(500);
  assert.equal(pinned, 0);
});

for (const method of ['hover', 'click']) {
  test(`${method}-opened controls dismiss after leaving, while width editing stays protected`, t => {
    const f = fixture(t);
    if (method === 'hover') { f.enter(); f.tick(350); }
    else f.plugin.openSession(f.container);
    const session = f.plugin.session;
    assert.ok(session?.hoverDismiss);
    const leave = () => {
      const event = new f.window.Event('pointermove', { bubbles: true });
      Object.assign(event, { pointerType: 'mouse', clientX: 1000, clientY: 1000 });
      f.window.document.body.dispatchEvent(event);
    };
    session.widthInput.focus();
    leave(); f.tick(1000);
    assert.equal(session.closed, false);
    session.widthInput.blur();
    f.tick(699); assert.equal(session.closed, false);
    f.tick(1); assert.equal(session.closed, true);
    assert.equal(f.plugin.session, null);
  });
}

for (const finish of ['Enter', 'Escape', 'blur']) {
  test(`unchanged caption finished with ${finish} resumes dismissal`, t => {
    const f = fixture(t);
    f.plugin.openSession(f.container);
    const session = f.plugin.session;
    session.editCaption();
    const editor = session.captionEditor;
    assert.equal(session.hoverDismiss, null);
    if (finish === 'blur') editor.dispatchEvent(new f.window.Event('blur'));
    else editor.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: finish }));
    assert.ok(session.hoverDismiss);
    f.tick(700); assert.equal(session.closed, true);
  });
}

test('click-only controls retain their explicit dismissal behavior', t => {
  const f = fixture(t);
  f.plugin.settings.openImageControls = 'click';
  f.plugin.openSession(f.container);
  assert.equal(f.plugin.session.hoverDismiss, null);
  f.tick(1000); assert.equal(f.plugin.session.closed, false);
});

test('inline captions ignore IME Enter and detach listeners between editing sessions', t => {
  const f = fixture(t); f.plugin.openSession(f.container);
  const s = f.plugin.session;
  s.resolved.link.caption = 'Original';
  let saves = 0;
  t.mock.method(s, 'apply', async () => { saves++; });
  for (let i = 0; i < 3; i++) {
    s.editCaption(); const editor = s.captionEditor;
    editor.textContent = `Draft ${i}`;
    editor.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Enter', isComposing: true }));
    assert.equal(s.captionEditor, editor); assert.equal(saves, i);
    editor.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Enter' }));
    assert.equal(s.captionEditor, null); assert.equal(s.captionCleanup, null); assert.equal(saves, i + 1);
    editor.dispatchEvent(new f.window.Event('blur'));
    assert.equal(saves, i + 1);
  }
});

test('global image shortcuts leave unrelated editable controls alone', t => {
  const f = fixture(t); f.plugin.openSession(f.container);
  const s = f.plugin.session;
  let changes = 0;
  t.mock.method(s, 'nudge', () => { changes++; });
  const input = f.window.document.createElement('input'); f.window.document.body.append(input);
  input.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
  assert.equal(changes, 0); assert.equal(s.closed, false);
});

test('Escape in the width field cancels pending edits', t => {
  const f = fixture(t); f.plugin.openSession(f.container);
  const s = f.plugin.session;
  let savePending;
  t.mock.method(s, 'close', save => { savePending = save; });
  s.widthInput.dispatchEvent(new f.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(savePending, false);
});

test('closing a session cancels and settles pending reattachment', async t => {
  const f = fixture(t); f.plugin.openSession(f.container);
  const s = f.plugin.session;
  const frames = new Map(); let id = 0;
  f.window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
  f.window.cancelAnimationFrame = frame => frames.delete(frame);
  const result = s.reattach(s.keyOf(f.container));
  assert.equal(frames.size, 1);
  s.close(false);
  assert.equal(await result, null); assert.equal(frames.size, 0); assert.equal(s.cancelReattach, null);
});

test('failed source writes close cleanly without an unhandled rejection', async t => {
  const f = fixture(t); f.plugin.openSession(f.container);
  const s = f.plugin.session;
  t.mock.method(console, 'error', () => {});
  s.resolved.from = 0; s.resolved.to = s.link.raw.length;
  s.resolved.view = { state: { doc: { sliceString: () => s.link.raw } }, dispatch() { throw Error('Write failed'); } };
  await s.commit('![[photo.jpg|100]]');
  assert.equal(s.closed, true); assert.equal(s.busy, false); assert.equal(f.plugin.session, null);
});

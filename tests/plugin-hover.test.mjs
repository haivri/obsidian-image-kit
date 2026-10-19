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

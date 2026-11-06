import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './_load.mjs';
import { TFile, Notice } from './_stubs/obsidian.mjs';
const { handlePasteDrop, registerPasteDrop } = await loadModule('paste-drop');
const { normalizeSettings } = await loadModule('settings');

function fixture() {
  const note = Object.assign(new TFile(), { path: 'note.md', basename: 'note' });
  const f = { text: '', selection: 0, alive: true, locked: false, created: [], inserted: [], handlers: {}, info: { file: note } };
  f.editor = { cm: { state: { readOnly: false } }, getValue: () => f.text,
    listSelections: () => [{ anchor: { line: 0, ch: f.selection }, head: { line: 0, ch: f.selection } }],
    getCursor: () => ({ line: 0, ch: f.selection }), getLine: () => f.text,
    replaceSelection: text => f.inserted.push(text) };
  f.plugin = { settings: { ...normalizeSettings(null), handlePaste: true }, grammarOptions: () => ({}),
    register(fn) { f.unload = fn; }, registerEvent() {},
    app: { workspace: { iterateAllLeaves(fn) { fn({ view: { editor: f.editor, file: f.info.file } }); },
      on(event, callback) { f.handlers[event] = callback; } },
      plugins: { plugins: { 'page-lock': { isFileLocked: () => f.locked } } },
      vault: { getAbstractFileByPath: () => note, async createBinary(path, bytes) { f.created.push({ path, bytes }); return { path }; } },
      fileManager: { async getAvailablePathForAttachment(name) { return name; }, generateMarkdownLink(file) { return `![[${file.path}]]`; } } } };
  f.files = [{ name: 'a.png', type: 'image/png', async arrayBuffer() { return new Uint8Array([1, 2, 3]).buffer; } }];
  f.run = () => handlePasteDrop(f.plugin, f.files, f.editor, f.info, () => f.alive);
  return f;
}

test('paste preserves original bytes and inserts one formatted transaction', async () => {
  const f = fixture(); await f.run();
  assert.deepEqual([...new Uint8Array(f.created[0].bytes)], [1, 2, 3]);
  assert.equal(f.inserted.length, 1); assert.match(f.inserted[0], /\|480\]\]$/);
});

for (const change of ['selection', 'document', 'file', 'rename', 'lock', 'readonly', 'unload']) {
  test(`paste cancels after asynchronous save on ${change}, retaining the attachment`, async () => {
    const f = fixture();
    f.plugin.app.vault.createBinary = async (path, bytes) => {
      f.created.push({ path, bytes });
      if (change === 'selection') f.selection++;
      if (change === 'document') f.text = 'Typed while saving';
      if (change === 'file') f.info.file = { path: 'different.md' };
      if (change === 'rename') f.info.file.path = 'renamed.md';
      if (change === 'lock') f.locked = true;
      if (change === 'readonly') f.editor.cm.state.readOnly = true;
      if (change === 'unload') f.alive = false;
      return { path };
    };
    Notice.messages.length = 0;
    await f.run();
    assert.equal(f.created.length, 1); assert.equal(f.inserted.length, 0);
    assert.ok(Notice.messages.some(message => message.includes(f.created[0].path)));
  });
}

test('invalid destinations and mixed file payloads are not intercepted', () => {
  for (const mode of ['no-file', 'locked', 'readonly', 'mixed', 'disabled']) {
    const f = fixture(); registerPasteDrop(f.plugin);
    if (mode === 'no-file') f.info.file = null;
    if (mode === 'locked') f.locked = true;
    if (mode === 'readonly') f.editor.cm.state.readOnly = true;
    if (mode === 'mixed') f.files.push({ type: 'text/plain' });
    if (mode === 'disabled') f.plugin.settings.handlePaste = false;
    for (const kind of ['paste', 'drop']) {
      let prevented = false;
      f.handlers[`editor-${kind}`]({ preventDefault() { prevented = true; }, clipboardData: { files: f.files }, dataTransfer: { files: f.files } }, f.editor, f.info);
      assert.equal(prevented, false, mode);
    }
  }
});

test('multiple pasted images in a table stay in the same cell', async () => {
  const f = fixture(); f.text = '| cell |'; f.files.push({ ...f.files[0], name: 'b.png' });
  await f.run(); assert.equal(f.inserted.length, 1);
  assert.equal(f.inserted[0].includes('\n'), false); assert.match(f.inserted[0], /\\\|480/);
});

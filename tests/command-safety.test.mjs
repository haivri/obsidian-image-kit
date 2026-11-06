import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './_load.mjs';
const { default: ImageKitPlugin } = await loadModule('main');

test('stale context menu edits do not overwrite changed source', () => {
  const p = new ImageKitPlugin(); p.app = { workspace: { iterateAllLeaves() {} } };
  let writes = 0;
  const editor = { getLine: () => 'changed text', transaction() { writes++; } };
  p.writeAtCursor(editor, { line: 0, link: { raw: '![[a.png]]', start: 0, end: 10 } }, '![[a.png|100]]');
  assert.equal(writes, 0);
});

test('edit command picks the exact second image on a shared source line', () => {
  const p = new ImageKitPlugin(); p.decorateRoot = () => {};
  const first = {}, second = {};
  p.resolver = { resolve: el => ({ line: 2, link: { start: el === first ? 0 : 20, raw: '![[a.png]]' } }) };
  const view = { contentEl: { querySelectorAll: () => [first, second] } };
  assert.equal(p.containerForLine(view, { line: 2, link: { start: 20, raw: '![[a.png]]' } }), second);
});

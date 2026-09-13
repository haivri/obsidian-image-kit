import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './_load.mjs';

const { writeLink } = await loadModule('writer');
const { isNoteLocked } = await loadModule('lock');

test('read-only image edits do not dispatch or report success', async () => {
  let dispatches = 0;
  const resolved = { sourcePath: 'locked.md', link: { raw: 'old' }, from: 0, to: 3,
    view: { state: { readOnly: true }, dispatch() { dispatches++; } } };
  assert.equal(await writeLink({}, resolved, 'new'), false);
  assert.equal(dispatches, 0);
});

test('a transaction rejected by an editor filter is not reported as an applied image edit', async () => {
  const resolved = { sourcePath: 'note.md', link: { raw: 'old' }, from: 0, to: 3,
    view: { state: { readOnly: false, doc: { sliceString: () => 'old' } }, dispatch() {} } };
  assert.equal(await writeLink({}, resolved, 'new'), false);
});

test('a locked host protects image controls even when their source is another note', () => {
  const file = { path: 'host.md' };
  const app = {
    plugins: { plugins: { 'page-lock': { isFileLocked: f => f === file } } },
    vault: { getAbstractFileByPath: () => null },
    workspace: { iterateAllLeaves: fn => fn({ view: { file, containerEl: { contains: () => true } } }) }
  };
  assert.equal(isNoteLocked(app, 'embedded.md', {}), true);
});

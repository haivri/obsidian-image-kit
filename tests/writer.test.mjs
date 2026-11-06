import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './_load.mjs';
import { TFile } from './_stubs/obsidian.mjs';

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
    view: { state: { readOnly: false, doc: { length: 3, sliceString: () => 'old' } }, dispatch() {} } };
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

for (const [name, input, expected] of [
  ['unique relocated image', 'moved\n![[a.png]]', 'moved\n![[a.png|100]]'],
  ['duplicates on one line', 'moved\n![[a.png]] ![[a.png]]', null],
  ['duplicates on different lines', 'moved\n![[a.png]]\n![[a.png]]', null],
  ['original line no longer exists', '![[a.png]]', '![[a.png|100]]']
]) {
  test(`reading-view write handles ${name}`, async () => {
    let output = input;
    const file = new TFile();
    const app = { vault: { getAbstractFileByPath: () => file, process: async (_file, fn) => { output = fn(output); } } };
    const resolved = { sourcePath: 'note.md', line: name === 'original line no longer exists' ? 8 : 0,
      link: { raw: '![[a.png]]', start: 0, end: 10 } };
    assert.equal(await writeLink(app, resolved, '![[a.png|100]]'), expected !== null);
    assert.equal(output, expected ?? input);
  });
}

for (const reject of [false, true]) {
  test(`removing an image reports ${reject ? 'rejection' : 'success'} accurately`, async () => {
    let text = '![[a.png]]';
    const doc = { get length() { return text.length; }, sliceString: (a, b) => text.slice(a, b) };
    const resolved = { sourcePath: 'note.md', from: 0, to: text.length, link: { raw: text },
      view: { state: { doc }, dispatch: () => { if (!reject) text = ''; } } };
    assert.equal(await writeLink({}, resolved, ''), !reject);
  });
}

test('a reused editor cannot write into a different note with identical image text', async () => {
  let writes = 0;
  const resolved = { sourcePath: 'before.md', isCurrent: () => false, link: { raw: '![[a.png]]' },
    view: { state: {}, dispatch() { writes++; } } };
  assert.equal(await writeLink({}, resolved, '![[a.png|100]]'), false);
  assert.equal(writes, 0);
});

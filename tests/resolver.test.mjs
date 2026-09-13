import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './_load.mjs';

const r = await loadModule('resolver');
const opts = { ignore: ['thumb'] };

test('pickLinkOnLine: offset covering wins, then path, then sole link', () => {
  const line = 'x ![[a.png|100]] y ![[b.png|200]] z ![[a.png|300]]';
  assert.equal(r.pickLinkOnLine(line, 2, null, opts).raw, '![[a.png|100]]');
  assert.equal(r.pickLinkOnLine(line, 19, null, opts).raw, '![[b.png|200]]');
  assert.equal(r.pickLinkOnLine(line, 36, 'a.png', opts).raw, '![[a.png|300]]');
  // Offset that misses every link: nearest by path.
  assert.equal(r.pickLinkOnLine(line, 35, 'a.png', opts).raw, '![[a.png|300]]');
  assert.equal(r.pickLinkOnLine(line, null, 'b.png', opts).raw, '![[b.png|200]]');
  assert.equal(r.pickLinkOnLine('only ![[c.png]] here', null, null, opts).raw, '![[c.png]]');
  assert.equal(r.pickLinkOnLine('no images', 0, null, opts), null);
  assert.equal(r.pickLinkOnLine(line, null, null, opts), null);
});

test('pickLinkOnLine: embed src may be resolved differently from link text', () => {
  assert.equal(r.pickLinkOnLine('![[Attachments/photo.jpg|300]]', null, 'photo.jpg', opts).raw, '![[Attachments/photo.jpg|300]]');
  assert.equal(r.pickLinkOnLine('![[photo.jpg#^blk|300]]', null, 'photo.jpg', opts).raw, '![[photo.jpg#^blk|300]]');
  assert.equal(r.pickLinkOnLine('![cap](dir%20x/IMG_1.jpeg)', null, 'app://local/x/dir%20x/IMG_1.jpeg?123', opts).raw, '![cap](dir%20x/IMG_1.jpeg)');
});

test('pickLinkInSection: ordinal among same-path links across lines, prefixes untouched', () => {
  const lines = [
    '> [!note] Callout',
    '> ![[a.png|100]] and ![[a.png|200]]',
    '- item ![[b.png]]',
    '  - nested ![[a.png|300]]'
  ];
  assert.deepEqual(pick(r.pickLinkInSection(lines, 10, 'a.png', 0, opts)), { raw: '![[a.png|100]]', line: 11 });
  assert.deepEqual(pick(r.pickLinkInSection(lines, 10, 'a.png', 1, opts)), { raw: '![[a.png|200]]', line: 11 });
  assert.deepEqual(pick(r.pickLinkInSection(lines, 10, 'a.png', 2, opts)), { raw: '![[a.png|300]]', line: 13 });
  assert.deepEqual(pick(r.pickLinkInSection(lines, 10, 'b.png', 0, opts)), { raw: '![[b.png]]', line: 12 });
  assert.equal(r.pickLinkInSection(lines, 10, 'a.png', 3, opts), null);
  // Table row: the picked link keeps its escaped-pipe flag.
  const row = ['| ![[t.png\\|120]] | text |'];
  const t = r.pickLinkInSection(row, 0, 't.png', 0, opts);
  assert.equal(t.link.escapedPipes, true);
  assert.equal(t.link.width, 120);
});

function pick(x) {
  return x ? { raw: x.link.raw, line: x.line } : null;
}

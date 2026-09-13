import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './_load.mjs';

const g = await loadModule('grammar');
const one = (line, opts) => {
  const links = g.findImageLinks(line, opts);
  assert.equal(links.length, 1, `expected one link in ${line}`);
  return links[0];
};

test('parses wikilinks: path, width, WxH, align, caption, free', () => {
  assert.deepEqual(pick(one('![[a.png]]')), { path: 'a.png', width: undefined, height: undefined, align: undefined, caption: undefined, free: [] });
  assert.deepEqual(pick(one('![[a.png|300]]')), { path: 'a.png', width: 300, height: undefined, align: undefined, caption: undefined, free: [] });
  assert.deepEqual(pick(one('![[a.png|99x107]]')), { path: 'a.png', width: 99, height: 107, align: undefined, caption: undefined, free: [] });
  assert.deepEqual(pick(one('![[a.png|center|300]]')), { path: 'a.png', width: 300, height: undefined, align: 'center', caption: undefined, free: [] });
  assert.deepEqual(pick(one('![[a.png|300|center]]')), { path: 'a.png', width: 300, height: undefined, align: 'center', caption: undefined, free: [] });
  assert.deepEqual(pick(one('![[a.png|Sunset over the bay|300]]')), { path: 'a.png', width: 300, height: undefined, align: undefined, caption: 'Sunset over the bay', free: [] });
  assert.deepEqual(pick(one('![[a.png|thumb]]', { ignore: ['thumb'] })), { path: 'a.png', width: undefined, height: undefined, align: undefined, caption: undefined, free: ['thumb'] });
  assert.deepEqual(pick(one('![[a.png|thumb]]')), { path: 'a.png', width: undefined, height: undefined, align: undefined, caption: 'thumb', free: [] });
  assert.deepEqual(pick(one('![[folder/a.png#^blk|300]]')), { path: 'folder/a.png#^blk', width: 300, height: undefined, align: undefined, caption: undefined, free: [] });
});

test('alignment aliases normalize on read; left is the default and disappears', () => {
  assert.equal(one('![[a.png|Centre]]').align, 'center');
  assert.equal(one('![[a.png|float-right]]').align, 'wrap-right');
  assert.equal(one('![[a.png|FLOAT-LEFT]]').align, 'wrap-left');
  assert.equal(one('![[a.png|left|300]]').align, undefined);
  assert.equal(one('![[a.png|Left]]').caption, undefined);
});

test('filename echoes are never captions', () => {
  assert.equal(one('![[IMG_1.jpeg|IMG_1.jpeg]]').caption, undefined);
  assert.equal(one('![[dir/IMG_1.jpeg|img_1]]').caption, undefined);
  assert.equal(one('![IMG_1.jpeg](dir%20x/IMG_1.jpeg)').caption, undefined);
  assert.deepEqual(one('![IMG_1.jpeg](dir%20x/IMG_1.jpeg)').free, ['IMG_1.jpeg']);
});

test('first qualifying free token is the caption; later ones are preserved as free', () => {
  const l = one('![[a.png|thumb|A real caption|Another|center]]', { ignore: ['thumb'] });
  assert.equal(l.caption, 'A real caption');
  assert.deepEqual(l.free, ['thumb', 'Another']);
});

test('parses markdown links: alt tokens, destinations verbatim', () => {
  assert.deepEqual(pick(one('![](a.png)')), { path: 'a.png', width: undefined, height: undefined, align: undefined, caption: undefined, free: [] });
  assert.deepEqual(pick(one('![Sunset|300](<my dir/a.png>)')), { path: '<my dir/a.png>', width: 300, height: undefined, align: undefined, caption: 'Sunset', free: [] });
  assert.deepEqual(pick(one('![alt|300](https://x/y.png "title")')), { path: 'https://x/y.png "title"', width: 300, height: undefined, align: undefined, caption: 'alt', free: [] });
  assert.equal(one('![x](a%20b.PNG)').path, 'a%20b.PNG');
});

test('non-image links are never matched', () => {
  for (const line of ['![[note]]', '[[a.png]]', '[text](a.png)', '![[song.mp3]]', '![[draw.excalidraw]]', '![[doc.pdf|300]]', '![[video.mp4]]', 'plain text']) {
    assert.equal(g.findImageLinks(line).length, 0, line);
  }
});

test('multiple links on one line come back in order with offsets', () => {
  const line = 'text ![[a.png|100]] and ![b](b.jpg) and ![[a.png|200]]';
  const links = g.findImageLinks(line);
  assert.deepEqual(links.map((l) => l.raw), ['![[a.png|100]]', '![b](b.jpg)', '![[a.png|200]]']);
  for (const l of links) assert.equal(line.slice(l.start, l.end), l.raw);
});

test('table rows: escaped pipes parse and serialize', () => {
  const line = '| ![[a.png\\|300]] | cell |';
  assert.equal(g.isTableRow(line), true);
  const l = one(line);
  assert.equal(l.width, 300);
  assert.equal(l.escapedPipes, true);
  assert.equal(g.applyLayout(l, { align: 'center' }), '![[a.png\\|center\\|300]]');
  // A row where the link had no pipes yet still gets escaped pipes on write.
  const bare = one('| ![[a.png]] | x |');
  assert.equal(g.applyLayout(bare, { width: 400 }), '![[a.png\\|400]]');
  assert.equal(g.isTableRow('| not a row'), false);
  assert.equal(g.isTableRow('no'), false);
});

test('applyLayout writes canonical order and keeps untouched links byte-identical', () => {
  assert.equal(g.applyLayout(one('![[a.png]]'), { width: 400 }), '![[a.png|400]]');
  assert.equal(g.applyLayout(one('![[a.png|300]]'), { width: 400 }), '![[a.png|400]]');
  assert.equal(g.applyLayout(one('![[a.png|99x107]]'), { width: 400 }), '![[a.png|400]]');
  assert.equal(g.applyLayout(one('![[a.png|center|300]]'), { width: 400 }), '![[a.png|center|400]]');
  assert.equal(g.applyLayout(one('![[a.png|300|center]]'), { width: 400 }), '![[a.png|center|400]]');
  assert.equal(g.applyLayout(one('![[a.png|Sunset over the bay|300]]'), { width: 400 }), '![[a.png|Sunset over the bay|400]]');
  assert.equal(g.applyLayout(one('![[a.png|thumb]]', { ignore: ['thumb'] }), { width: 400 }), '![[a.png|thumb|400]]');
  assert.equal(g.applyLayout(one('![[a.png | 300]]'), { width: 400 }), '![[a.png|400]]');
  assert.equal(g.applyLayout(one('![[folder/a.png#^blk|300]]'), { width: 400 }), '![[folder/a.png#^blk|400]]');
  assert.equal(g.applyLayout(one('![](a.png)'), { align: 'center' }), '![center](a.png)');
  assert.equal(g.applyLayout(one('![IMG_1.jpeg](dir%20x/IMG_1.jpeg)'), { align: 'center' }), '![IMG_1.jpeg|center](dir%20x/IMG_1.jpeg)');
  assert.equal(g.applyLayout(one('![Sunset|300](<my dir/a.png>)'), { align: 'center' }), '![Sunset|center|300](<my dir/a.png>)');
  assert.equal(g.applyLayout(one('![alt|300](https://x/y.png "title")'), { align: 'center' }), '![alt|center|300](https://x/y.png "title")');
  // No-ops return raw, even when the source is non-canonical.
  const odd = one('![[a.png|300|center]]');
  assert.equal(g.applyLayout(odd, { width: 300 }), odd.raw);
  assert.equal(g.applyLayout(odd, {}), odd.raw);
  const spaced = one('![[a.png | 300]]');
  assert.equal(g.applyLayout(spaced, { width: 300 }), spaced.raw);
});

test('applyLayout: null removes, left removes alignment, captions are sanitized', () => {
  assert.equal(g.applyLayout(one('![[a.png|center|300]]'), { align: null }), '![[a.png|300]]');
  assert.equal(g.applyLayout(one('![[a.png|center|300]]'), { width: null }), '![[a.png|center]]');
  assert.equal(g.applyLayout(one('![[a.png|Cap|center|300]]'), { caption: null }), '![[a.png|center|300]]');
  assert.equal(g.applyLayout(one('![[a.png|300]]'), { caption: ' A [bad] | caption\nhere ' }), '![[a.png|A bad caption here|300]]');
  assert.equal(g.applyLayout(one('![](a.png)'), { caption: 'close ) paren' }), '![close paren](a.png)');
  assert.equal(g.applyLayout(one('![[a.png|Cap]]'), { caption: '   ' }), '![[a.png]]');
  assert.equal(g.applyLayout(one('![[a.png|300]]'), { width: 399.6 }), '![[a.png|400]]');
});

test('resetLayout preserves captions and free tokens while clearing presentation', () => {
  assert.equal(g.resetLayout(one('![[a.png|Cap|center|300]]')), '![[a.png|Cap]]');
  assert.equal(g.resetLayout(one('![[a.png|thumb|center|300]]', { ignore: ['thumb'] })), '![[a.png|thumb]]');
  assert.equal(g.resetLayout(one('![Cap|300](a.png)')), '![Cap](a.png)');
  assert.equal(g.resetLayout(one('![[a.png|Cap]]')), '![[a.png|Cap]]');
  const plain = one('![[a.png]]');
  assert.equal(g.resetLayout(plain), plain.raw);
});

test('round-trip invariants over a fixture corpus', () => {
  const corpus = [
    '![[a.png]]', '![[a.png|300]]', '![[a.png|99x107]]', '![[a.png|center|300]]', '![[a.png|300|center]]',
    '![[a.png|Sunset over the bay|300]]', '![[a.png|thumb]]', '![[a.png | 300]]', '![[folder/a.png#^blk|300]]',
    '![[a.png|wrap-right|240]]', '![[a.png|Cap|right]]', '![](a.png)', '![IMG_1.jpeg](dir%20x/IMG_1.jpeg)',
    '![Sunset|300](<my dir/a.png>)', '![alt|300](https://x/y.png "title")', '![[a.png\\|300]]', '![Cap\\|center\\|300](a.png)'
  ];
  for (const raw of corpus) {
    const a = one(raw, { ignore: ['thumb'] });
    const canonical = g.serializeImageLink(a);
    const b = one(canonical, { ignore: ['thumb'] });
    // serialize(parse(canonical)) === canonical
    assert.equal(g.serializeImageLink(b), canonical, raw);
    // parse(serialize(parse(x))) deep-equals parse(x) for layout fields (height is dropped by design)
    assert.deepEqual(
      { width: b.width, align: b.align, caption: b.caption, free: b.free, form: b.form },
      { width: a.width, align: a.align, caption: a.caption, free: a.free, form: a.form },
      raw
    );
  }
});

test('helpers: isImagePath, basenameOf, normalizePath', () => {
  assert.equal(g.isImagePath('a.PNG', 'wiki'), true);
  assert.equal(g.isImagePath('a.png#^x', 'wiki'), true);
  assert.equal(g.isImagePath('<my dir/a.jpg>', 'md'), true);
  assert.equal(g.isImagePath('https://h/p/a.webp?x=1', 'md'), true);
  assert.equal(g.isImagePath('https://h/p/a?x=1', 'md'), false);
  assert.equal(g.isImagePath('a.md', 'wiki'), false);
  assert.equal(g.basenameOf('dir%20x/IMG_1.jpeg', 'md'), 'IMG_1.jpeg');
  assert.equal(g.basenameOf('dir/IMG_1.jpeg#^a', 'wiki'), 'IMG_1.jpeg');
  assert.equal(g.normalizePath('a.png "title"', 'md'), 'a.png');
});

function pick(l) {
  return { path: l.path, width: l.width, height: l.height, align: l.align, caption: l.caption, free: l.free };
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadModule } from './_load.mjs';

const n = await loadModule('naming');
const now = new Date(2026, 8, 12, 22, 5, 9);

test('expandTemplate fills every variable and sanitizes', () => {
  const ctx = { notename: 'Trip: Day 1', original: 'IMG_1.jpeg', now };
  assert.equal(n.expandTemplate('{notename}-{timestamp}', ctx), 'Trip Day 1-20260912220509');
  assert.equal(n.expandTemplate('{date} {original}', ctx), '2026-09-12 IMG_1.jpeg');
  assert.equal(n.expandTemplate('{time}', ctx), '220509');
  assert.equal(n.expandTemplate('', ctx), 'IMG_1.jpeg');
  assert.equal(n.expandTemplate('a/b\\c:d*e?f"g<h>i|j#k^l[m]n', ctx), 'abcdefghijklmn');
  assert.equal(n.expandTemplate('???', ctx), 'image');
});

test('extensionFor prefers the filename, then the MIME type', () => {
  assert.equal(n.extensionFor('Photo.JPG', 'image/png'), 'jpg');
  assert.equal(n.extensionFor('image.png', 'image/jpeg'), 'png');
  assert.equal(n.extensionFor('image', 'image/jpeg'), 'jpg');
  assert.equal(n.extensionFor('', 'image/webp'), 'webp');
  assert.equal(n.extensionFor('', 'application/octet-stream'), 'png');
  assert.equal(n.stemOf('a.b.png'), 'a.b');
  assert.equal(n.stemOf('noext'), 'noext');
});

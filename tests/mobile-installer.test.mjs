import assert from 'node:assert/strict';
import test from 'node:test';
import { installerFor } from '../bootstrap/build-mobile-installer.mjs';

function fixture(failLoad = false) {
  const files = new Map([
    ['.obsidian/plugins/image-kit/main.js', 'old code'],
    ['.obsidian/plugins/image-kit/manifest.json', '{"id":"image-kit","version":"0.1.0"}'],
    ['.obsidian/plugins/image-kit/styles.css', 'old styles'],
    ['.obsidian/plugins/image-kit/data.json', '{"presets":"keep me"}']
  ]);
  const adapter = {
    exists: async path => files.has(path),
    mkdir: async path => files.set(path, ''),
    read: async path => files.get(path),
    write: async (path, text) => files.set(path, text),
    remove: async path => files.delete(path)
  };
  let loads = 0;
  const plugins = {
    enabledPlugins: new Set(['image-kit']), plugins: { 'image-kit': {} },
    async disablePlugin(id) { delete this.plugins[id]; },
    async disablePluginAndSave(id) { delete this.plugins[id]; this.enabledPlugins.delete(id); },
    async loadManifests() {},
    async enablePluginAndSave(id) {
      if (failLoad && loads++ === 0) throw new Error('load failed');
      this.enabledPlugins.add(id); this.plugins[id] = {};
    }
  };
  const app = { vault: { adapter, configDir: '.obsidian' }, plugins };
  const tp = { obsidian: { requireApiVersion: () => true, Notice: class {} } };
  const note = installerFor({ 'main.js': 'new code', 'manifest.json': '{"id":"image-kit","version":"0.1.1"}', 'styles.css': 'new styles' });
  const code = note.split('<%*')[1].split('%>')[0];
  const run = () => new (async function() {}).constructor('app', 'tp', code)(app, tp);
  return { files, plugins, run };
}

test('mobile installer preserves settings, backs up runtime files, and enables the new build', async () => {
  const f = fixture(); await f.run();
  assert.equal(f.files.get('.obsidian/plugins/image-kit/main.js'), 'new code');
  assert.equal(f.files.get('.obsidian/plugins/image-kit/data.json'), '{"presets":"keep me"}');
  assert.ok([...f.files].some(([path, data]) => path.includes('installer-backups/') && data === 'old code'));
  assert.ok(f.plugins.enabledPlugins.has('image-kit'));
});

test('mobile installer restores the old runtime and enabled state if the new plugin fails to load', async () => {
  const f = fixture(true); await assert.rejects(f.run(), /load failed/);
  assert.equal(f.files.get('.obsidian/plugins/image-kit/main.js'), 'old code');
  assert.equal(f.files.get('.obsidian/plugins/image-kit/styles.css'), 'old styles');
  assert.equal(f.files.get('.obsidian/plugins/image-kit/data.json'), '{"presets":"keep me"}');
  assert.ok(f.plugins.enabledPlugins.has('image-kit'));
});

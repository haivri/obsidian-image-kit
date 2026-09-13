import assert from 'node:assert/strict';
import test from 'node:test';
import { loadModule } from './_load.mjs';

const { ImageKitSettingTab, normalizeSettings } = await loadModule('settings');

function fixture() {
  const plugin = {
    settings: normalizeSettings(null),
    saves: 0,
    async saveSettings() { this.saves++; },
    redecorateAll() {}
  };
  return { plugin, tab: new ImageKitSettingTab({}, plugin) };
}

test('native settings expose all three editable presets with string values', () => {
  const { tab } = fixture();
  const controls = tab.getSettingDefinitions().map(d => d.control);
  for (let i = 0; i < 3; i++) {
    for (const field of ['name', 'width']) {
      const key = `preset-${i}-${field}`;
      assert.ok(controls.some(c => c.key === key && c.type === 'text'));
      assert.equal(typeof tab.getControlValue(key), 'string');
    }
  }
});

test('renaming the selected insertion preset preserves its selection', async () => {
  const { plugin, tab } = fixture();
  await tab.setControlValue('preset-1-name', ' Reading ');
  assert.equal(plugin.settings.defaultInsertSize, 'Reading');
  assert.equal(plugin.settings.presets[1].name, 'Reading');
  const size = tab.getSettingDefinitions().find(d => d.control.key === 'defaultInsertSize');
  assert.equal(size.control.options.Reading, 'Reading');
  assert.equal(plugin.saves, 1);
});

test('invalid preset widths leave the stored value intact', async () => {
  const { plugin, tab } = fixture();
  for (const value of ['', '31', '-50', 'abc', 'Infinity']) {
    await tab.setControlValue('preset-0-width', value);
  }
  assert.equal(plugin.settings.presets[0].width, 240);
  assert.equal(plugin.saves, 0);
  await tab.setControlValue('preset-0-width', '321.7');
  assert.equal(plugin.settings.presets[0].width, 322);
  assert.equal(plugin.saves, 1);
});

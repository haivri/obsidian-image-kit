import { App, PluginSettingTab } from 'obsidian';
import type ImageKitPlugin from './main';

export interface SizePreset {
  name: string;
  width: number;
}

export interface ImageKitSettings {
  presets: SizePreset[];
  /** Preset name, or 'original' for no width on insert. */
  defaultInsertSize: string;
  defaultInsertAlign: 'left' | 'center';
  showCaptions: boolean;
  /** Comma-separated alt tokens that are never captions (e.g. CSS-snippet keywords). */
  captionIgnore: string;
  mobileEditButton: 'always' | 'menu';
  handlePaste: boolean;
  renameTemplate: string;
}

export const DEFAULT_SETTINGS: ImageKitSettings = {
  presets: [
    { name: 'Small', width: 240 },
    { name: 'Medium', width: 480 },
    { name: 'Large', width: 720 }
  ],
  defaultInsertSize: 'Medium',
  defaultInsertAlign: 'left',
  showCaptions: true,
  captionIgnore: '',
  mobileEditButton: 'always',
  handlePaste: false,
  renameTemplate: '{notename}-{timestamp}'
};

export function ignoreList(settings: ImageKitSettings): string[] {
  return settings.captionIgnore.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Merges stored data over defaults, keeping exactly three presets. */
export function normalizeSettings(stored: Partial<ImageKitSettings> | null): ImageKitSettings {
  const merged: ImageKitSettings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  const presets = Array.isArray(merged.presets) ? merged.presets.slice(0, 3) : [];
  while (presets.length < 3) presets.push({ ...DEFAULT_SETTINGS.presets[presets.length] });
  merged.presets = presets.map((p, i) => ({
    name: typeof p?.name === 'string' && p.name.trim() ? p.name.trim() : DEFAULT_SETTINGS.presets[i].name,
    width: Number.isFinite(p?.width) && p.width > 0 ? Math.round(p.width) : DEFAULT_SETTINGS.presets[i].width
  }));
  return merged;
}

type ControlDefinition =
  | { type: 'toggle'; key: string; defaultValue: boolean }
  | { type: 'text'; key: string; defaultValue: string }
  | { type: 'dropdown'; key: string; defaultValue: string; options: Record<string, string> };

export class ImageKitSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ImageKitPlugin) {
    super(app, plugin);
  }

  /** Declarative surface for settings-search plugins. */
  getSettingDefinitions(): { name: string; desc: string; aliases: string[]; control: ControlDefinition }[] {
    return [
      ...this.plugin.settings.presets.flatMap((_, i) => [
        { name: `Preset ${i + 1} name`, desc: 'Label shown in the image toolbar.', aliases: ['size', 'preset'], control: { type: 'text' as const, key: `preset-${i}-name`, defaultValue: DEFAULT_SETTINGS.presets[i].name } },
        { name: `Preset ${i + 1} width`, desc: 'Display width in pixels, at least 32.', aliases: ['size', 'pixels'], control: { type: 'text' as const, key: `preset-${i}-width`, defaultValue: String(DEFAULT_SETTINGS.presets[i].width) } }
      ]),
      { name: 'Default size on insert', desc: 'Size for the optional paste and drop handler.', aliases: ['size', 'paste'], control: { type: 'dropdown', key: 'defaultInsertSize', defaultValue: DEFAULT_SETTINGS.defaultInsertSize, options: Object.fromEntries<string>([['original', 'Original'] as const, ...this.plugin.settings.presets.map(p => [p.name, p.name] as const)]) } },
      { name: 'Default alignment on insert', desc: 'Alignment for the optional paste and drop handler.', aliases: ['alignment', 'paste'], control: { type: 'dropdown', key: 'defaultInsertAlign', defaultValue: DEFAULT_SETTINGS.defaultInsertAlign, options: { left: 'Left', center: 'Center' } } },
      { name: 'Show captions', desc: 'Render caption text from the image link beneath the image.', aliases: ['figcaption', 'alt'], control: { type: 'toggle', key: 'showCaptions', defaultValue: DEFAULT_SETTINGS.showCaptions } },
      { name: 'Caption ignore words', desc: 'Comma-separated alt words that are never captions.', aliases: ['thumb', 'keywords'], control: { type: 'text', key: 'captionIgnore', defaultValue: DEFAULT_SETTINGS.captionIgnore } },
      { name: 'Edit button on mobile', desc: 'Include the image edit action on touch devices, or use commands and the context menu.', aliases: ['mobile', 'touch'], control: { type: 'dropdown', key: 'mobileEditButton', defaultValue: DEFAULT_SETTINGS.mobileEditButton, options: { always: 'Always', menu: 'Context menu only' } } },
      { name: 'Handle pasted and dropped images', desc: 'Keep the original file, rename it, and apply the default size.', aliases: ['paste', 'drop'], control: { type: 'toggle', key: 'handlePaste', defaultValue: DEFAULT_SETTINGS.handlePaste } },
      { name: 'Rename template', desc: 'Filename for pasted images. Blank keeps the original name.', aliases: ['filename', 'timestamp'], control: { type: 'text', key: 'renameTemplate', defaultValue: DEFAULT_SETTINGS.renameTemplate } }
    ];
  }

  getControlValue(key: string): unknown {
    const preset = /^preset-([0-2])-(name|width)$/.exec(key);
    if (preset) return String(this.plugin.settings.presets[Number(preset[1])][preset[2] as 'name' | 'width']);
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const match = /^preset-([0-2])-(name|width)$/.exec(key);
    if (match) {
      const preset = this.plugin.settings.presets[Number(match[1])];
      if (match[2] === 'name') {
        const next = String(value).trim();
        if (!next) return;
        if (this.plugin.settings.defaultInsertSize === preset.name) this.plugin.settings.defaultInsertSize = next;
        preset.name = next;
      } else {
        const width = Math.round(Number(value));
        if (!Number.isFinite(width) || width < 32) return;
        preset.width = width;
      }
      await this.plugin.saveSettings();
      return;
    }
    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    if (!(key in settings)) return;
    settings[key] = value;
    await this.plugin.saveSettings();
    this.plugin.redecorateAll();
  }

}

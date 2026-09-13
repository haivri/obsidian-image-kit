/**
 * Pasted and dropped images: keep the bytes untouched, name the file by the
 * template, let Obsidian pick the attachment folder, and insert a link that
 * already carries the default size and alignment.
 */
import { Editor, MarkdownFileInfo, MarkdownView, Notice } from 'obsidian';
import type ImageKitPlugin from './main';
import { applyLayout, findImageLinks, isTableRow } from './grammar';
import { expandTemplate, extensionFor, stemOf } from './naming';

export function registerPasteDrop(plugin: ImageKitPlugin): void {
  plugin.registerEvent(plugin.app.workspace.on('editor-paste', (evt, editor, info) => {
    if (evt.defaultPrevented) return;
    const files = evt.clipboardData?.files ?? null;
    if (!accepts(plugin, files)) return;
    evt.preventDefault();
    void handle(plugin, files, editor, info);
  }));
  plugin.registerEvent(plugin.app.workspace.on('editor-drop', (evt, editor, info) => {
    if (evt.defaultPrevented) return;
    const files = evt.dataTransfer?.files ?? null;
    if (!accepts(plugin, files)) return;
    evt.preventDefault();
    void handle(plugin, files, editor, info);
  }));
}

/** Only all-image payloads are ours; mixed payloads stay with Obsidian's own handler. */
function accepts(plugin: ImageKitPlugin, files: FileList | null): files is FileList {
  if (!plugin.settings.handlePaste || !files || files.length === 0) return false;
  return Array.from(files).every((f) => f.type.startsWith('image/'));
}

async function handle(plugin: ImageKitPlugin, files: FileList, editor: Editor, info: MarkdownView | MarkdownFileInfo): Promise<void> {
  const images = Array.from(files);
  const note = info.file;
  if (!note) return;

  const { app, settings } = plugin;
  const cursor = editor.getCursor();
  const tableRow = isTableRow(editor.getLine(cursor.line));
  const preset = settings.presets.find((p) => p.name === settings.defaultInsertSize);
  const links: string[] = [];

  for (const image of images) {
    try {
      const buffer = await image.arrayBuffer();
      const original = image.name || 'image';
      const stem = expandTemplate(settings.renameTemplate, { notename: note.basename, original: stemOf(original), now: new Date() });
      const filename = `${stem}.${extensionFor(original, image.type)}`;
      const path = await app.fileManager.getAvailablePathForAttachment(filename, note.path);
      const created = await app.vault.createBinary(path, buffer);
      let link = app.fileManager.generateMarkdownLink(created, note.path);
      if (!link.startsWith('!')) link = `!${link}`;
      const parsed = findImageLinks(link, { ...plugin.grammarOptions(), tableRow })[0];
      links.push(parsed
        ? applyLayout(parsed, { width: preset ? preset.width : null, align: settings.defaultInsertAlign === 'center' ? 'center' : null })
        : link);
    } catch (error) {
      console.error('[image-kit] paste failed', error);
      new Notice(`Could not save ${image.name || 'image'}.`);
    }
  }
  if (links.length) editor.replaceSelection(links.join('\n'));
}

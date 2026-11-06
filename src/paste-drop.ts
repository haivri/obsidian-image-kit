/**
 * Pasted and dropped images: keep the bytes untouched, name the file by the
 * template, let Obsidian pick the attachment folder, and insert a link that
 * already carries the default size and alignment.
 */
import { Editor, MarkdownFileInfo, MarkdownView, Notice } from 'obsidian';
import type ImageKitPlugin from './main';
import { applyLayout, findImageLinks, isTableRow } from './grammar';
import { expandTemplate, extensionFor, stemOf } from './naming';
import { isEditorLocked, isEditorReadOnly, isNoteLocked, sourceFileForEditor } from './lock';

export function registerPasteDrop(plugin: ImageKitPlugin): void {
  let alive = true;
  plugin.register(() => { alive = false; });
  plugin.registerEvent(plugin.app.workspace.on('editor-paste', (evt, editor, info) => {
    if (evt.defaultPrevented) return;
    const files = evt.clipboardData?.files ?? null;
    if (!accepts(plugin, files) || !info.file || sourceFileForEditor(plugin.app, editor) !== info.file || isEditorReadOnly(editor) || isEditorLocked(plugin.app, editor) || isNoteLocked(plugin.app, info.file.path)) return;
    evt.preventDefault();
    void handlePasteDrop(plugin, files, editor, info, () => alive).catch(error => {
      console.error('[image-kit] paste failed', error);
      new Notice('Image insertion failed. Any saved attachments have been kept.');
    });
  }));
  plugin.registerEvent(plugin.app.workspace.on('editor-drop', (evt, editor, info) => {
    if (evt.defaultPrevented) return;
    const files = evt.dataTransfer?.files ?? null;
    if (!accepts(plugin, files) || !info.file || sourceFileForEditor(plugin.app, editor) !== info.file || isEditorReadOnly(editor) || isEditorLocked(plugin.app, editor) || isNoteLocked(plugin.app, info.file.path)) return;
    evt.preventDefault();
    void handlePasteDrop(plugin, files, editor, info, () => alive).catch(error => {
      console.error('[image-kit] paste failed', error);
      new Notice('Image insertion failed. Any saved attachments have been kept.');
    });
  }));
}

/** Only all-image payloads are ours; mixed payloads stay with Obsidian's own handler. */
function accepts(plugin: ImageKitPlugin, files: FileList | null): files is FileList {
  if (!plugin.settings.handlePaste || !files || files.length === 0) return false;
  return Array.from(files).every((f) => f.type.startsWith('image/'));
}

export async function handlePasteDrop(plugin: ImageKitPlugin, files: FileList, editor: Editor, info: MarkdownView | MarkdownFileInfo, alive: () => boolean): Promise<void> {
  const images = Array.from(files);
  const note = info.file;
  if (!note || !alive() || isEditorReadOnly(editor) || isNoteLocked(plugin.app, note.path) || isEditorLocked(plugin.app, editor)) return;

  const { app, settings } = plugin;
  const sourcePath = note.path;
  const snapshot = editor.getValue();
  const selections = JSON.stringify(editor.listSelections());
  const valid = () => alive() && info.file === note && note.path === sourcePath
    && sourceFileForEditor(app, editor) === note
    && !isEditorReadOnly(editor) && !isNoteLocked(app, sourcePath) && !isEditorLocked(app, editor)
    && editor.getValue() === snapshot && JSON.stringify(editor.listSelections()) === selections;
  const createdPaths: string[] = [];
  const canceled = () => new Notice(createdPaths.length
    ? `Image insertion canceled because the destination changed. Attachments kept: ${createdPaths.join(', ')}`
    : 'Image insertion canceled because the destination changed.');
  const cursor = editor.getCursor();
  const tableRow = isTableRow(editor.getLine(cursor.line));
  const preset = settings.presets.find((p) => p.name === settings.defaultInsertSize);
  const links: string[] = [];

  for (const image of images) {
    try {
      if (!valid()) { canceled(); return; }
      const buffer = await image.arrayBuffer();
      if (!valid()) { canceled(); return; }
      const original = image.name || 'image';
      const stem = expandTemplate(settings.renameTemplate, { notename: note.basename, original: stemOf(original), now: new Date() });
      const filename = `${stem}.${extensionFor(original, image.type)}`;
      const path = await app.fileManager.getAvailablePathForAttachment(filename, note.path);
      if (!valid()) { canceled(); return; }
      const created = await app.vault.createBinary(path, buffer);
      createdPaths.push(created.path);
      if (!valid()) { canceled(); return; }
      let link = app.fileManager.generateMarkdownLink(created, note.path);
      if (!link.startsWith('!')) link = `!${link}`;
      const parsed = findImageLinks(link, { ...plugin.grammarOptions(), tableRow })[0];
      links.push(parsed
        ? applyLayout(parsed, { width: preset ? preset.width : null, align: settings.defaultInsertAlign === 'center' ? 'center' : null })
        : link);
    } catch (error) {
      console.error('[image-kit] paste failed', error);
      new Notice(`Could not insert ${image.name || 'image'}.${createdPaths.length ? ` Attachments kept: ${createdPaths.join(', ')}` : ''}`);
    }
  }
  if (!valid()) { canceled(); return; }
  if (links.length) {
    try { editor.replaceSelection(links.join(tableRow ? ' ' : '\n')); }
    catch (error) {
      console.error('[image-kit] insertion failed', error);
      new Notice(`Image insertion failed. Attachments kept: ${createdPaths.join(', ')}`);
    }
  }
}

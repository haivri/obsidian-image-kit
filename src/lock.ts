import { App, Editor, TFile } from 'obsidian';

/** Use Page Lock's current state, including a lock just changed in the UI. */
export function isNoteLocked(app: App, path: string, container?: HTMLElement): boolean {
  const registry = app as App & { plugins?: { plugins?: Record<string, { isFileLocked?: (file: TFile) => boolean }> } };
  const lock = registry.plugins?.plugins?.['page-lock'];
  if (!lock?.isFileLocked) return false;
  const file = app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile && lock.isFileLocked(file)) return true;
  let hostLocked = false;
  if (container) app.workspace.iterateAllLeaves(leaf => {
    const view = leaf.view as typeof leaf.view & { file?: TFile };
    if (view.file && view.containerEl.contains(container) && lock.isFileLocked?.(view.file)) hostLocked = true;
  });
  return hostLocked;
}

export function isEditorLocked(app: App, editor: Editor): boolean {
  let locked = false;
  app.workspace.iterateAllLeaves(leaf => {
    const view = leaf.view as typeof leaf.view & { editor?: Editor; file?: TFile };
    if (view.editor === editor && view.file && isNoteLocked(app, view.file.path)) locked = true;
  });
  return locked;
}

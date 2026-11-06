/**
 * Commits a new link text to the note. Live Preview goes through CodeMirror so
 * the caret stays put and Cmd+Z reverts one edit. Reading view goes through
 * `vault.process` with a guard that the link is still where it was.
 */
import { App, Notice, TFile } from 'obsidian';
import { ResolvedLink } from './resolver';
import { isNoteLocked } from './lock';

export async function writeLink(app: App, resolved: ResolvedLink, text: string): Promise<boolean> {
  if (isNoteLocked(app, resolved.sourcePath) || resolved.view?.state.readOnly) return false;
  if (resolved.isCurrent?.() === false) {
    new Notice('Image source changed; edit not applied.');
    return false;
  }
  if (text === resolved.link.raw) return true;

  if (resolved.view && resolved.from !== undefined && resolved.to !== undefined) {
    const current = resolved.view.state.doc.sliceString(resolved.from, resolved.to);
    if (current !== resolved.link.raw) {
      new Notice('Image link changed; edit not applied.');
      return false;
    }
    const expectedLength = resolved.view.state.doc.length - (resolved.to - resolved.from) + text.length;
    resolved.view.dispatch({
      changes: { from: resolved.from, to: resolved.to, insert: text },
      scrollIntoView: false
    });
    return resolved.view.state.doc.length === expectedLength
      && resolved.view.state.doc.sliceString(resolved.from, resolved.from + text.length) === text;
  }

  const file = app.vault.getAbstractFileByPath(resolved.sourcePath);
  if (!(file instanceof TFile)) return false;
  let applied = false;
  await app.vault.process(file, (data) => {
    const lines = data.split('\n');
    const lineText = lines[resolved.line];
    if (isNoteLocked(app, resolved.sourcePath)) return data;
    const { start, end, raw } = resolved.link;
    if (lineText?.slice(start, end) === raw) {
      lines[resolved.line] = lineText.slice(0, start) + text + lineText.slice(end);
      applied = true;
      return lines.join('\n');
    }
    // The line moved: find the raw link once elsewhere before giving up.
    const first = data.indexOf(raw);
    if (raw && first >= 0 && data.indexOf(raw, first + raw.length) < 0) {
      applied = true;
      return data.slice(0, first) + text + data.slice(first + raw.length);
    }
    return data;
  });
  if (!applied) new Notice('Image link changed; edit not applied.');
  return applied;
}

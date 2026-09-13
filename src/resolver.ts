/**
 * Maps a rendered image back to its link in the note source.
 *
 * Live Preview: CodeMirror knows where each widget sits (`posAtDOM`), so the
 * line is exact; the link is picked by offset with a path match as fallback.
 * Reading view: the post-processor context gives the section's line range;
 * the link is picked by normalized path and ordinal within that section.
 */
import { EditorView } from '@codemirror/view';
import { App, MarkdownPostProcessorContext, TFile } from 'obsidian';
import { findImageLinks, GrammarOptions, ImageLink, normalizePath } from './grammar';
import { EMBED_SELECTOR } from './dom';

export interface ResolvedLink {
  link: ImageLink;
  /** Vault path of the note that owns the link. */
  sourcePath: string;
  /** 0-based line index within the note. */
  line: number;
  /** Absolute character offsets when known (Live Preview). */
  from?: number;
  to?: number;
  view?: EditorView;
}

interface ReadingContext {
  sourcePath: string;
  sectionEl: HTMLElement;
  ctx: MarkdownPostProcessorContext;
}

const readingContexts = new WeakMap<HTMLElement, ReadingContext>();

export function rememberReadingContext(container: HTMLElement, sectionEl: HTMLElement, ctx: MarkdownPostProcessorContext): void {
  readingContexts.set(container, { sourcePath: ctx.sourcePath, sectionEl, ctx });
}

/** The link the embed renders, from its `src` attribute (wikilink text) or the img src (remote). */
export function embedPathOf(container: HTMLElement): string | null {
  const src = container.getAttribute('src');
  if (src) return normalizePath(src, 'wiki');
  const img = container.instanceOf(HTMLImageElement) ? container : container.querySelector('img');
  return img?.getAttribute('src') ?? null;
}

function samePath(linkDest: string, form: 'wiki' | 'md', embedPath: string): boolean {
  const a = normalizePath(linkDest, form).toLowerCase();
  const b = embedPath.toLowerCase();
  if (a === b) return true;
  // `src` on the embed is the raw link text; the link may carry a subpath or a
  // folder prefix that Obsidian resolved away. Compare basenames as a fallback.
  const base = (s: string) => s.slice(Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\')) + 1);
  return base(a) === base(b) || b.includes(encodeURI(base(a)));
}

/** Pure: pick the link on `lineText` that best matches the widget. Exported for tests. */
export function pickLinkOnLine(lineText: string, offset: number | null, embedPath: string | null, options: GrammarOptions): ImageLink | null {
  const links = findImageLinks(lineText, options);
  if (links.length === 0) return null;
  if (offset !== null) {
    const covering = links.find((l) => offset >= l.start && offset < l.end);
    if (covering) return covering;
    const at = links.find((l) => l.start === offset);
    if (at) return at;
  }
  if (embedPath) {
    const byPath = links.filter((l) => samePath(l.path, l.form, embedPath));
    if (byPath.length === 1) return byPath[0];
    if (byPath.length > 1 && offset !== null) {
      return byPath.reduce((best, l) => (Math.abs(l.start - offset) < Math.abs(best.start - offset) ? l : best));
    }
    if (byPath.length > 1) return byPath[0];
  }
  return links.length === 1 ? links[0] : null;
}

/**
 * Pure: within a section's lines, find the `ordinal`-th image link whose path
 * matches `embedPath` (0-based, document order). Exported for tests.
 */
export function pickLinkInSection(lines: string[], lineStart: number, embedPath: string | null, ordinal: number, options: GrammarOptions): { link: ImageLink; line: number } | null {
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    for (const link of findImageLinks(lines[i], options)) {
      if (embedPath && !samePath(link.path, link.form, embedPath)) continue;
      if (seen === ordinal) return { link, line: lineStart + i };
      seen++;
    }
  }
  return null;
}

export class Resolver {
  constructor(private readonly app: App, private readonly options: () => GrammarOptions) {}

  resolve(container: HTMLElement): ResolvedLink | null {
    const view = EditorView.findFromDOM(container);
    if (view) return this.resolveLive(view, container);
    return this.resolveReading(container);
  }

  private resolveLive(view: EditorView, container: HTMLElement): ResolvedLink | null {
    let pos: number;
    try {
      pos = view.posAtDOM(container);
    } catch {
      return null;
    }
    const line = view.state.doc.lineAt(pos);
    const link = pickLinkOnLine(line.text, pos - line.from, embedPathOf(container), this.options());
    if (!link) return null;
    const info = this.app.workspace.activeEditor;
    const sourcePath = info?.file?.path ?? this.app.workspace.getActiveFile()?.path ?? '';
    return { link, sourcePath, line: line.number - 1, from: line.from + link.start, to: line.from + link.end, view };
  }

  private resolveReading(container: HTMLElement): ResolvedLink | null {
    const remembered = readingContexts.get(container);
    if (!remembered) return null;
    const info = remembered.ctx.getSectionInfo(remembered.sectionEl);
    if (!info) return null;
    const embedPath = embedPathOf(container);
    const siblings = Array.from(remembered.sectionEl.querySelectorAll<HTMLElement>(EMBED_SELECTOR))
      .filter((el) => embedPath === null || embedPathOf(el) === embedPath);
    const ordinal = Math.max(0, siblings.indexOf(container));
    const lines = info.text.split('\n').slice(info.lineStart, info.lineEnd + 1);
    const picked = pickLinkInSection(lines, info.lineStart, embedPath, ordinal, this.options());
    if (!picked) return null;
    return { link: picked.link, sourcePath: remembered.sourcePath, line: picked.line };
  }

  fileFor(resolved: ResolvedLink): TFile | null {
    const file = this.app.vault.getAbstractFileByPath(resolved.sourcePath);
    return file instanceof TFile ? file : null;
  }
}

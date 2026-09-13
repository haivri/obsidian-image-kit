/**
 * Image link grammar: parse and serialize the alt segment of Obsidian image
 * links. Pure module — no `obsidian` import — so it runs under node --test.
 *
 * Layout state lives only here, in the link text:
 *
 *   ![[photo.jpg|Sunset over the bay|center|400]]
 *   ![Sunset over the bay|center|400](photo.jpg)
 *
 * Canonical order is `path | free text (caption first) | align | width`.
 * Width is last so Obsidian's native parser still reads it when this plugin
 * is absent; alignment sits before it so a plugin-less install shows nothing
 * worse than harmless alt text.
 */

export type Align = 'center' | 'right' | 'wrap-left' | 'wrap-right';
export type LinkForm = 'wiki' | 'md';

export interface ImageLink {
  form: LinkForm;
  /** Verbatim destination: wiki linktext before the first pipe, or the md `(...)` contents. */
  path: string;
  /** Raw alt-segment tokens in source order, pipes unescaped. */
  tokens: string[];
  width?: number;
  /** Only present when the source used WxH; never written back. */
  height?: number;
  align?: Align;
  /** The free-text token treated as the caption, if any. */
  caption?: string;
  /** Free-text tokens that are not the caption (ignore-list words, filename echoes). */
  free: string[];
  /** Source used `\|` (table rows). */
  escapedPipes: boolean;
  /** Full original link text, including `![[` / `![` ... `)`. */
  raw: string;
  /** Character offset of `raw` within the line it was found on. */
  start: number;
  end: number;
}

export interface Layout {
  width?: number | null;
  align?: Align | null;
  caption?: string | null;
}

export interface GrammarOptions {
  /** Free-text tokens that must never be treated as captions (e.g. `thumb`). */
  ignore?: string[];
  /** The line is a table row: serialize pipes as `\|`. */
  tableRow?: boolean;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif']);

const ALIGN_ALIASES: Record<string, Align | 'left'> = {
  left: 'left',
  center: 'center',
  centre: 'center',
  right: 'right',
  'wrap-left': 'wrap-left',
  'wrap-right': 'wrap-right',
  'float-left': 'wrap-left',
  'float-right': 'wrap-right'
};

/** Strips an Obsidian subpath (`#heading`, `#^block`) and md-link decorations, then decodes. */
export function normalizePath(dest: string, form: LinkForm): string {
  let p = dest.trim();
  if (form === 'md') {
    if (p.startsWith('<')) {
      const close = p.indexOf('>');
      p = close >= 0 ? p.slice(1, close) : p.slice(1);
    } else {
      // Drop an optional title: `path "title"` or `path 'title'`.
      const m = /^(\S+)\s+(["']).*\2\s*$/.exec(p);
      if (m) p = m[1];
    }
    try {
      p = decodeURIComponent(p);
    } catch {
      // Malformed escape — keep as-is.
    }
  }
  const hash = p.indexOf('#');
  if (hash >= 0) p = p.slice(0, hash);
  return p;
}

export function isImagePath(dest: string, form: LinkForm): boolean {
  const p = normalizePath(dest, form);
  let pathname = p;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p)) {
    try {
      pathname = new URL(p).pathname;
    } catch {
      pathname = p;
    }
  }
  const dot = pathname.lastIndexOf('.');
  if (dot < 0) return false;
  return IMAGE_EXTENSIONS.has(pathname.slice(dot + 1).toLowerCase());
}

/** `photo` for `dir/photo.jpg`; used to reject filename echoes as captions. */
export function basenameOf(dest: string, form: LinkForm): string {
  const p = normalizePath(dest, form);
  const slash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return slash >= 0 ? p.slice(slash + 1) : p;
}

/** Splits on unescaped pipes; reports whether any pipe was escaped. */
function splitPipes(text: string): { parts: string[]; escaped: boolean } {
  const parts: string[] = [];
  let current = '';
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\\' && text[i + 1] === '|') {
      parts.push(current);
      current = '';
      escaped = true;
      i++;
      continue;
    }
    if (ch === '|') {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return { parts, escaped };
}

function classify(tokens: string[], dest: string, form: LinkForm, options: GrammarOptions): Pick<ImageLink, 'width' | 'height' | 'align' | 'caption' | 'free'> {
  const ignore = new Set((options.ignore ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean));
  const base = basenameOf(dest, form).toLowerCase();
  const baseNoExt = base.replace(/\.[^.]+$/, '');
  let width: number | undefined;
  let height: number | undefined;
  let align: Align | undefined;
  let caption: string | undefined;
  const free: string[] = [];

  for (const rawToken of tokens) {
    const token = rawToken.trim();
    if (!token) continue;
    const lower = token.toLowerCase();
    const size = /^(\d+)(?:x(\d+))?$/.exec(lower);
    if (size) {
      width = Number(size[1]);
      height = size[2] === undefined ? undefined : Number(size[2]);
      continue;
    }
    const aliased = ALIGN_ALIASES[lower];
    if (aliased !== undefined) {
      align = aliased === 'left' ? undefined : aliased;
      continue;
    }
    if (caption === undefined && !ignore.has(lower) && lower !== base && lower !== baseNoExt) {
      caption = token;
      continue;
    }
    free.push(token);
  }
  return { width, height, align, caption, free };
}

/** Layout read from a rendered embed's `alt` attribute (the alt segment without the link around it). */
export function parseAltSegment(alt: string, dest: string, form: LinkForm, options: GrammarOptions = {}): Pick<ImageLink, 'width' | 'height' | 'align' | 'caption' | 'free'> {
  const { parts } = splitPipes(alt);
  return classify(parts, dest, form, options);
}

const WIKI_RE = /!\[\[([^\]]*?)\]\]/g;
// `![alt](dest)` — alt may not contain `]`; dest is `<...>` or a run without unescaped `)`.
const MD_RE = /!\[([^\]]*)\]\((<[^>]*>|(?:\\\)|[^)\s])+(?:\s+(?:"[^"]*"|'[^']*'))?)\)/g;

/** Every image link on one line, in order, with offsets. Non-image links are skipped. */
export function findImageLinks(line: string, options: GrammarOptions = {}): ImageLink[] {
  const found: ImageLink[] = [];
  const opts = { ...options, tableRow: options.tableRow ?? isTableRow(line) };

  for (const m of line.matchAll(WIKI_RE)) {
    const inner = m[1];
    const { parts, escaped } = splitPipes(inner);
    const path = parts[0];
    if (!isImagePath(path, 'wiki')) continue;
    const tokens = parts.slice(1);
    found.push({
      form: 'wiki',
      path,
      tokens,
      ...classify(tokens, path, 'wiki', opts),
      escapedPipes: escaped || Boolean(opts.tableRow),
      raw: m[0],
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length
    });
  }

  for (const m of line.matchAll(MD_RE)) {
    const alt = m[1];
    const path = m[2];
    if (!isImagePath(path, 'md')) continue;
    const { parts, escaped } = splitPipes(alt);
    const tokens = parts;
    found.push({
      form: 'md',
      path,
      tokens,
      ...classify(tokens, path, 'md', opts),
      escapedPipes: escaped || Boolean(opts.tableRow),
      raw: m[0],
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length
    });
  }

  return found.sort((a, b) => a.start - b.start);
}

/** A trimmed line starting with `|` that has at least one more unescaped `|`. */
export function isTableRow(line: string): boolean {
  const t = line.trim();
  if (!t.startsWith('|')) return false;
  return /[^\\]\|/.test(t.slice(1));
}

/** Removes characters that would break the link or the pipe grammar. */
export function sanitizeCaption(text: string, form: LinkForm): string {
  let s = text.replace(/[\r\n|[\]]/g, ' ');
  if (form === 'md') s = s.replace(/\)/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/** Serializes a link canonically: path | free (caption first) | align | width. */
export function serializeImageLink(link: Omit<ImageLink, 'raw' | 'start' | 'end' | 'tokens'>, options: GrammarOptions = {}): string {
  const segments: string[] = [];
  if (link.caption) segments.push(sanitizeCaption(link.caption, link.form));
  for (const f of link.free) if (f.trim()) segments.push(f.trim());
  if (link.align) segments.push(link.align);
  if (link.width !== undefined && link.width > 0) segments.push(String(Math.round(link.width)));

  const pipe = options.tableRow || link.escapedPipes ? '\\|' : '|';
  if (link.form === 'wiki') {
    const alt = segments.length ? pipe + segments.join(pipe) : '';
    return `![[${link.path.trim()}${alt}]]`;
  }
  return `![${segments.join(pipe)}](${link.path.trim()})`;
}

/**
 * Applies a layout change and returns the new link text. `null` removes a
 * value; `undefined` leaves it alone. Returns `link.raw` unchanged when the
 * effective layout is identical, so untouched links stay byte-identical.
 */
export function applyLayout(link: ImageLink, layout: Layout, options: GrammarOptions = {}): string {
  const next = {
    form: link.form,
    path: link.path,
    free: link.free,
    escapedPipes: link.escapedPipes,
    width: layout.width === undefined ? link.width : layout.width === null ? undefined : layout.width,
    align: layout.align === undefined ? link.align : layout.align === null ? undefined : layout.align,
    caption: layout.caption === undefined ? link.caption : layout.caption === null ? undefined : sanitizeCaption(layout.caption, link.form) || undefined
  };
  const same = next.width === link.width
    && next.align === link.align
    && (next.caption ?? '') === (link.caption ?? '')
    && link.height === undefined;
  if (same) return link.raw;
  return serializeImageLink(next, options);
}

/** Reset presentation without removing authored caption text or other alt tokens. */
export function resetLayout(link: ImageLink, options: GrammarOptions = {}): string {
  return applyLayout(link, { width: null, align: null }, options);
}

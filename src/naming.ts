/** Pure filename helpers for pasted and dropped images. */

export interface NamingContext {
  notename: string;
  original: string;
  now: Date;
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

export function timestampOf(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function dateOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Characters Obsidian refuses in filenames, plus link-breaking ones. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|#^[\]]/g, '').replace(/\s+/g, ' ').trim();
}

/** Expands `{notename}`, `{timestamp}`, `{date}`, `{time}`, `{original}`. Blank template keeps the original name. */
export function expandTemplate(template: string, ctx: NamingContext): string {
  const t = template.trim();
  if (!t) return sanitizeFilename(ctx.original) || 'image';
  const expanded = t
    .replace(/\{notename\}/gi, ctx.notename)
    .replace(/\{timestamp\}/gi, timestampOf(ctx.now))
    .replace(/\{date\}/gi, dateOf(ctx.now))
    .replace(/\{time\}/gi, timestampOf(ctx.now).slice(8))
    .replace(/\{original\}/gi, ctx.original);
  return sanitizeFilename(expanded) || 'image';
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/tiff': 'tif'
};

/** Extension from the original filename, else from the MIME type, lowercased. */
export function extensionFor(filename: string, mime: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot > 0 && dot < filename.length - 1) return filename.slice(dot + 1).toLowerCase();
  return MIME_EXT[mime.toLowerCase()] ?? 'png';
}

/** `photo` for `photo.jpg`. */
export function stemOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

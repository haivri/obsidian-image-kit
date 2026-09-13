/**
 * Obsidian DOM assumptions live here, in one place, verified against
 * Obsidian 1.13.7's bundle:
 *
 * Live Preview  `div.internal-embed.image-embed[src][alt] > div.image-wrapper > img`  (wikilink / local md)
 *               `div.image-embed > div.image-wrapper > img`                            (remote md link)
 * Reading view  `span.internal-embed.image-embed[src][alt] > img`                     (wikilink / local md)
 *               `img` inside a paragraph                                              (remote md link)
 */
import { Platform } from 'obsidian';

export type ViewMode = 'live' | 'reading';

export const EMBED_SELECTOR = '.internal-embed.image-embed, .image-embed';
export const CONTAINER_ATTR = 'data-ik';

/** The element Image Kit decorates and positions: the embed container, or the bare img for remote images in Reading view. */
export function containerOf(img: HTMLImageElement): HTMLElement {
  const embed = img.closest<HTMLElement>(EMBED_SELECTOR);
  return embed ?? img;
}

export function imageOf(container: HTMLElement): HTMLImageElement | null {
  if (container.instanceOf(HTMLImageElement)) return container;
  return container.querySelector('img');
}

export function viewModeOf(el: Element): ViewMode | null {
  if (el.closest('.markdown-reading-view, .markdown-preview-view')) return 'reading';
  if (el.closest('.markdown-source-view')) return 'live';
  return null;
}

/** Excludes icons, settings artwork, and images outside note panes. */
export function isNoteImage(img: HTMLImageElement): boolean {
  if (!img.closest('.workspace-leaf-content')) return false;
  return viewModeOf(img) !== null;
}

/** Inside `![[other note]]`: the image belongs to a different file than the one being edited. */
export function isInTransclusion(el: Element): boolean {
  return el.closest('.internal-embed.markdown-embed') !== null;
}

export function isInSimpleGallery(el: Element): boolean {
  return el.closest('.simple-gallery-root') !== null;
}

export function isEditable(container: HTMLElement): boolean {
  return !isInTransclusion(container) && !isInSimpleGallery(container) && viewModeOf(container) !== null;
}

export const isMobile = (): boolean => Platform.isMobile;

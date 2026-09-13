/**
 * Stamps Image Kit's classes, caption, and corner button onto a rendered
 * image embed. Idempotent: the decoration is keyed on the embed's alt text,
 * so re-running is free and a changed link re-decorates from scratch.
 * Everything is derived from the link text; nothing is stored in the DOM.
 */
import { setIcon } from 'obsidian';
import { embedPathOf } from './resolver';
import { GrammarOptions, parseAltSegment } from './grammar';
import { CONTAINER_ATTR, imageOf, isEditable } from './dom';

export interface DecorateOptions {
  grammar: GrammarOptions;
  showCaptions: boolean;
  showEditButton: boolean;
}

const ALIGN_CLASSES = ['ik-align-center', 'ik-align-right', 'ik-align-wrap-left', 'ik-align-wrap-right'];

export function altOf(container: HTMLElement): string {
  const attr = container.getAttribute('alt');
  if (attr !== null) return attr;
  const img = imageOf(container);
  return img?.getAttribute('alt') ?? '';
}

export function decorate(container: HTMLElement, options: DecorateOptions): void {
  const img = imageOf(container);
  if (!img) return;
  const alt = altOf(container);
  const editable = isEditable(container);
  const actions = container.querySelector<HTMLElement>(':scope > .embed-actions');
  const key = `2|${actions ? 'native' : 'fallback'}|${editable ? 'e' : 'r'}|${options.showCaptions ? 'c' : '-'}|${options.showEditButton ? 'b' : '-'}|${options.grammar.ignore?.join(',') ?? ''}|${alt}`;
  const path = embedPathOf(container) ?? img.src;
  const form = container.hasAttribute('src') ? 'wiki' : 'md';
  const layout = parseAltSegment(alt, path, form, options.grammar);
  const caption = options.showCaptions ? layout.caption : undefined;
  const captionEl = container.querySelector(':scope > .ik-caption');
  const captionMatches = captionEl?.classList.contains('ik-caption-editing') || (caption ? captionEl?.textContent === caption : !captionEl);
  const editMatches = !editable || !options.showEditButton || !!container.querySelector('.ik-edit-btn');
  if (container.getAttribute(CONTAINER_ATTR) === key && captionMatches && editMatches) return;
  container.setAttribute(CONTAINER_ATTR, key);

  container.classList.add('ik-embed');
  container.classList.remove(...ALIGN_CLASSES);
  if (layout.align) container.classList.add(`ik-align-${layout.align}`);

  container.querySelectorAll('.ik-caption, .ik-edit-btn').forEach((el) => el.remove());

  container.classList.toggle('ik-has-caption', Boolean(caption));
  if (caption) {
    const cap = container.createEl('figcaption', { cls: 'ik-caption', text: caption });
    cap.dataset.fullscreenCaption = 'show';
  }

  if (editable && options.showEditButton) {
    const btn = (actions ?? container).createEl('button', {
      cls: actions ? 'embed-action ik-edit-btn ik-edit-native' : 'ik-edit-btn ik-edit-fallback',
      attr: { type: 'button', 'aria-label': 'Edit image', title: 'Edit image' }
    });
    setIcon(btn, 'sliders-horizontal');
    const sourceButton = actions?.querySelector(':scope > .edit-block-button');
    if (sourceButton) actions?.insertBefore(btn, sourceButton);
  }
}

/** Forces every decorated embed under `root` to re-run on next decorate. */
export function invalidate(root: ParentNode): void {
  root.querySelectorAll(`[${CONTAINER_ATTR}]`).forEach((el) => el.removeAttribute(CONTAINER_ATTR));
}

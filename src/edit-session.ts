/**
 * One edit session at a time: a toolbar attached to a rendered image. Every
 * control produces a single link rewrite; the toolbar re-renders from the
 * link Obsidian re-renders, never from state held here.
 */
import { EventRef, Menu, Modal, Setting, setIcon, TFile } from 'obsidian';
import type ImageKitPlugin from './main';
import { Align, applyLayout, ImageLink, normalizePath, resetLayout } from './grammar';
import { EMBED_SELECTOR, imageOf, isMobile, viewModeOf } from './dom';
import { embedPathOf, ResolvedLink } from './resolver';
import { writeLink } from './writer';
import { isNoteLocked } from './lock';
import { followVisibleViewport } from './modal-viewport';
import { canUseDesktopActions, copyImage, openWithDefaultApp, revealInNavigation, showInSystemExplorer } from './file-actions';

const REATTACH_TIMEOUT_MS = 400;
const REATTACH_POLL_MS = 40;
const MIN_WIDTH = 32;

interface Key {
  root: HTMLElement;
  path: string | null;
  ordinal: number;
}

export class EditSession {
  private container: HTMLElement;
  private resolved: ResolvedLink;
  private readonly toolbar: HTMLDivElement;
  private closed = false;
  private widthInput!: HTMLInputElement;
  private chips: { el: HTMLButtonElement; isActive: (l: ImageLink) => boolean; isDisabled?: (l: ImageLink) => boolean }[] = [];
  private busy = false;
  private frame: number | null = null;
  private readonly resizeObserver: ResizeObserver;
  private readonly workspaceEvents: EventRef[] = [];
  private captionModal: Modal | null = null;
  private captionEditor: HTMLElement | null = null;

  private constructor(private readonly plugin: ImageKitPlugin, container: HTMLElement, resolved: ResolvedLink) {
    this.container = container;
    this.resolved = resolved;
    this.toolbar = document.body.createDiv({ cls: 'ik-toolbar', attr: { role: 'toolbar', 'aria-label': 'Image layout' } });
    this.resizeObserver = new ResizeObserver(this.onReposition);
    this.resizeObserver.observe(this.toolbar);
    this.resizeObserver.observe(container);
    this.build();
    this.mark(true);
    this.render();
    this.position();

    document.addEventListener('pointerdown', this.onPointerDownOutside, { capture: true });
    document.addEventListener('keydown', this.onKeyDown, { capture: true });
    document.addEventListener('scroll', this.onReposition, { capture: true, passive: true });
    window.addEventListener('resize', this.onReposition);
    window.visualViewport?.addEventListener('resize', this.onReposition);
    window.visualViewport?.addEventListener('scroll', this.onReposition);
    this.workspaceEvents.push(
      this.plugin.app.workspace.on('active-leaf-change', () => this.close()),
      this.plugin.app.workspace.on('layout-change', this.onReposition)
    );
  }

  static open(plugin: ImageKitPlugin, container: HTMLElement): EditSession | null {
    const resolved = plugin.resolver.resolve(container);
    if (!resolved || isNoteLocked(plugin.app, resolved.sourcePath, container)) return null;
    return new EditSession(plugin, container, resolved);
  }

  get link(): ImageLink {
    return this.resolved.link;
  }

  closeIfLocked(): void {
    if (isNoteLocked(this.plugin.app, this.resolved.sourcePath, this.container)) this.close();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    document.removeEventListener('pointerdown', this.onPointerDownOutside, { capture: true });
    document.removeEventListener('keydown', this.onKeyDown, { capture: true });
    document.removeEventListener('scroll', this.onReposition, { capture: true });
    window.removeEventListener('resize', this.onReposition);
    this.cancelCaptionEdit();
    this.captionModal?.close();
    this.resizeObserver.disconnect();
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    window.visualViewport?.removeEventListener('resize', this.onReposition);
    window.visualViewport?.removeEventListener('scroll', this.onReposition);
    this.workspaceEvents.forEach((ref) => this.plugin.app.workspace.offref(ref));
    this.mark(false);
    this.toolbar.remove();
    this.plugin.sessionClosed(this);
  }

  private mark(on: boolean): void {
    document.body.classList.toggle('ik-session', on);
    this.container.classList.toggle('ik-editing', on);
    this.container.querySelector('.ik-edit-btn')?.setAttribute('aria-expanded', String(on));
  }

  // ---- toolbar -----------------------------------------------------------

  private chip(parent: HTMLElement, label: string, opts: { icon?: string; title?: string; isActive?: (l: ImageLink) => boolean; isDisabled?: (l: ImageLink) => boolean; onClick: () => void }): HTMLButtonElement {
    const el = parent.createEl('button', { cls: 'ik-chip', attr: { type: 'button', 'aria-label': opts.title ?? label, title: opts.title ?? label } });
    if (opts.icon) {
      setIcon(el, opts.icon);
      if (label === 'Caption' || label === 'Done') el.createSpan({ cls: 'ik-chip-label', text: label });
    }
    else el.setText(label);
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      opts.onClick();
    });
    this.chips.push({ el, isActive: opts.isActive ?? (() => false), isDisabled: opts.isDisabled });
    return el;
  }

  private sep(parent: HTMLElement): void {
    parent.createDiv({ cls: 'ik-sep' });
  }

  private build(): void {
    const tb = this.toolbar;
    // Keep pointer events inside the toolbar from reaching the editor.
    tb.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
    });
    tb.addEventListener('click', (e) => e.stopPropagation());

    const sizes = tb.createDiv({ cls: 'ik-group ik-sizes', attr: { role: 'group', 'aria-label': 'Image size' } });
    this.plugin.settings.presets.forEach((p) => {
      this.chip(sizes, p.name, {
        title: `${p.name} (${p.width}px)`,
        isActive: (l) => l.width === p.width,
        onClick: () => void this.apply({ width: p.width })
      });
    });
    this.chip(sizes, 'Original', {
      title: 'Original size',
      isActive: (l) => l.width === undefined,
      onClick: () => void this.apply({ width: null })
    });

    const custom = tb.createDiv({ cls: 'ik-group ik-custom-size' });
    this.widthInput = custom.createEl('input', { cls: 'ik-width', attr: { type: 'number', min: String(MIN_WIDTH), step: '1', placeholder: 'Auto', 'aria-label': 'Width in pixels' } });
    custom.createSpan({ cls: 'ik-unit', text: 'px' });
    this.widthInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.commitWidthInput();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        this.nudge((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
      }
    });
    this.widthInput.addEventListener('change', () => void this.commitWidthInput());

    this.sep(tb);
    const align = tb.createDiv({ cls: 'ik-group ik-alignment', attr: { role: 'group', 'aria-label': 'Image alignment' } });
    this.chip(align, 'Left', { icon: 'align-left', title: 'Align left', isActive: (l) => l.align === undefined || l.align === 'wrap-left', onClick: () => void this.setSide('left') });
    this.chip(align, 'Center', { icon: 'align-center', title: 'Center', isActive: (l) => l.align === 'center', onClick: () => void this.apply({ align: 'center' }) });
    this.chip(align, 'Right', { icon: 'align-right', title: 'Align right', isActive: (l) => l.align === 'right' || l.align === 'wrap-right', onClick: () => void this.setSide('right') });
    this.chip(align, 'Wrap', {
      icon: 'wrap-text',
      title: 'Wrap text around the image',
      isActive: (l) => l.align === 'wrap-left' || l.align === 'wrap-right',
      isDisabled: (l) => l.align === 'center',
      onClick: () => void this.toggleWrap()
    });

    this.sep(tb);
    const actions = tb.createDiv({ cls: 'ik-group ik-actions' });
    this.chip(actions, 'Caption', { icon: 'captions', title: 'Edit caption', isActive: (l) => Boolean(l.caption), onClick: () => this.editCaption() });
    const more = this.chip(actions, 'More', { icon: 'ellipsis', title: 'More actions', onClick: () => this.openMenu(more) });
    this.chip(actions, 'Done', { icon: 'check', title: 'Done (Esc)', onClick: () => this.close() });
  }

  // ---- captions ----------------------------------------------------------------

  /** Edits the caption in place under the image; Enter commits, Escape cancels. */
  private editCaption(): void {
    if (this.captionEditor || this.captionModal) return;
    if (this.compact) {
      const modal = new Modal(this.plugin.app);
      this.captionModal = modal;
      modal.containerEl.addClass('ik-caption-modal-container');
      modal.modalEl.addClass('ik-caption-modal');
      modal.setTitle('Edit caption');
      const input = modal.contentEl.createEl('textarea', { cls: 'ik-caption-input', attr: { 'aria-label': 'Caption', rows: '4' } });
      input.value = this.link.caption ?? '';
      const footer = modal.modalEl.createDiv({ cls: 'ik-caption-footer' });
      new Setting(footer)
        .addButton((b) => b.setButtonText('Cancel').onClick(() => modal.close()))
        .addButton((b) => b.setButtonText('Save').setCta().onClick(() => {
          const caption = input.value.trim();
          modal.close();
          void this.apply({ caption: caption || null });
        }));
      const stopFollowingViewport = followVisibleViewport(modal.containerEl);
      modal.onClose = () => {
        stopFollowingViewport();
        this.captionModal = null;
      };
      modal.open();
      input.focus();
      return;
    }
    const current = this.link.caption ?? '';
    const existing = this.container.querySelector<HTMLElement>(':scope > .ik-caption');
    const editor = existing ?? this.container.createEl('figcaption', { cls: 'ik-caption' });
    editor.classList.add('ik-caption-editing');
    editor.contentEditable = 'true';
    editor.setText(current);
    editor.dataset.placeholder = 'Add a caption';
    editor.spellcheck = true;
    this.captionEditor = editor;

    const commit = () => {
      const text = editor.textContent?.trim() ?? '';
      this.cancelCaptionEdit();
      if (text !== current) void this.apply({ caption: text || null });
    };
    editor.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelCaptionEdit();
      }
    });
    editor.addEventListener('blur', () => { if (this.captionEditor === editor) commit(); });
    editor.addEventListener('pointerdown', (e) => e.stopPropagation());
    editor.addEventListener('click', (e) => e.stopPropagation());
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  }

  private cancelCaptionEdit(): void {
    const editor = this.captionEditor;
    if (!editor) return;
    this.captionEditor = null;
    editor.contentEditable = 'false';
    editor.classList.remove('ik-caption-editing');
    delete editor.dataset.placeholder;
    if (!this.link.caption) editor.remove();
    else editor.setText(this.link.caption);
  }

  // ---- more menu --------------------------------------------------------------------

  private imageFile(): TFile | null {
    const dest = normalizePath(this.link.path, this.link.form);
    const file = this.plugin.app.metadataCache.getFirstLinkpathDest(dest, this.resolved.sourcePath);
    return file instanceof TFile ? file : null;
  }

  private openMenu(anchor: HTMLElement): void {
    const app = this.plugin.app;
    const file = this.imageFile();
    const img = imageOf(this.container);
    const menu = new Menu();
    menu.addItem((i) => i.setTitle('Open fullscreen').setIcon('maximize').onClick(() => {
      if (img) {
        this.close();
        this.plugin.openViewer(img);
      }
    }));
    if (img) menu.addItem((i) => i.setTitle('Copy image').setIcon('copy').onClick(() => void copyImage(img)));
    if (file) {
      menu.addItem((i) => i.setTitle('Reveal in file explorer').setIcon('folder-open').onClick(() => revealInNavigation(app, file)));
      if (canUseDesktopActions()) {
        menu.addItem((i) => i.setTitle('Show in system explorer').setIcon('folder').onClick(() => showInSystemExplorer(app, file)));
        menu.addItem((i) => i.setTitle('Open in default app').setIcon('external-link').onClick(() => openWithDefaultApp(app, file)));
      }
    }
    menu.addSeparator();
    menu.addItem((i) => i.setTitle('Reset size and alignment').setIcon('rotate-ccw').onClick(() => void this.reset()));
    menu.addItem((i) => i.setTitle('Remove image from note').setIcon('minus-circle').onClick(() => {
      if (this.closed || isNoteLocked(app, this.resolved.sourcePath, this.container)) return this.close();
      void writeLink(app, this.resolved, '').then((ok) => { if (ok) this.close(); });
    }));
    const rect = anchor.getBoundingClientRect();
    menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
  }

  private render(): void {
    const l = this.link;
    for (const c of this.chips) {
      c.el.classList.toggle('is-active', c.isActive(l));
      c.el.setAttribute('aria-pressed', String(c.isActive(l)));
      c.el.disabled = c.isDisabled ? c.isDisabled(l) : false;
    }
    if (document.activeElement !== this.widthInput) this.widthInput.value = l.width === undefined ? '' : String(l.width);
  }

  // ---- intents -------------------------------------------------------------

  private async commitWidthInput(): Promise<void> {
    const raw = this.widthInput.value.trim();
    if (raw === '') {
      await this.apply({ width: null });
      return;
    }
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return this.render();
    await this.apply({ width: Math.max(MIN_WIDTH, n) });
  }

  private nudge(delta: number): void {
    const base = this.link.width ?? this.currentRenderedWidth();
    void this.apply({ width: Math.max(MIN_WIDTH, Math.round(base + delta)) });
  }

  private currentRenderedWidth(): number {
    const img = this.container.querySelector('img');
    return Math.round(img?.getBoundingClientRect().width ?? this.container.getBoundingClientRect().width);
  }

  private setSide(side: 'left' | 'right'): Promise<void> {
    const wrapped = this.link.align === 'wrap-left' || this.link.align === 'wrap-right';
    const next: Align | null = side === 'left' ? (wrapped ? 'wrap-left' : null) : (wrapped ? 'wrap-right' : 'right');
    return this.apply({ align: next });
  }

  private toggleWrap(): Promise<void> {
    const a = this.link.align;
    if (a === 'center') return Promise.resolve();
    const next: Align | null = a === 'wrap-left' ? null : a === 'wrap-right' ? 'right' : a === 'right' ? 'wrap-right' : 'wrap-left';
    return this.apply({ align: next });
  }

  private reset(): Promise<void> {
    return this.commit(resetLayout(this.link));
  }

  apply(layout: { width?: number | null; align?: Align | null; caption?: string | null }): Promise<void> {
    return this.commit(applyLayout(this.link, layout));
  }

  private async commit(text: string): Promise<void> {
    if (isNoteLocked(this.plugin.app, this.resolved.sourcePath, this.container)) return this.close();
    if (this.closed || this.busy || text === this.link.raw) return;
    this.busy = true;
    const key = this.keyOf(this.container);
    try {
      const ok = await writeLink(this.plugin.app, this.resolved, text);
      if (!ok) return this.close();
      const next = await this.reattach(key);
      if (!next) return this.close();
    } finally {
      this.busy = false;
    }
  }

  // ---- re-render survival ----------------------------------------------------

  private keyOf(container: HTMLElement): Key | null {
    const root = container.closest<HTMLElement>('.markdown-source-view, .markdown-reading-view, .markdown-preview-view');
    if (!root) return null;
    const path = embedPathOf(container);
    const ordinal = this.siblings(root, path).indexOf(container);
    return { root, path, ordinal: Math.max(0, ordinal) };
  }

  private siblings(root: HTMLElement, path: string | null): HTMLElement[] {
    return Array.from(root.querySelectorAll<HTMLElement>(EMBED_SELECTOR)).filter((el) => path === null || embedPathOf(el) === path);
  }

  /** Waits for Obsidian to re-render the embed, then adopts the new element. */
  private reattach(key: Key | null): Promise<HTMLElement | null> {
    if (!key) return Promise.resolve(null);
    const deadline = Date.now() + REATTACH_TIMEOUT_MS;
    return new Promise((resolve) => {
      const attempt = () => {
        if (this.closed) return resolve(null);
        this.plugin.decorateRoot(key.root);
        const candidate = this.siblings(key.root, key.path)[key.ordinal];
        const resolved = candidate ? this.plugin.resolver.resolve(candidate) : null;
        const settled = resolved && resolved.link.raw !== this.resolved.link.raw
          ? resolved
          : resolved && candidate !== this.container ? resolved : null;
        if (candidate && settled) {
          this.container.classList.remove('ik-editing');
          this.resizeObserver.unobserve(this.container);
          this.container = candidate;
          this.resizeObserver.observe(candidate);
          this.resolved = settled;
          this.container.classList.add('ik-editing');
          this.render();
          this.position();
          return resolve(candidate);
        }
        if (Date.now() > deadline) return resolve(null);
        window.setTimeout(attempt, REATTACH_POLL_MS);
      };
      window.requestAnimationFrame(attempt);
    });
  }

  // ---- geometry --------------------------------------------------------------

  private get compact(): boolean {
    return isMobile() || window.innerWidth < 600;
  }

  private readonly onReposition = (): void => {
    if (this.closed || this.frame !== null) return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.position();
    });
  };

  position(): void {
    if (this.closed) return;
    this.toolbar.classList.toggle('ik-toolbar-mobile', this.compact);
    const viewport = window.visualViewport;
    const viewportTop = viewport?.offsetTop ?? 0;
    const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
    if (this.compact) {
      this.toolbar.style.removeProperty('top');
      this.toolbar.style.removeProperty('left');
      this.toolbar.style.bottom = `${Math.max(0, window.innerHeight - viewportBottom)}px`;
      this.toolbar.style.maxHeight = `${Math.max(44, (viewport?.height ?? window.innerHeight) - 16)}px`;
      return;
    }
    this.toolbar.style.removeProperty('bottom');
    this.toolbar.style.removeProperty('max-height');
    const pane = this.container.closest<HTMLElement>('.workspace-leaf-content');
    const column = this.container.closest<HTMLElement>('.cm-content, .markdown-preview-sizer') ?? pane;
    const bounds = column?.getBoundingClientRect();
    const paneBounds = pane?.getBoundingClientRect();
    const rect = this.container.getBoundingClientRect();
    const tb = this.toolbar.getBoundingClientRect();
    const margin = 8;
    // The note column stays put when an image is resized or aligned. Always
    // remain above the image; pin at the pane edge instead of flipping below it.
    const left = Math.max(margin, Math.min(bounds?.left ?? rect.left, window.innerWidth - tb.width - margin));
    const topLimit = Math.max(viewportTop, paneBounds?.top ?? 0) + margin;
    const bottomLimit = Math.min(viewportBottom, paneBounds?.bottom ?? viewportBottom) - tb.height - margin;
    const top = Math.max(topLimit, Math.min(rect.top - tb.height - margin, bottomLimit));
    this.toolbar.style.top = `${Math.round(top)}px`;
    this.toolbar.style.left = `${Math.round(left)}px`;
  }

  // ---- input -----------------------------------------------------------------

  private readonly onPointerDownOutside = (e: PointerEvent): void => {
    const t = e.target;
    if (!(t instanceof Node)) return;
    if (t.instanceOf(Element) && t.closest('.menu, .modal-container')) return;
    if (this.toolbar.contains(t)) return;
    if (t.instanceOf(Element) && t.closest('.embed-action:not(.ik-edit-btn), .image-resize-corner')) {
      this.close();
      return;
    }
    if (this.container.contains(t)) return;
    // A tap on another image's edit button is handled by the plugin (it opens a new session).
    if (t.instanceOf(Element) && t.closest('.ik-edit-btn')) return;
    this.close();
  };

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (this.captionModal || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target === this.widthInput || e.target === this.captionEditor) return;
    if (e.key === 'Escape' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const handled = (() => {
      switch (e.key) {
        case 'ArrowRight': case 'ArrowUp': this.nudge(step); return true;
        case 'ArrowLeft': case 'ArrowDown': this.nudge(-step); return true;
        case '1': case '2': case '3': {
          const p = this.plugin.settings.presets[Number(e.key) - 1];
          if (p) void this.apply({ width: p.width });
          return true;
        }
        case '0': void this.reset(); return true;
        case 'c': this.editCaption(); return true;
        default: return false;
      }
    })();
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  /** True when this session belongs to the given editor mode (for view-switch cleanup). */
  isIn(mode: 'live' | 'reading'): boolean {
    return viewModeOf(this.container) === mode;
  }
}

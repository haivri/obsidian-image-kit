import { Editor, MarkdownPostProcessorContext, MarkdownView, Menu, Plugin } from 'obsidian';
import { decorate, invalidate } from './decorate';
import { EMBED_SELECTOR, isMobile } from './dom';
import { EditSession } from './edit-session';
import { Align, applyLayout, findImageLinks, GrammarOptions, ImageLink, resetLayout } from './grammar';
import { livePreviewExtension } from './lp-extension';
import { rememberReadingContext, Resolver } from './resolver';
import { registerPasteDrop } from './paste-drop';
import { isEditorLocked } from './lock';
import { ReadingImages } from './reading-view';
import { DEFAULT_SETTINGS, ignoreList, ImageKitSettings, ImageKitSettingTab, normalizeSettings } from './settings';
const LEGACY_VIEWER_ID = 'fullscreen-image';

interface PluginRegistry {
  plugins?: { enabledPlugins?: Set<string> };
}

export default class ImageKitPlugin extends Plugin {
  settings: ImageKitSettings = DEFAULT_SETTINGS;
  resolver!: Resolver;
  private session: EditSession | null = null;

  async onload(): Promise<void> {
    this.settings = normalizeSettings((await this.loadData()) as Partial<ImageKitSettings> | null);
    this.resolver = new Resolver(this.app, () => this.grammarOptions());
    this.addSettingTab(new ImageKitSettingTab(this.app, this));

    this.registerMarkdownPostProcessor((el, ctx) => this.postProcess(el, ctx));
    this.registerEditorExtension(livePreviewExtension(() => (root) => this.decorateRoot(root)));

    this.registerDomEvent(document, 'pointerdown', this.onPointerDown, { capture: true });
    this.registerDomEvent(document, 'click', this.onClick, { capture: true });

    this.registerCommands();
    this.registerEvent(this.app.workspace.on('editor-menu', (menu, editor) => this.onEditorMenu(menu, editor)));
    registerPasteDrop(this);
    this.registerEvent(this.app.metadataCache.on('changed', () => {
      if (this.session) this.session.closeIfLocked();
    }));

    this.app.workspace.onLayoutReady(() => this.redecorateAll());
  }

  onunload(): void {
    this.session?.close(false);
    document.body.classList.remove('ik-session');
    document.querySelectorAll('.ik-caption, .ik-edit-btn').forEach((el) => el.remove());
    document.querySelectorAll('[data-ik]').forEach((el) => {
      el.removeAttribute('data-ik');
      el.classList.remove('ik-embed', 'ik-has-caption', 'ik-editing', 'ik-align-center', 'ik-align-right', 'ik-align-wrap-left', 'ik-align-wrap-right');
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  grammarOptions(): GrammarOptions {
    return { ignore: ignoreList(this.settings) };
  }

  // ---- decoration ------------------------------------------------------------

  private postProcess(el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
    // Core initially supplies a plain internal-embed placeholder, adding the
    // image-embed class and image element only after postprocessing.
    const readingSelector = `${EMBED_SELECTOR}, .internal-embed[src]`;
    if (!el.matches(readingSelector) && !el.querySelector(readingSelector)) return;
    const update = () => {
      const embeds = Array.from(el.querySelectorAll<HTMLElement>(readingSelector));
      if (el.matches(readingSelector)) embeds.unshift(el);
      embeds.forEach(embed => rememberReadingContext(embed, el, ctx));
      this.decorateRoot(el);
    };
    ctx.addChild(new ReadingImages(el, update));
  }

  decorateRoot(root: HTMLElement): void {
    const options = {
      grammar: this.grammarOptions(),
      showCaptions: this.settings.showCaptions,
      showEditButton: !isMobile() || this.settings.mobileEditButton === 'always',
      onEditHover: (container: HTMLElement) => {
        // Hover opens controls without replacing an edit already in progress.
        if (!this.session) this.openSession(container);
      }
    };
    if (root.matches(EMBED_SELECTOR)) decorate(root, options);
    root.querySelectorAll<HTMLElement>(EMBED_SELECTOR).forEach((embed) => decorate(embed, options));
  }

  redecorateAll(): void {
    document.querySelectorAll<HTMLElement>('.workspace-leaf-content').forEach((leaf) => {
      invalidate(leaf);
      this.decorateRoot(leaf);
    });
  }

  // ---- sessions --------------------------------------------------------------

  openSession(container: HTMLElement): void {
    if (this.session && container.classList.contains('ik-editing')) return;
    this.session?.close();
    this.session = EditSession.open(this, container);
  }

  sessionClosed(session: EditSession): void {
    if (this.session === session) this.session = null;
  }

  private readonly onPointerDown = (evt: PointerEvent): void => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.ik-edit-btn')) {
      // Keep the editor from moving its selection or focus for this tap.
      evt.preventDefault();
      evt.stopPropagation();
    }
  };

  private readonly onClick = (evt: MouseEvent): void => {
    const target = evt.target;
    if (!(target instanceof Element)) return;
    const btn = target.closest<HTMLElement>('.ik-edit-btn');
    if (btn) {
      evt.preventDefault();
      evt.stopPropagation();
      evt.stopImmediatePropagation();
      const container = btn.closest<HTMLElement>(EMBED_SELECTOR) ?? btn.parentElement;
      if (container) this.openSession(container);
      return;
    }
  };

  /** Let the installed viewer or the native zoom control own image viewing. */
  openViewer(img: HTMLImageElement): void {
    if (this.legacyViewerEnabled()) {
      img.click();
      return;
    }
    const actions = img.closest(EMBED_SELECTOR)?.querySelector('.embed-actions');
    const zoom = actions?.querySelector<HTMLElement>('.embed-action:not(.edit-block-button):not(.ik-edit-btn)');
    (zoom ?? img).click();
  }

  /** Read-only probe: yield to the standalone Fullscreen Image plugin while it is enabled. */
  private legacyViewerEnabled(): boolean {
    const registry = this.app as unknown as PluginRegistry;
    return registry.plugins?.enabledPlugins?.has(LEGACY_VIEWER_ID) ?? false;
  }

  // ---- commands and menus ------------------------------------------------------

  /** The image link under the editor cursor, with its line, or null. */
  private linkAtCursor(editor: Editor): { link: ImageLink; line: number } | null {
    if (isEditorLocked(this.app, editor)) return null;
    const cursor = editor.getCursor();
    const text = editor.getLine(cursor.line);
    const links = findImageLinks(text, this.grammarOptions());
    const link = links.find((l) => cursor.ch >= l.start && cursor.ch <= l.end) ?? (links.length === 1 ? links[0] : undefined);
    return link ? { link, line: cursor.line } : null;
  }

  private writeAtCursor(editor: Editor, found: { link: ImageLink; line: number }, text: string): void {
    if (isEditorLocked(this.app, editor)) return;
    if (text === found.link.raw) return;
    editor.transaction({ changes: [{ from: { line: found.line, ch: found.link.start }, to: { line: found.line, ch: found.link.end }, text }] });
  }

  private cursorCommand(id: string, name: string, compute: (link: ImageLink) => string): void {
    this.addCommand({
      id,
      name,
      editorCheckCallback: (checking, editor) => {
        const found = this.linkAtCursor(editor);
        if (!found) return false;
        if (!checking) this.writeAtCursor(editor, found, compute(found.link));
        return true;
      }
    });
  }

  private registerCommands(): void {
    this.settings.presets.forEach((_, i) => {
      this.cursorCommand(`width-preset-${i + 1}`, `Image width: preset ${i + 1}`, (l) => applyLayout(l, { width: this.settings.presets[i].width }));
    });
    this.cursorCommand('width-original', 'Image width: original', (l) => applyLayout(l, { width: null }));
    const aligns: [string, string, Align | null][] = [
      ['align-left', 'Align image left', null],
      ['align-center', 'Center image', 'center'],
      ['align-right', 'Align image right', 'right'],
      ['align-wrap-left', 'Wrap text around image (left)', 'wrap-left'],
      ['align-wrap-right', 'Wrap text around image (right)', 'wrap-right']
    ];
    for (const [id, name, align] of aligns) this.cursorCommand(id, name, (l) => applyLayout(l, { align }));
    this.cursorCommand('reset-layout', 'Reset image size and alignment', (l) => resetLayout(l));

    this.addCommand({
      id: 'edit-image',
      name: 'Edit image layout',
      editorCheckCallback: (checking, editor, view) => {
        const found = this.linkAtCursor(editor);
        if (!found) return false;
        if (checking) return true;
        const container = this.containerForLine(view instanceof MarkdownView ? view : null, found.line);
        if (container) this.openSession(container);
        return true;
      }
    });
  }

  /** Finds the rendered embed for a source line in the active Live Preview view. */
  private containerForLine(view: MarkdownView | null, line: number): HTMLElement | null {
    const root = view?.contentEl ?? this.app.workspace.getActiveViewOfType(MarkdownView)?.contentEl;
    if (!root) return null;
    this.decorateRoot(root);
    for (const embed of Array.from(root.querySelectorAll<HTMLElement>(EMBED_SELECTOR))) {
      const resolved = this.resolver.resolve(embed);
      if (resolved && resolved.line === line) return embed;
    }
    return null;
  }

  private onEditorMenu(menu: Menu, editor: Editor): void {
    const found = this.linkAtCursor(editor);
    if (!found) return;
    const add = (title: string, icon: string, compute: (l: ImageLink) => string) => {
      menu.addItem((item) => item.setSection('image-kit').setTitle(title).setIcon(icon).onClick(() => this.writeAtCursor(editor, found, compute(found.link))));
    };
    for (const p of this.settings.presets) add(`Width: ${p.name}`, 'image', (l) => applyLayout(l, { width: p.width }));
    add('Width: original', 'image', (l) => applyLayout(l, { width: null }));
    add('Align left', 'align-left', (l) => applyLayout(l, { align: null }));
    add('Center', 'align-center', (l) => applyLayout(l, { align: 'center' }));
    add('Align right', 'align-right', (l) => applyLayout(l, { align: 'right' }));
    add('Wrap text (left)', 'wrap-text', (l) => applyLayout(l, { align: 'wrap-left' }));
    add('Wrap text (right)', 'wrap-text', (l) => applyLayout(l, { align: 'wrap-right' }));
    add('Reset size and alignment', 'rotate-ccw', (l) => resetLayout(l));
  }
}

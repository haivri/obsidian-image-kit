/**
 * Live Preview hook: after CodeMirror renders or re-renders image widgets,
 * decorate any embed that isn't decorated yet. Scans are viewport-bounded
 * and batched to one animation frame.
 */
import { EditorView, PluginValue, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { EMBED_SELECTOR } from './dom';

export type DecorateHook = (root: HTMLElement) => void;

export function livePreviewExtension(hook: () => DecorateHook) {
  return ViewPlugin.fromClass(class implements PluginValue {
    private frame: number | null = null;

    constructor(private readonly view: EditorView) {
      this.schedule();
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.viewportChanged || update.geometryChanged) this.schedule();
    }

    destroy(): void {
      if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    }

    private schedule(): void {
      if (this.frame !== null) return;
      this.frame = window.requestAnimationFrame(() => {
        this.frame = null;
        if (this.view.contentDOM.querySelector(EMBED_SELECTOR)) hook()(this.view.contentDOM);
      });
    }
  });
}

import { MarkdownRenderChild } from 'obsidian';

/** Reading view loads image elements after its Markdown postprocessors run. */
export class ReadingImages extends MarkdownRenderChild {
  constructor(container: HTMLElement, private readonly decorate: () => void) { super(container); }

  onload(): void {
    const win = this.containerEl.ownerDocument.defaultView!;
    let frame: number | null = null;
    const schedule = () => {
      if (frame !== null) return;
      frame = win.requestAnimationFrame(() => { frame = null; this.decorate(); });
    };
    const observer = new MutationObserver(schedule);
    observer.observe(this.containerEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['alt', 'src', 'width'] });
    this.register(() => {
      observer.disconnect();
      if (frame !== null) win.cancelAnimationFrame(frame);
    });
    schedule();
  }
}

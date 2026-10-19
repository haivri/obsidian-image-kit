const OPEN_DELAY_MS = 350;

/** Owns the single pending desktop hover, including its temporary listeners. */
export class HoverOpen {
  private cleanup: (() => void) | null = null;

  cancel(): void {
    this.cleanup?.();
    this.cleanup = null;
  }

  schedule(button: HTMLElement, open: () => void): void {
    this.cancel();
    if (!button.isConnected) return;
    const doc = button.ownerDocument;
    const win = doc.defaultView;
    if (!win) return;
    const cancel = () => this.cancel();
    const leave = (event: PointerEvent) => {
      if (event.target instanceof Node && button.contains(event.target)
        && (!(event.relatedTarget instanceof Node) || !button.contains(event.relatedTarget))) cancel();
    };
    const observer = new MutationObserver(() => {
      if (!button.isConnected) cancel();
    });
    const timer = win.setTimeout(() => {
      this.cancel();
      if (button.isConnected) open();
    }, OPEN_DELAY_MS);
    doc.addEventListener('pointerout', leave, true);
    doc.addEventListener('pointerdown', cancel, true);
    doc.addEventListener('pointercancel', cancel, true);
    doc.addEventListener('click', cancel, true);
    button.addEventListener('pointerleave', cancel);
    win.addEventListener('blur', cancel);
    observer.observe(doc.body, { childList: true, subtree: true });
    this.cleanup = () => {
      win.clearTimeout(timer);
      observer.disconnect();
      doc.removeEventListener('pointerout', leave, true);
      doc.removeEventListener('pointerdown', cancel, true);
      doc.removeEventListener('pointercancel', cancel, true);
      doc.removeEventListener('click', cancel, true);
      button.removeEventListener('pointerleave', cancel);
      win.removeEventListener('blur', cancel);
    };
  }
}

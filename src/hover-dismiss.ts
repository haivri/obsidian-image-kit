/** A hover preview becomes persistent as soon as the user interacts with it. */
export class HoverDismiss {
  private timer: number | null = null;
  private readonly win: Window;
  private stopped = false;

  constructor(
    private readonly doc: Document,
    private readonly contains: (target: EventTarget | null) => boolean,
    private readonly close: () => void
  ) {
    this.win = doc.defaultView ?? window;
    doc.addEventListener('pointerover', this.onOver, true);
    doc.addEventListener('pointerout', this.onOut, true);
    doc.addEventListener('pointerdown', this.onInteract, true);
    doc.addEventListener('focusin', this.onInteract, true);
  }

  /** Pinning and disposal both cancel pending dismissal and release listeners. */
  stop(): void {
    this.stopped = true;
    this.cancel();
    this.doc.removeEventListener('pointerover', this.onOver, true);
    this.doc.removeEventListener('pointerout', this.onOut, true);
    this.doc.removeEventListener('pointerdown', this.onInteract, true);
    this.doc.removeEventListener('focusin', this.onInteract, true);
  }

  private cancel(): void {
    if (this.timer !== null) this.win.clearTimeout(this.timer);
    this.timer = null;
  }

  private readonly onOver = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && this.contains(event.target)) this.cancel();
  };

  private readonly onOut = (event: PointerEvent): void => {
    if (this.stopped || event.pointerType !== 'mouse' || !this.contains(event.target) || this.contains(event.relatedTarget)) return;
    this.scheduleClose();
  };

  /** Also used after an async selection if the pointer has already left. */
  scheduleClose(): void {
    if (this.stopped) return;
    this.cancel();
    this.timer = this.win.setTimeout(() => {
      this.stop();
      this.close();
    }, 300);
  }

  private readonly onInteract = (event: Event): void => {
    if (this.contains(event.target)) this.stop();
  };
}

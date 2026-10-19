const CLOSE_DELAY_MS = 700;

/** Pointer dismissal; the edit session suspends it only for active edits. */
export class HoverDismiss {
  private timer: number | null = null;
  private readonly win: Window;
  private stopped = false;

  constructor(
    private readonly doc: Document,
    private readonly contains: (target: EventTarget | null) => boolean,
    private readonly close: () => void,
    private readonly pointInside: (x: number, y: number) => boolean = () => false
  ) {
    this.win = doc.defaultView ?? window;
    doc.addEventListener('pointerover', this.onOver, true);
    doc.addEventListener('pointerout', this.onOut, true);
    doc.addEventListener('pointermove', this.onMove, true);
  }

  /** Pinning and disposal both cancel pending dismissal and release listeners. */
  stop(): void {
    this.stopped = true;
    this.cancel();
    this.doc.removeEventListener('pointerover', this.onOver, true);
    this.doc.removeEventListener('pointerout', this.onOut, true);
    this.doc.removeEventListener('pointermove', this.onMove, true);
  }

  private cancel(): void {
    if (this.timer !== null) this.win.clearTimeout(this.timer);
    this.timer = null;
  }

  private readonly onOver = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && (this.contains(event.target) || this.pointInside(event.clientX, event.clientY))) this.cancel();
  };

  private readonly onOut = (event: PointerEvent): void => {
    if (this.stopped || event.pointerType !== 'mouse') return;
    if (!event.relatedTarget) {
      this.scheduleClose();
      return;
    }
    if (this.contains(event.relatedTarget) || this.pointInside(event.clientX, event.clientY)) {
      this.cancel();
      return;
    }
    this.scheduleClose();
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    if (this.contains(event.target) || this.pointInside(event.clientX, event.clientY)) this.cancel();
    else if (this.timer === null) this.scheduleClose();
  };

  /** Also used after an async selection if the pointer has already left. */
  scheduleClose(): void {
    if (this.stopped || this.timer !== null) return;
    this.timer = this.win.setTimeout(() => {
      this.stop();
      this.close();
    }, CLOSE_DELAY_MS);
  }
}

/** Actual controls plus short vertical bridges, never their enclosing rectangle. */
export function inHoverArea(x: number, y: number, elements: HTMLElement[]): boolean {
  const rects = elements.map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
  if (rects.some(rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)) return true;
  return rects.some(upper => rects.some(lower => {
    const gap = lower.top - upper.bottom;
    return gap > 0 && gap <= 16 && y >= upper.bottom && y <= lower.top
      && x >= Math.max(upper.left, lower.left) && x <= Math.min(upper.right, lower.right);
  }));
}

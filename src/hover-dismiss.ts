/** A hover preview becomes persistent as soon as the user interacts with it. */
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
    doc.addEventListener('pointerdown', this.onInteract, true);
    doc.addEventListener('focusin', this.onInteract, true);
  }

  /** Pinning and disposal both cancel pending dismissal and release listeners. */
  stop(): void {
    this.stopped = true;
    this.cancel();
    this.doc.removeEventListener('pointerover', this.onOver, true);
    this.doc.removeEventListener('pointerout', this.onOut, true);
    this.doc.removeEventListener('pointermove', this.onMove, true);
    this.doc.removeEventListener('pointerdown', this.onInteract, true);
    this.doc.removeEventListener('focusin', this.onInteract, true);
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
    if (this.contains(event.target)) this.scheduleClose();
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') return;
    if (this.contains(event.target) || this.pointInside(event.clientX, event.clientY)) this.cancel();
    else if (this.timer === null) this.scheduleClose();
  };

  /** Also used after an async selection if the pointer has already left. */
  scheduleClose(): void {
    if (this.stopped) return;
    this.cancel();
    this.timer = this.win.setTimeout(() => {
      this.stop();
      this.close();
    }, 700);
  }

  private readonly onInteract = (event: Event): void => {
    if (this.contains(event.target)) this.stop();
  };
}

/** The bounding area joins the image and toolbar without intercepting clicks. */
export function inHoverArea(x: number, y: number, elements: HTMLElement[]): boolean {
  const rects = elements.map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
  if (!rects.length) return false;
  return x >= Math.min(...rects.map(rect => rect.left)) && x <= Math.max(...rects.map(rect => rect.right))
    && y >= Math.min(...rects.map(rect => rect.top)) && y <= Math.max(...rects.map(rect => rect.bottom));
}

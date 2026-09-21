/** Dismiss controls on outside pointer/click events or when a modal takes over. */
export class SessionDismiss {
  private readonly observer: MutationObserver;

  constructor(
    private readonly doc: Document,
    private readonly contains: (target: EventTarget | null) => boolean,
    private readonly close: () => void
  ) {
    doc.addEventListener('pointerdown', this.onOutside, true);
    // Also cover keyboard/programmatic clicks that have no pointerdown.
    doc.addEventListener('click', this.onOutside, true);
    // Settings can open in a separate window rather than a DOM modal.
    doc.defaultView?.addEventListener('blur', this.onWindowBlur);
    this.observer = new MutationObserver(() => {
      if (modalIsOpen(doc)) this.close();
    });
    this.observer.observe(doc.body, { childList: true, subtree: true });
  }

  stop(): void {
    this.doc.removeEventListener('pointerdown', this.onOutside, true);
    this.doc.removeEventListener('click', this.onOutside, true);
    this.doc.defaultView?.removeEventListener('blur', this.onWindowBlur);
    this.observer.disconnect();
  }

  private readonly onOutside = (event: Event): void => {
    if (!this.contains(event.target)) this.close();
  };

  private readonly onWindowBlur = (): void => this.close();
}

export function modalIsOpen(doc: Document): boolean {
  return Boolean(doc.querySelector('.modal-container'));
}

export function canHoverEdit(doc: Document): boolean {
  return doc.hasFocus() && !modalIsOpen(doc) && !doc.querySelector('.menu');
}

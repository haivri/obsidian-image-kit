import { imageOf } from './dom';

/** Project a diagonal drag onto the image's aspect ratio. */
export function widthFromDrag(width: number, height: number, dx: number, dy: number, corner: 'start' | 'end', max: number): number {
  const ratio = height / Math.max(1, width);
  const delta = (dx + dy * ratio) / (1 + ratio * ratio);
  return Math.round(Math.max(32, Math.min(max, width + (corner === 'start' ? -delta : delta))));
}

export class TouchResize {
  pendingWidth: number | undefined;
  private readonly img: HTMLImageElement | null;
  private readonly grips: HTMLButtonElement[] = [];
  private readonly originalStyles: { el: HTMLElement; name: string; value: string; priority: string }[] = [];
  private drag: { pointer: number; x: number; y: number; width: number; height: number; max: number; previous: number | undefined; corner: 'start' | 'end' } | null = null;

  constructor(private readonly container: HTMLElement, private readonly canEdit: () => boolean, private readonly onPreview: (width: number) => void) {
    this.img = imageOf(container);
    if (!this.img) return;
    for (const [el, names] of [[this.img, ['width', 'height']], [container, ['width']]] as const) {
      for (const name of names) this.originalStyles.push({ el, name, value: el.style.getPropertyValue(name), priority: el.style.getPropertyPriority(name) });
    }
    container.classList.add('ik-touch-resizing');
    for (const corner of ['start', 'end'] as const) {
      const grip = container.ownerDocument.body.createEl('button');
      grip.className = `ik-resize-grip ik-resize-grip-${corner}`;
      grip.type = 'button';
      grip.setAttribute('aria-label', `Resize image from ${corner === 'start' ? 'top left' : 'bottom right'}`);
      grip.addEventListener('pointerdown', event => {
        if (!this.img || !this.canEdit() || this.drag || event.button !== 0) return;
        event.preventDefault(); event.stopPropagation();
        const rect = this.img.getBoundingClientRect();
        const column = container.closest('.cm-content, .markdown-preview-sizer');
        const available = column?.getBoundingClientRect().width ?? container.ownerDocument.defaultView!.innerWidth - 32;
        this.drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height,
          max: Math.max(32, available), previous: this.pendingWidth, corner };
        grip.setPointerCapture(event.pointerId);
      });
      grip.addEventListener('pointermove', event => {
        const drag = this.drag;
        if (!drag || drag.pointer !== event.pointerId || !this.canEdit()) return;
        event.preventDefault(); event.stopPropagation();
        this.preview(widthFromDrag(drag.width, drag.height, event.clientX - drag.x, event.clientY - drag.y, drag.corner, drag.max));
      });
      const finish = (event: PointerEvent) => {
        if (!this.drag || this.drag.pointer !== event.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        const previous = this.drag.previous;
        this.drag = null;
        if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
        if (event.type === 'pointercancel' || !this.canEdit()) {
          this.restore();
          this.pendingWidth = undefined;
          if (previous !== undefined && this.canEdit()) this.preview(previous);
          else if (this.img) this.onPreview(Math.round(this.img.getBoundingClientRect().width));
        }
      };
      grip.addEventListener('pointerup', finish);
      grip.addEventListener('pointercancel', finish);
      grip.addEventListener('lostpointercapture', finish);
      grip.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); });
      grip.addEventListener('keydown', event => {
        if (!this.img || !this.canEdit() || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const delta = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 10 : -10;
        this.preview(Math.max(32, Math.round(this.img.getBoundingClientRect().width + delta)));
      });
      container.ownerDocument.body.append(grip);
      this.grips.push(grip);
    }
    this.position();
  }

  contains(node: Node): boolean { return this.grips.some(grip => grip.contains(node)); }

  private preview(width: number): void {
    if (!this.img) return;
    this.pendingWidth = width;
    this.img.style.width = `${width}px`;
    this.img.setCssProps({ height: 'auto' });
    this.container.style.width = `${width}px`;
    this.position();
    this.onPreview(width);
  }

  position(): void {
    if (!this.img) return;
    const rect = this.img.getBoundingClientRect();
    const win = this.container.ownerDocument.defaultView!;
    this.grips.forEach((grip, index) => {
      grip.hidden = !this.container.isConnected || rect.bottom < 0 || rect.top > win.innerHeight;
      const x = index === 0 ? rect.left : rect.right;
      const y = index === 0 ? rect.top : rect.bottom;
      grip.style.left = `${Math.max(0, Math.min(win.innerWidth - 48, x - 24))}px`;
      grip.style.top = `${y - 24}px`;
    });
  }

  private restore(): void {
    for (const { el, name, value, priority } of this.originalStyles) {
      if (value) el.style.setProperty(name, value, priority);
      else el.style.removeProperty(name);
    }
  }

  destroy(): void {
    this.drag = null;
    this.grips.forEach(grip => grip.remove());
    this.container.classList.remove('ik-touch-resizing');
    this.restore();
  }
}

/** Keep a dialog inside the visible area as the soft keyboard opens or pans it. */
export function followVisibleViewport(container: HTMLElement): () => void {
  const win = container.ownerDocument.defaultView;
  if (!win) return () => {};
  const viewport = win.visualViewport;
  let frame: number | null = null;
  const update = () => {
    container.style.setProperty('--ik-dialog-top', `${viewport?.offsetTop ?? 0}px`);
    container.style.setProperty('--ik-dialog-left', `${viewport?.offsetLeft ?? 0}px`);
    container.style.setProperty('--ik-dialog-height', `${viewport?.height ?? win.innerHeight}px`);
    container.style.setProperty('--ik-dialog-width', `${viewport?.width ?? win.innerWidth}px`);
  };
  const schedule = () => {
    if (frame !== null) return;
    frame = win.requestAnimationFrame(() => { frame = null; update(); });
  };
  update();
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  win.addEventListener('resize', schedule);
  return () => {
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    win.removeEventListener('resize', schedule);
    if (frame !== null) win.cancelAnimationFrame(frame);
  };
}

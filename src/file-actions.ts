/**
 * Actions on the image file behind a link. Copy works everywhere through a
 * canvas; reveal/open are desktop-only. File deletion stays with Obsidian.
 */
import { App, Notice, Platform, TFile } from 'obsidian';

export async function copyImage(img: HTMLImageElement): Promise<void> {
  try {
    const canvas = createEl('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no canvas context');
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('encode failed');
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    new Notice('Image copied.');
  } catch (error) {
    console.error('[image-kit] copy failed', error);
    new Notice('Could not copy the image.');
  }
}

interface ExplorerView {
  revealInFolder?: (file: TFile) => void;
}

export function revealInNavigation(app: App, file: TFile): void {
  const leaf = app.workspace.getLeavesOfType('file-explorer')[0];
  const view = leaf?.view as unknown as ExplorerView | undefined;
  if (view?.revealInFolder) {
    void app.workspace.revealLeaf(leaf);
    view.revealInFolder(file);
  } else {
    new Notice('File explorer is not open.');
  }
}

interface DesktopApp {
  showInFolder?: (path: string) => void;
  openWithDefaultApp?: (path: string) => void;
}

export function showInSystemExplorer(app: App, file: TFile): void {
  (app as unknown as DesktopApp).showInFolder?.(file.path);
}

export function openWithDefaultApp(app: App, file: TFile): void {
  (app as unknown as DesktopApp).openWithDefaultApp?.(file.path);
}

export const canUseDesktopActions = (): boolean => Platform.isDesktopApp;

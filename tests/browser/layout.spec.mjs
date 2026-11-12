import { test, expect } from '@playwright/test';
import { buildSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const bundle = buildSync({
  stdin: { contents: "export { decorate } from './src/decorate'; export { EditSession } from './src/edit-session'; export { DEFAULT_SETTINGS } from './src/settings'; export { findImageLinks } from './src/grammar'; export { Platform } from 'obsidian';", resolveDir: root },
  bundle: true, format: 'iife', globalName: 'ImageKitTest', write: false, platform: 'browser',
  alias: { obsidian: `${root}tests/_stubs/obsidian.mjs` }
}).outputFiles[0].text;
const css = readFileSync(`${root}styles.css`, 'utf8');

async function setup(page, width = 390, height = 844) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<style>
    :root { --font-smallest: 12px; --font-smaller: 14px; --font-small: 15px; --font-text-size: 16px;
      --font-ui-small: 14px; --font-semibold: 600; --font-bold: 700; --background-primary: white;
      --background-modifier-border: #aaa; --text-muted: #555; --text-normal: #222; --radius-l: 12px; }
    body { margin: 0; font: 16px sans-serif; } .workspace-leaf-content { padding: 16px; }
    .image-embed img { width: 240px; height: 160px; background: #ccd9de; }
  </style><div class="workspace-leaf-content markdown-source-view"><div class="cm-content"><div class="image-embed" src="a.png" alt="Caption|240"><img alt="Test image"></div></div></div>`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(() => {
    HTMLElement.prototype.instanceOf = function (type) { return this instanceof type; };
    HTMLElement.prototype.createEl = function (tag, options = {}) {
      const el = document.createElement(tag); el.className = options.cls ?? '';
      if (options.text) el.textContent = options.text;
      for (const [key, value] of Object.entries(options.attr ?? {})) el.setAttribute(key, value);
      this.append(el); return el;
    };
    HTMLElement.prototype.createDiv = function (options) { return this.createEl('div', options); };
    HTMLElement.prototype.createSpan = function (options) { return this.createEl('span', options); };
    HTMLElement.prototype.setText = function (text) { this.textContent = text; };
    HTMLElement.prototype.addClass = function (cls) { this.classList.add(cls); };
    HTMLElement.prototype.removeClass = function (cls) { this.classList.remove(cls); };
    HTMLElement.prototype.setCssProps = function (props) { for (const [key, value] of Object.entries(props)) this.style.setProperty(key, value); };
    ImageKitTest.Platform.isMobile = true;
    ImageKitTest.Platform.isDesktopApp = false;
    window.embed = document.querySelector('.image-embed');
    window.options = { grammar: {}, showCaptions: true, showEditButton: true, captionAppearance: { ...ImageKitTest.DEFAULT_SETTINGS } };
    ImageKitTest.decorate(embed, options);
    const link = ImageKitTest.findImageLinks('![[a.png|Caption|240]]')[0];
    window.plugin = { settings: { ...ImageKitTest.DEFAULT_SETTINGS },
      app: { workspace: { on() {}, offref() {} } },
      resolver: { resolve: () => ({ sourcePath: 'note.md', line: 0, link }) },
      decorateRoot() {}, sessionClosed() {} };
    window.session = ImageKitTest.EditSession.open(plugin, embed);
  });
}

const cases = [
  { name: 'Android three-button navigation', inset: 48 },
  { name: 'Android gesture navigation', inset: 15 },
  { name: 'iPhone home indicator', inset: 34 },
  { name: 'Android native inset includes keyboard', inset: 379 },
  { name: 'iPhone keyboard with unchanged viewport', keyboard: 350, inset: 34 },
  { name: 'keyboard and viewport describe same obstruction', keyboard: 350, gap: 350, inset: 34 },
  { name: 'all three signals overlap', keyboard: 350, gap: 350, inset: 350 },
  { name: 'panned viewport', keyboard: 350, gap: 350, top: 60 },
  { name: 'short landscape', width: 844, height: 390, keyboard: 160, inset: 24 },
  { name: 'small phone', width: 320, height: 568, inset: 48 },
  { name: 'keyboard dismissed', inset: 0 }
];
for (const c of cases) {
  for (const caption of [false, true]) {
    test(`${c.name}: ${caption ? 'caption sheet' : 'toolbar'}`, async ({ page }, testInfo) => {
      await setup(page, c.width, c.height);
      if (caption) await page.evaluate(() => session.editCaption());
      // Let position's scheduled frame settle before injecting viewport measurements.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.evaluate(c => {
        document.body.style.setProperty('--safe-area-inset-bottom', `${c.inset ?? 0}px`);
        document.body.style.setProperty('--keyboard-height', `${c.keyboard ?? 0}px`);
        session.toolbar.style.setProperty('--ik-viewport-bottom-gap', `${c.gap ?? 0}px`);
        session.toolbar.style.setProperty('--ik-viewport-top', `${c.top ?? 0}px`);
      }, c);
      const expectedBottom = (c.height ?? 844) - Math.max(c.inset ?? 0, c.keyboard ?? 0, c.gap ?? 0);
      await expect.poll(async () => {
        const box = await page.locator('.ik-toolbar').boundingBox(); return Math.abs(box.y + box.height - expectedBottom);
      }).toBeLessThan(1);
      const controls = page.locator(caption ? '.ik-caption-sheet-header button' : '.ik-toolbar button, .ik-toolbar input');
      for (const control of await controls.all()) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(c.top ?? 0);
        expect(box.y + box.height).toBeLessThanOrEqual(expectedBottom - 10);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(c.width ?? 390);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      if (c.name === 'Android three-button navigation') await page.screenshot({ path: testInfo.outputPath('layout.png') });
    });
  }
}

test('native inset changes without any viewport event immediately move the sheet', async ({ page }) => {
  await setup(page); await page.evaluate(() => session.editCaption());
  for (const inset of [48, 379, 48, 0]) {
    await page.evaluate(inset => document.body.style.setProperty('--safe-area-inset-bottom', `${inset}px`), inset);
    await expect.poll(async () => { const b = await page.locator('.ik-toolbar').boundingBox(); return Math.round(b.y + b.height); }).toBe(844 - inset);
  }
});

test('rotation updates available height and keeps caption controls reachable', async ({ page }) => {
  await setup(page); await page.evaluate(() => session.editCaption());
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => document.body.style.setProperty('--safe-area-inset-bottom', '48px'));
  await expect.poll(async () => { const b = await page.locator('.ik-toolbar').boundingBox(); return Math.round(b.y + b.height); }).toBe(342);
  const save = await page.getByRole('button', { name: 'Save', exact: true }).boundingBox();
  expect(save.y).toBeGreaterThanOrEqual(0); expect(save.y + save.height).toBeLessThan(342);
});

test('all caption formats render in both view modes and preserve an active draft', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => session.close(false));
  for (const mode of ['markdown-source-view', 'markdown-reading-view']) {
    for (const style of ['normal', 'italic']) for (const bold of [false, true]) for (const strike of [false, true]) {
      for (const [size, pixels] of Object.entries({ default: 14, small: 12, medium: 15, large: 16 })) {
        await page.evaluate(({ mode, style, bold, strike, size }) => {
          document.querySelector('.workspace-leaf-content').className = `workspace-leaf-content ${mode}`;
          options.captionAppearance = { captionStyle: style, captionBold: bold, captionStrikethrough: strike, captionSize: size };
          ImageKitTest.decorate(embed, options);
        }, { mode, style, bold, strike, size });
        const cap = page.locator('.ik-caption');
        await expect(cap).toHaveCSS('font-style', style);
        await expect(cap).toHaveCSS('font-weight', bold ? '700' : '400');
        await expect(cap).toHaveCSS('text-decoration-line', strike ? 'line-through' : 'none');
        await expect(cap).toHaveCSS('font-size', `${pixels}px`);
      }
    }
  }
  await page.evaluate(() => {
    const cap = embed.querySelector('.ik-caption'); cap.classList.add('ik-caption-editing');
    cap.contentEditable = 'true'; cap.textContent = 'Unsaved draft'; cap.focus();
    options.captionAppearance.captionStyle = 'italic'; ImageKitTest.decorate(embed, options);
  });
  await expect(page.locator('.ik-caption')).toHaveText('Unsaved draft');
  await expect(page.locator('.ik-caption')).toBeFocused();
});

// Unlike the toolbar fixtures above, these images have real decoded content and
// no fixed CSS width. This exercises the intrinsic sizing cycle in issue #3.
for (const align of ['', 'center', 'right', 'wrap-left', 'wrap-right']) {
  for (const dimensions of ['', 'width="600" height="300"']) {
    test(`Reading SVG without link width: ${align || 'default'}, ${dimensions ? 'intrinsic dimensions' : 'viewBox only'}`, async ({ page }) => {
      await setup(page, 800, 700);
      await page.evaluate(() => session.close(false));
      await page.addStyleTag({ content: '.image-embed img { width: auto; height: auto; max-width: 100%; }' });
      await page.evaluate(({ align, dimensions }) => {
        const root = document.querySelector('.workspace-leaf-content');
        root.className = 'workspace-leaf-content markdown-reading-view';
        root.innerHTML = '<span class="image-embed" src="diagram.svg"><img></span>';
        window.embed = root.firstElementChild;
        embed.setAttribute('alt', `Odd Quarter-Wave Symmetry${align ? `|${align}` : ''}`);
        const img = embed.querySelector('img');
        img.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" ${dimensions}><rect width="600" height="300" fill="teal"/></svg>`)}`;
        ImageKitTest.decorate(embed, options);
      }, { align, dimensions });
      await page.locator('.image-embed img').evaluate(async img => { await img.decode(); ImageKitTest.decorate(embed, options); });
      for (const width of [800, 320, 800]) {
        await page.setViewportSize({ width, height: 700 });
        const limit = (width - 32) * (align.startsWith('wrap') ? 0.5 : 1);
        const expected = Math.min(dimensions ? 600 : 300, limit);
        const img = await page.locator('.image-embed img').boundingBox();
        const cap = await page.locator('.ik-caption').boundingBox();
        expect(img.width).toBeCloseTo(expected, 0);
        expect(img.height).toBeCloseTo(expected / 2, 0);
        expect(cap.width).toBeCloseTo(img.width, 0);
        expect(cap.y).toBeGreaterThanOrEqual(img.y + img.height);
        expect(cap.height).toBeLessThan(100);
      }
      // Explicit width and reset must not retain the automatic SVG basis.
      await page.evaluate(() => {
        embed.setAttribute('alt', 'Caption|200');
        embed.querySelector('img').setAttribute('width', '200');
        ImageKitTest.decorate(embed, options);
      });
      await expect(page.locator('.image-embed')).not.toHaveClass(/ik-svg-auto/);
      await page.evaluate(() => {
        embed.setAttribute('alt', 'Caption'); embed.querySelector('img').removeAttribute('width');
        ImageKitTest.decorate(embed, options);
      });
      await expect(page.locator('.image-embed')).toHaveClass(/ik-svg-auto/);
    });
  }
}

// Run through the Obsidian CLI against an installed build. Uses a disposable
// note and changes keyboard geometry only on this sheet, never on the app.
(async () => {
  const previous = app.workspace.activeLeaf;
  const file = await app.vault.create(`_image-kit-keyboard-check-${Date.now()}.md`,
    '# Keyboard check\n\n![[Plugin Showcase/Image Kit assets/mindful-lotus.jpg|Caption|480]]\n');
  const leaf = app.workspace.getLeaf('tab');
  const wasMobile = document.body.classList.contains('is-mobile');
  const wasPhone = document.body.classList.contains('is-phone');
  let session;
  try {
    await leaf.openFile(file);
    await new Promise(resolve => setTimeout(resolve, 300));
    const plugin = app.plugins.plugins['image-kit'];
    plugin.openSession(leaf.view.contentEl.querySelector('.image-embed'));
    session = plugin.session;
    if (!session) throw new Error('Test image did not render as an editable image');
    Object.defineProperty(session, 'compact', { value: true });
    session.position();
    const modalCount = document.querySelectorAll('.modal-container').length;
    session.editCaption();
    const container = session.toolbar;
    document.body.classList.add('is-mobile', 'is-phone');
    const layoutHeight = window.innerHeight;
    const cases = [
      { name: 'iOS keyboard overlays unchanged viewport', visibleHeight: layoutHeight, keyboard: layoutHeight - 390, top: 0, width: 390 },
      { name: 'both keyboard and viewport report the same occlusion', visibleHeight: 390, keyboard: layoutHeight - 390, top: 0, width: 390 },
      { name: 'viewport pans while native keyboard remains open', visibleHeight: 390, keyboard: layoutHeight - 440, top: 70, width: 390 },
      { name: 'short landscape space', visibleHeight: layoutHeight, keyboard: layoutHeight - 230, top: 0, width: 844 },
      { name: 'keyboard dismissed without viewport event', visibleHeight: layoutHeight, keyboard: 0, top: 0, width: 390 }
    ];
    const results = [];
    for (const c of cases) {
      // Deliberately do not fire a resize event. Native CSS can change alone.
      container.style.setProperty('--keyboard-height', `${c.keyboard}px`);
      container.style.setProperty('--ik-viewport-height', `${c.visibleHeight}px`);
      container.style.setProperty('--ik-viewport-top', `${c.top}px`);
      container.style.width = `${c.width}px`;
      container.style.setProperty('--ik-viewport-bottom-gap', `${Math.max(0, layoutHeight - c.top - c.visibleHeight)}px`);
      const bottom = Math.min(c.top + c.visibleHeight, layoutHeight - c.keyboard);
      const buttons = [...container.querySelectorAll('.ik-caption-sheet-header button')].map(button => {
        const rect = button.getBoundingClientRect();
        return { text: button.textContent, top: rect.top, bottom: rect.bottom, height: rect.height };
      });
      const bounds = container.getBoundingClientRect();
      results.push({ name: c.name, availableBottom: bottom, sheetBottom: bounds.bottom, buttons,
        passed: Math.abs(bounds.bottom - bottom) < 1 && buttons.length === 2 &&
          buttons.every(button => button.top >= c.top && button.bottom <= bottom - 12 && button.height >= 44) });
    }
    document.body.classList.toggle('is-mobile', wasMobile);
    document.body.classList.toggle('is-phone', wasPhone);
    app.workspace.setActiveLeaf(leaf, { focus: true });
    const noModal = document.querySelectorAll('.modal-container').length === modalCount;
    const original = leaf.view.editor.getValue();
    session.captionSheet.value = 'Canceled draft';
    container.querySelector('.ik-caption-sheet-header button').click();
    const canceled = leaf.view.editor.getValue() === original && !session.captionSheet;
    session.editCaption();
    session.captionSheet.value = 'Saved caption';
    container.querySelector('.ik-caption-sheet-header .mod-cta').click();
    await new Promise(resolve => setTimeout(resolve, 500));
    const saved = leaf.view.editor.getValue().includes('Saved caption');
    const beforeResize = leaf.view.editor.getValue();
    session.position();
    session.resizeGrips.preview(300);
    const previewOnly = leaf.view.editor.getValue() === beforeResize;
    const previewVisible = Math.round(leaf.view.contentEl.querySelector('.image-embed img').getBoundingClientRect().width) === 300;
    const grips = [...document.querySelectorAll('.ik-resize-grip')];
    const touchTargets = grips.length === 2 && grips.every(grip => grip.getBoundingClientRect().width >= 48 && grip.getBoundingClientRect().height >= 48);
    session.close();
    await new Promise(resolve => setTimeout(resolve, 150));
    const savedOnDone = leaf.view.editor.getValue().includes('|300]]');
    plugin.openSession(leaf.view.contentEl.querySelector('.image-embed'));
    session = plugin.session;
    Object.defineProperty(session, 'compact', { value: true });
    session.position();
    session.resizeGrips.preview(320);
    leaf.view.contentEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 150));
    const savedOnOutside = leaf.view.editor.getValue().includes('|320]]');
    plugin.openSession(leaf.view.contentEl.querySelector('.image-embed'));
    session = plugin.session;
    Object.defineProperty(session, 'compact', { value: true });
    session.position();
    session.resizeGrips.preview(350);
    await app.plugins.plugins['page-lock'].setLocked(file, true);
    await new Promise(resolve => setTimeout(resolve, 150));
    const lockCanceled = !document.querySelector('.ik-resize-grip') && leaf.view.editor.getValue().includes('|320]]');
    const workflow = { noModal, canceled, saved, previewOnly, previewVisible, touchTargets, savedOnDone, savedOnOutside, lockCanceled };
    return { version: plugin.manifest.version, passed: results.every(r => r.passed) && Object.values(workflow).every(Boolean), cases: results, workflow };
  } finally {
    document.body.classList.toggle('is-mobile', wasMobile);
    document.body.classList.toggle('is-phone', wasPhone);
    session?.close();
    leaf.detach();
    await app.fileManager.trashFile(file);
    if (previous) app.workspace.setActiveLeaf(previous, { focus: true });
  }
})()

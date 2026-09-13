// Run through the Obsidian CLI against an installed build. Uses a disposable
// note and changes keyboard geometry only on this dialog, never on the app.
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
    session.editCaption();
    const container = session.captionModal.containerEl;
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
      container.style.setProperty('--ik-dialog-height', `${c.visibleHeight}px`);
      container.style.setProperty('--ik-dialog-top', `${c.top}px`);
      container.style.setProperty('--ik-dialog-width', `${c.width}px`);
      const bottom = Math.min(c.top + c.visibleHeight, layoutHeight - c.keyboard);
      const buttons = [...container.querySelectorAll('.ik-caption-footer button')].map(button => {
        const rect = button.getBoundingClientRect();
        return { text: button.textContent, top: rect.top, bottom: rect.bottom, height: rect.height };
      });
      const bounds = container.getBoundingClientRect();
      results.push({ name: c.name, availableBottom: bottom, dialogBottom: bounds.bottom, buttons,
        passed: Math.abs(bounds.bottom - bottom) < 1 && buttons.length === 2 &&
          buttons.every(button => button.top >= c.top && button.bottom <= bottom - 12 && button.height >= 44) });
    }
    return { version: plugin.manifest.version, passed: results.every(r => r.passed), cases: results };
  } finally {
    document.body.classList.toggle('is-mobile', wasMobile);
    document.body.classList.toggle('is-phone', wasPhone);
    session?.close();
    leaf.detach();
    await app.fileManager.trashFile(file);
    if (previous) app.workspace.setActiveLeaf(previous, { focus: true });
  }
})()

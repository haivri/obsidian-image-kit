// Render the same captioned, centered images in both modes without modifying user notes.
(async () => {
  const previous = app.workspace.activeLeaf;
  const file = await app.vault.create(`_image-kit-reading-check-${Date.now()}.md`, [
    '# Reading check', '',
    '![[Plugin Showcase/Image Kit assets/mindful-lotus.jpg|Lotus caption|center|240]]', '',
    '![Ocean caption|center|240](Plugin%20Showcase/Image%20Kit%20assets/mindful-ocean.jpg)', ''
  ].join(String.fromCharCode(10)));
  const leaf = app.workspace.getLeaf('tab');
  const results = [];
  try {
    for (const mode of ['preview', 'source', 'preview']) {
      await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode, source: false } });
      app.workspace.setActiveLeaf(leaf, { focus: true });
      await new Promise(resolve => setTimeout(resolve, 400));
      const root = leaf.view.contentEl.querySelector(mode === 'preview' ? '.markdown-reading-view' : '.markdown-source-view');
      const images = [...root.querySelectorAll('.image-embed')].map(embed => {
        const img = embed.querySelector('img');
        const rect = img.getBoundingClientRect();
        const parent = embed.parentElement.getBoundingClientRect();
        const caption = embed.querySelector('.ik-caption');
        return { caption: caption?.textContent, captionVisible: !!caption && caption.getBoundingClientRect().height > 0,
          centered: Math.abs((rect.left + rect.right) / 2 - (parent.left + parent.right) / 2) < 2,
          width: rect.width, classes: embed.className };
      });
      results.push({ mode, images, passed: images.length === 2 && images.every(image => image.captionVisible && image.centered) });
    }
    return { passed: results.every(result => result.passed), results };
  } finally {
    leaf.detach();
    await app.fileManager.trashFile(file);
    if (previous) app.workspace.setActiveLeaf(previous, { focus: true });
  }
})()

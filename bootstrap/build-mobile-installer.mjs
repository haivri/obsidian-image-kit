import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function installerFor(files) {
  const manifest = JSON.parse(files['manifest.json']);
  const payload = Object.fromEntries(Object.entries(files).map(([name, text]) => [name, {
    base64: Buffer.from(text).toString('base64'),
    sha256: createHash('sha256').update(text).digest('hex')
  }]));
  return `# Install Image Kit ${manifest.version} on mobile

1. Sync this note and the Image Kit showcase to your phone.
2. Enable **Templater** in Community plugins. Obsidian 1.13 or newer is required.
3. Duplicate this note and open the copy, keeping this original for another device.
4. Run **Templater: Replace templates in the active file** from the command palette.
5. Wait for the installation notice. Confirm Image Kit ${manifest.version} is enabled in
   Community plugins, then open **Plugin Showcase/Image Kit - Quiet details**.

The installer contains the three compiled plugin files. It needs no download, account token,
desktop command, or hidden-folder access. It preserves existing Image Kit settings and backs
up previous runtime files under your vault configuration folder before replacing them.

%%
<%*
const payload = ${JSON.stringify(payload)};
const id = 'image-kit';
const adapter = app.vault.adapter;
const directory = app.vault.configDir + '/plugins/' + id;
const previous = new Map();
const wasEnabled = app.plugins.enabledPlugins.has(id);
let changed = false;
async function mkdir(path) {
  let part = '';
  for (const segment of path.split('/')) {
    part = part ? part + '/' + segment : segment;
    if (!await adapter.exists(part)) await adapter.mkdir(part);
  }
}
try {
  if (!tp.obsidian.requireApiVersion('1.13.0')) throw new Error('Update Obsidian to 1.13 or newer first.');
  const files = {};
  for (const [name, value] of Object.entries(payload)) {
    const bytes = Uint8Array.from(atob(value.base64), c => c.charCodeAt(0));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== value.sha256) throw new Error('Installer checksum failed: ' + name);
    files[name] = new TextDecoder().decode(bytes);
    const path = directory + '/' + name;
    previous.set(name, await adapter.exists(path) ? await adapter.read(path) : null);
  }
  const backup = app.vault.configDir + '/image-kit-installer-backups/' + Date.now();
  if ([...previous.values()].some(value => value !== null)) {
    await mkdir(backup);
    for (const [name, value] of previous) if (value !== null) await adapter.write(backup + '/' + name, value);
  }
  await mkdir(directory);
  changed = true;
  await app.plugins.disablePlugin(id);
  for (const [name, value] of Object.entries(files)) await adapter.write(directory + '/' + name, value);
  await app.plugins.loadManifests();
  await app.plugins.enablePluginAndSave(id);
  if (!app.plugins.plugins[id]) throw new Error('Obsidian could not load Image Kit.');
  new tp.obsidian.Notice('Image Kit ${manifest.version} installed. Open the showcase to take your screenshots.', 10000);
} catch (error) {
  if (changed) {
    await app.plugins.disablePluginAndSave(id);
    for (const [name, value] of previous) {
      const path = directory + '/' + name;
      if (value !== null) await adapter.write(path, value);
      else if (await adapter.exists(path)) await adapter.remove(path);
    }
    await app.plugins.loadManifests();
    if (wasEnabled) await app.plugins.enablePluginAndSave(id);
  }
  new tp.obsidian.Notice('Image Kit installation failed: ' + error.message, 15000);
  throw error;
}
%>
%%
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = Object.fromEntries(['main.js', 'manifest.json', 'styles.css'].map(name =>
    [name, readFileSync(new URL('../' + name, import.meta.url), 'utf8')]));
  if (!process.argv[2]) throw new Error('Provide an output Markdown path. Run npm run build first.');
  writeFileSync(process.argv[2], installerFor(files));
}

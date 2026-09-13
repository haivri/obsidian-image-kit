// Bundles a pure src/*.ts module with esbuild and imports it, so node --test
// can exercise TypeScript without a build step or a tsconfig for tests.
import { buildSync } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export async function loadModule(name) {
  const result = buildSync({
    entryPoints: [new URL(`../src/${name}.ts`, import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    external: ['@codemirror/*'],
    alias: { obsidian: new URL('./_stubs/obsidian.mjs', import.meta.url).pathname }
  });
  const dir = new URL('./.out/', import.meta.url).pathname;
  mkdirSync(dir, { recursive: true });
  const file = `${dir}${name}.mjs`;
  writeFileSync(file, result.outputFiles[0].text);
  return import(pathToFileURL(file).href + `?t=${Date.now()}`);
}

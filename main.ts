// main.ts — Solmarina's entry program. Copies game/ and screenshots/ into
// the output directory and writes dossier.json with buildDossier from the
// kit's vendored library, exactly as the scorer rebuilds it. Runs twice and
// must write identical bytes both times, so the copy walks entries in
// sorted order and the output directory is rebuilt from scratch each run.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(import.meta.dirname);
const outputDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

function copyTreeSorted(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src).sort()) {
    const from = join(src, name);
    const to = join(dest, name);
    if (statSync(from).isDirectory()) copyTreeSorted(from, to);
    else cpSync(from, to);
  }
}

function main() {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    throw new Error('game/ directory is missing from the repository');
  }
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html is missing from the repository');
  }
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  copyTreeSorted(gameDir, join(outputDir, 'game'));
  if (existsSync(shotsDir) && statSync(shotsDir).isDirectory()) {
    copyTreeSorted(shotsDir, join(outputDir, 'screenshots'));
  }
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  // A human-readable trace of what was handed in, for the run log.
  const indexBytes = readFileSync(join(gameDir, 'index.html')).length;
  console.log(`Solmarina handed in: game/index.html ${indexBytes} bytes, dossier written to dossier.json`);
}

main();

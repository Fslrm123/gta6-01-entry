// main.ts — Solmarina's entry program. Copies game/ and screenshots/ into
// the output directory and writes dossier.json with buildDossier from the
// kit's vendored library, exactly as the scorer rebuilds it. It runs twice
// and must write identical bytes both times, so the copy walks entries in
// sorted order and the output directory is rebuilt from scratch each run.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
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
    throw new Error('game/: no such directory');
  }
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    throw new Error('screenshots/: no such directory');
  }
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  copyTreeSorted(gameDir, join(outputDir, 'game'));
  copyTreeSorted(shotsDir, join(outputDir, 'screenshots'));
  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  const files = readdirSync(join(outputDir, 'game')).length;
  console.log(`SOLMARINA dossier written: ${dossier.length} bytes, game/ top-level entries ${files}`);
}

main();

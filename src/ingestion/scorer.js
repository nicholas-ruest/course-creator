/**
 * scorer.js — File importance scoring for token budget management.
 *
 * Assigns a numeric importance score to each file based on its path, name,
 * extension, and size. Higher scores indicate greater teaching value.
 * Used to prioritise which files to read within the token budget.
 *
 * See: ADR-007  (File Importance Scoring for Token Budget Management)
 *      DDD-003  (Ingestion Pipeline — "File Importance Scorer")
 */

import path from 'node:path';

/**
 * Score a single file's importance for course generation.
 *
 * @param {string} filePath — absolute path to the file
 * @param {string} repoRoot — absolute path to the repository root
 * @param {number} [fileSize=0] — file size in bytes (used for large-file penalty)
 * @returns {number} importance score (higher = more valuable)
 */
export function scoreFile(filePath, repoRoot, fileSize = 0) {
  const rel = path.relative(repoRoot, filePath);
  const name = path.basename(filePath);
  const ext = path.extname(filePath);
  const dir = path.dirname(rel);
  const relLower = rel.toLowerCase();
  const nameLower = name.toLowerCase();

  let score = 0;

  // ── Positive signals ──────────────────────────────────────────────────

  // Entry points (+100)
  if (/^(index|main|app|server|lib)\.(js|jsx|ts|tsx|mjs|cjs|py|rs|go)$/.test(nameLower)) {
    score += 100;
  }
  if (nameLower === 'mod.rs' || nameLower === '__init__.py') {
    score += 100;
  }

  // README and docs (+90 / +70)
  if (/^readme/i.test(name)) score += 90;
  if (/^(contributing|architecture|design)/i.test(name)) score += 70;

  // Configuration files (+80)
  if (
    /^(package\.json|tsconfig.*\.json|pyproject\.toml|cargo\.toml|go\.mod|setup\.py|setup\.cfg|composer\.json|gemfile|makefile|cmake)$/i.test(name)
  ) {
    score += 80;
  }

  // Source directories (+60)
  if (/^(src|lib)(\/|$)/i.test(relLower)) score += 60;

  // Core / internal / pkg directories (+50)
  if (/^(core|internal|pkg)(\/|$)/i.test(relLower)) score += 50;

  // Type definitions (+50)
  if (ext === '.d.ts' || /types\.(ts|py)$/i.test(name) || /interfaces\.(ts|java)$/i.test(name)) {
    score += 50;
  }
  // .d.ts in name but ext was .ts — handle compound extensions
  if (name.endsWith('.d.ts')) score += 50;

  // Examples / samples (+40)
  if (/^(examples?|samples?|demo)(\/|$)/i.test(relLower)) score += 40;

  // Documentation (+35)
  if (/^docs?(\/|$)/i.test(relLower)) score += 35;

  // Test files (+30)
  if (/\.(test|spec)\./i.test(name) || /^(tests?|__tests__)(\/|$)/i.test(relLower)) {
    score += 30;
  }

  // CI/CD (+15)
  if (/^\.github(\/|$)/i.test(relLower)) score += 15;

  // Changelog, release notes (+10)
  if (/^(changelog|changes|release|history)/i.test(name)) score += 10;

  // ── Negative signals ──────────────────────────────────────────────────

  // Generated output (-100)
  if (/^(dist|build|out|\.next|\.nuxt|target|coverage)(\/|$)/i.test(relLower)) {
    score -= 100;
  }

  // Vendor / third-party (-200)
  if (/^(node_modules|vendor|third_party|\.yarn|\.pnp)(\/|$)/i.test(relLower) ||
      /(^|\/)(node_modules|vendor)(\/|$)/i.test(relLower)) {
    score -= 200;
  }

  // Lock files (-150)
  if (/lock\.(json|yaml|toml)$/i.test(name) || nameLower === 'cargo.lock' || nameLower === 'yarn.lock' || nameLower === 'pnpm-lock.yaml') {
    score -= 150;
  }

  // Minified files (-200)
  if (/\.min\.(js|css)$/.test(nameLower)) score -= 200;

  // Large files — diminishing returns
  if (fileSize > 100000) score -= 50;
  else if (fileSize > 50000) score -= 20;

  return score;
}

/**
 * Select files within a token budget, sorted by importance score.
 *
 * @param {{ path: string, score: number, size: number }[]} scoredFiles
 * @param {number} [tokenBudget=100000]
 * @returns {{ selected: object[], remaining: number, skipped: number }}
 */
export function selectFilesWithinBudget(scoredFiles, tokenBudget = 100000) {
  const sorted = [...scoredFiles].sort((a, b) => b.score - a.score);
  const selected = [];
  let remaining = tokenBudget;
  let skipped = 0;

  for (const file of sorted) {
    if (file.score < 0) {
      skipped++;
      continue;
    }

    const estimatedTokens = Math.ceil(file.size / 4);

    if (estimatedTokens > remaining) {
      skipped++;
      continue;
    }

    selected.push(file);
    remaining -= estimatedTokens;
  }

  return { selected, remaining, skipped };
}

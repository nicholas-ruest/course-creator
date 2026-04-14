/**
 * extractor.js — ContentBundle assembly from a workspace directory.
 *
 * Reads and prioritises files from an already-fetched workspace (cloned repo,
 * fetched docs, or local directory) into the unified ContentBundle consumed
 * by all downstream components.
 *
 * See: ADR-004  (Multi-Source Ingestion with Unified ContentBundle)
 *      DDD-003  (Ingestion Pipeline — "ContentBundle Assembly")
 */

import fs from 'node:fs';
import path from 'node:path';
import { scoreFile, selectFilesWithinBudget } from './scorer.js';

// ── Constants ───────────────────────────────────────────────────────────────

const SOURCE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.pyi',
  '.rs',
  '.go',
  '.java', '.kt', '.kts',
  '.rb',
  '.c', '.h', '.cpp', '.hpp',
  '.md', '.mdx', '.rst', '.txt',
  '.json', '.yaml', '.yml', '.toml',
]);

const IGNORE_DIRS = new Set([
  'node_modules', 'vendor', '.git', '__pycache__', '.next', '.nuxt',
  'dist', 'build', 'out', 'target', 'coverage', '.yarn', '.pnp',
  'third_party', '.cache', '.turbo',
]);

const IGNORE_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock',
]);

const ENTRY_POINT_PATTERN = /^(index|main|app|server|lib|mod)\.(js|jsx|ts|tsx|mjs|cjs|py|rs|go)$/i;

const CONFIG_FILES = [
  'package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod',
  'tsconfig.json', 'setup.py', 'setup.cfg', 'composer.json',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively walk a directory, respecting ignore patterns and depth limit.
 * Returns flat array of { path, name, size, isDirectory }.
 */
function walkDir(dirPath, maxDepth = 4, currentDepth = 0) {
  const results = [];

  if (currentDepth > maxDepth) return results;

  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;

      results.push({
        path: fullPath,
        name: entry.name,
        size: 0,
        isDirectory: true,
      });

      results.push(...walkDir(fullPath, maxDepth, currentDepth + 1));
    } else {
      if (IGNORE_FILES.has(entry.name)) continue;
      if (entry.name.endsWith('.min.js') || entry.name.endsWith('.min.css')) continue;
      if (entry.name.endsWith('.map')) continue;
      if (entry.name.endsWith('.pyc')) continue;

      let size = 0;
      try {
        size = fs.statSync(fullPath).size;
      } catch {
        continue;
      }

      results.push({
        path: fullPath,
        name: entry.name,
        size,
        isDirectory: false,
      });
    }
  }

  return results;
}

/**
 * Build a tree structure from walk results (directories + files at depth ≤ 4).
 */
function buildFileTree(entries, rootPath) {
  const tree = [];
  const dirMap = new Map();

  // Sort so parents come before children
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));

  for (const entry of sorted) {
    const rel = path.relative(rootPath, entry.path);
    const parentRel = path.dirname(rel);

    const node = {
      name: entry.name,
      type: entry.isDirectory ? 'directory' : 'file',
    };

    if (entry.isDirectory) {
      node.children = [];
      dirMap.set(rel, node);
    }

    if (parentRel === '.') {
      tree.push(node);
    } else {
      const parent = dirMap.get(parentRel);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  return tree;
}

/**
 * Detect languages by extension frequency among source files.
 */
function detectLanguages(sourceFiles) {
  const extCounts = {};
  for (const f of sourceFiles) {
    const ext = path.extname(f.path).toLowerCase();
    extCounts[ext] = (extCounts[ext] || 0) + 1;
  }

  const langMap = {
    '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.py': 'Python', '.pyi': 'Python',
    '.rs': 'Rust',
    '.go': 'Go',
    '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
    '.rb': 'Ruby',
    '.c': 'C', '.h': 'C', '.cpp': 'C++', '.hpp': 'C++',
    '.md': 'Markdown', '.mdx': 'Markdown', '.rst': 'reStructuredText',
    '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML',
  };

  // Aggregate by language name
  const langCounts = {};
  let total = 0;
  for (const [ext, count] of Object.entries(extCounts)) {
    const lang = langMap[ext];
    if (!lang) continue;
    langCounts[lang] = (langCounts[lang] || 0) + count;
    total += count;
  }

  if (total === 0) return [];

  return Object.entries(langCounts)
    .map(([lang, count]) => ({
      lang,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

/**
 * Safely read a file, returning null if it doesn't exist or is too large.
 */
function safeRead(filePath, maxBytes = 102400) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > maxBytes) return null;
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Try to read and parse a JSON file, returning null on failure.
 */
function safeReadJSON(filePath) {
  const content = safeRead(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

/**
 * Extract a ContentBundle from a workspace directory.
 *
 * @param {string} workspacePath — absolute path to the workspace root
 * @param {object} sourceDescriptor — from classifySource()
 * @param {object} config — resolved configuration (needs config.ingestion)
 * @returns {Promise<object>} ContentBundle matching ADR-004 schema
 */
export async function extractContentBundle(workspacePath, sourceDescriptor, config) {
  const absRoot = path.resolve(workspacePath);
  const ingestion = config.ingestion;

  // ── Step 1: Read README and top-level docs ────────────────────────────

  const readmeNames = ['README.md', 'README.rst', 'README.txt', 'README', 'readme.md'];
  let readme = null;
  for (const name of readmeNames) {
    readme = safeRead(path.join(absRoot, name));
    if (readme) break;
  }

  const claudeMd = safeRead(path.join(absRoot, 'CLAUDE.md'));

  // ── Step 2: Read config files ─────────────────────────────────────────

  const packageJson = safeReadJSON(path.join(absRoot, 'package.json'));
  const pyproject = safeRead(path.join(absRoot, 'pyproject.toml'));
  const cargoToml = safeRead(path.join(absRoot, 'Cargo.toml'));

  // ── Step 3: Build file tree ───────────────────────────────────────────

  const allEntries = walkDir(absRoot, 4);
  const fileTree = buildFileTree(allEntries, absRoot);

  // ── Step 4: Filter to source files ────────────────────────────────────

  const allFiles = allEntries.filter(e => !e.isDirectory);
  const sourceFiles = allFiles.filter(f => {
    const ext = path.extname(f.path).toLowerCase();
    return SOURCE_EXTENSIONS.has(ext);
  });

  // ── Step 5: Detect languages ──────────────────────────────────────────

  const languages = detectLanguages(sourceFiles);

  // ── Step 6: Find entry points ─────────────────────────────────────────

  const entryPoints = sourceFiles
    .filter(f => ENTRY_POINT_PATTERN.test(f.name))
    .map(f => path.relative(absRoot, f.path));

  // ── Step 7: Score all source files ────────────────────────────────────

  const scoredFiles = sourceFiles
    .filter(f => f.size <= ingestion.max_file_size_bytes)
    .map(f => ({
      path: f.path,
      name: f.name,
      size: f.size,
      score: scoreFile(f.path, absRoot, f.size),
      relativePath: path.relative(absRoot, f.path),
      language: detectFileLanguage(f.path),
    }));

  // ── Step 8: Select within main token budget ───────────────────────────

  const { selected, remaining, skipped } = selectFilesWithinBudget(
    scoredFiles,
    ingestion.token_budget,
  );

  // ── Step 9: Read selected files into key_files ────────────────────────

  const keyFiles = [];
  for (const file of selected) {
    const content = safeRead(file.path, ingestion.max_file_size_bytes);
    if (content === null) continue;
    keyFiles.push({
      path: file.relativePath,
      content,
      language: file.language,
      importance_score: file.score,
    });
  }

  // ── Step 10: Type definitions (separate 10K budget) ───────────────────

  const typeDefs = [];
  const typeFiles = scoredFiles
    .filter(f => f.name.endsWith('.d.ts') || /types\.(ts|py)$/i.test(f.name) || /interfaces\.(ts|java)$/i.test(f.name))
    .sort((a, b) => b.score - a.score);
  let typeBudget = 10000;
  for (const f of typeFiles) {
    const tokens = Math.ceil(f.size / 4);
    if (tokens > typeBudget) continue;
    const content = safeRead(f.path, ingestion.max_file_size_bytes);
    if (content === null) continue;
    typeDefs.push(content);
    typeBudget -= tokens;
  }

  // ── Step 11: Test files (separate 10K budget, max 5) ──────────────────

  const testFileEntries = [];
  const testCandidates = scoredFiles
    .filter(f => /\.(test|spec)\./i.test(f.name) || /^(tests?|__tests__)\//i.test(f.relativePath))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  let testBudget = 10000;
  for (const f of testCandidates) {
    const tokens = Math.ceil(f.size / 4);
    if (tokens > testBudget) continue;
    const content = safeRead(f.path, ingestion.max_file_size_bytes);
    if (content === null) continue;
    testFileEntries.push({ path: f.relativePath, content });
    testBudget -= tokens;
  }

  // ── Step 12: Examples (separate 10K budget, max 5) ────────────────────

  const examples = [];
  const exampleCandidates = scoredFiles
    .filter(f => /^(examples?|samples?|demo)\//i.test(f.relativePath))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  let exampleBudget = 10000;
  for (const f of exampleCandidates) {
    const tokens = Math.ceil(f.size / 4);
    if (tokens > exampleBudget) continue;
    const content = safeRead(f.path, ingestion.max_file_size_bytes);
    if (content === null) continue;
    examples.push({ path: f.relativePath, content });
    exampleBudget -= tokens;
  }

  // ── Docs from docs/ directory ─────────────────────────────────────────

  const docs = [];
  const docsDir = path.join(absRoot, 'docs');
  if (fs.existsSync(docsDir)) {
    const docFiles = scoredFiles
      .filter(f => /^docs?\//i.test(f.relativePath) && /\.(md|rst|txt)$/i.test(f.name))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    for (const f of docFiles) {
      const content = safeRead(f.path, ingestion.max_file_size_bytes);
      if (content) docs.push(content);
    }
  }

  // ── Assemble ContentBundle ────────────────────────────────────────────

  const bundle = {
    source_type: sourceDescriptor.type,
    source_ref: sourceDescriptor.owner
      ? `${sourceDescriptor.owner}/${sourceDescriptor.repo}`
      : sourceDescriptor.package || sourceDescriptor.url || sourceDescriptor.path,
    workspace_path: absRoot,

    readme,
    docs,

    package_json: packageJson,
    pyproject,
    cargo_toml: cargoToml,
    claude_md: claudeMd,

    file_tree: fileTree,
    languages,
    entry_points: entryPoints,

    key_files: keyFiles,
    type_definitions: typeDefs,
    test_files: testFileEntries,
    examples,

    registry_metadata: null,
  };

  // ── Log summary ───────────────────────────────────────────────────────

  const tokensUsed = ingestion.token_budget - remaining;
  console.log('');
  console.log('ContentBundle assembled:');
  console.log(`  Source: ${bundle.source_ref} (${bundle.source_type})`);
  console.log(`  Files discovered: ${allFiles.length}`);
  console.log(`  Files scored: ${scoredFiles.length}`);
  console.log(`  Files read: ${keyFiles.length} (within ${ingestion.token_budget.toLocaleString()} token budget)`);
  console.log(`  Token usage: ${tokensUsed.toLocaleString()} / ${ingestion.token_budget.toLocaleString()}`);
  console.log(`  Skipped (budget/negative): ${skipped}`);
  console.log(`  Languages: ${languages.map(l => `${l.lang} (${l.percentage}%)`).join(', ') || 'none detected'}`);
  console.log(`  Entry points: ${entryPoints.join(', ') || 'none found'}`);
  console.log('');

  return bundle;
}

/**
 * Detect a file's language from its extension.
 */
function detectFileLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
    '.ts': 'typescript', '.tsx': 'typescript',
    '.py': 'python', '.pyi': 'python',
    '.rs': 'rust',
    '.go': 'go',
    '.java': 'java', '.kt': 'kotlin', '.kts': 'kotlin',
    '.rb': 'ruby',
    '.c': 'c', '.h': 'c', '.cpp': 'cpp', '.hpp': 'cpp',
    '.md': 'markdown', '.mdx': 'markdown',
    '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  };
  return map[ext] || 'unknown';
}

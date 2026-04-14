#!/usr/bin/env node
/**
 * verify-content.js — Pre-generation content verification gate
 *
 * Checks that SME-claimed file paths, function names, and code examples
 * actually exist in the codebase BEFORE any HTML is generated.
 *
 * Usage:
 *   node verify-content.js --check-paths          # Read markdown from stdin, verify paths
 *   node verify-content.js --check-manifest FILE   # Verify a JSON content manifest
 *   node verify-content.js --check-html FILE       # Extract claims from generated HTML
 *   node verify-content.js --scan-dir DIR          # Index a directory for quick lookup
 *
 * Exit codes:
 *   0 = all claims verified (or only warnings)
 *   1 = verification failures found
 *   2 = usage error
 *
 * The content manifest format (JSON):
 * {
 *   "claims": [
 *     { "type": "file", "path": "lib/router.js", "section": "s2" },
 *     { "type": "function", "name": "processQuery", "expectedFile": "lib/router.js", "section": "s2" },
 *     { "type": "code", "snippet": "const router = new SemanticRouter", "expectedFile": "lib/router.js", "section": "s3" },
 *     { "type": "url", "url": "https://...", "section": "s5" }
 *   ]
 * }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const mode = args[0];

if (!mode || mode === '--help') {
  console.log(`Usage:
  node verify-content.js --check-paths          # stdin markdown → verify [VERIFIED: path] tags
  node verify-content.js --check-manifest FILE   # JSON manifest → verify all claims
  node verify-content.js --check-html FILE       # HTML file → extract & verify code refs
  node verify-content.js --check-activities FILE # JSON activities → validate code & patterns
  node verify-content.js --scan-dir DIR          # Index files for quick lookup

Options:
  --workspace DIR   Use DIR as the root for file path verification instead of CWD`);
  process.exit(mode ? 0 : 2);
}

// Support --workspace flag: --workspace DIR can appear anywhere in args
const workspaceIdx = args.indexOf('--workspace');
const workspaceOverride = workspaceIdx !== -1 ? args[workspaceIdx + 1] : null;
const ROOT = workspaceOverride ? path.resolve(workspaceOverride) : findRepoRoot();
let failures = 0;
let warnings = 0;
let verified = 0;

function findRepoRoot() {
  let dir = process.cwd();
  while (dir !== '/') {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function fileExists(relPath) {
  const abs = path.resolve(ROOT, relPath);
  return fs.existsSync(abs);
}

function grepFor(pattern, dir) {
  try {
    const result = execSync(
      `grep -rl "${pattern.replace(/"/g, '\\"')}" "${dir || ROOT}" --include="*.js" --include="*.ts" --include="*.py" --include="*.rs" --include="*.md" 2>/dev/null | head -5`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function report(type, claim, status, detail) {
  const icon = status === 'PASS' ? '  ✓' : status === 'FAIL' ? '  ✗' : '  △';
  const color = status === 'PASS' ? '\x1b[32m' : status === 'FAIL' ? '\x1b[31m' : '\x1b[33m';
  console.log(`${color}${icon}\x1b[0m [${type}] ${claim} — ${detail}`);
  if (status === 'PASS') verified++;
  else if (status === 'FAIL') failures++;
  else warnings++;
}

// ─── Mode: --check-paths (stdin) ────────────────────────────────────────────
if (mode === '--check-paths') {
  const input = fs.readFileSync('/dev/stdin', 'utf-8');

  // Extract [VERIFIED: path:lines] markers
  const verifiedPaths = [...input.matchAll(/\[VERIFIED:\s*([^\]]+)\]/g)];
  const unverifiedPaths = [...input.matchAll(/\[UNVERIFIED:\s*([^\]]+)\]/g)];

  // Extract bare file paths (e.g., `lib/foo.js` or `lib/foo.js:42`)
  const barePaths = [...input.matchAll(/`([a-zA-Z][\w./-]+\.[jt]sx?(?::\d+(?:-\d+)?)?)`/g)];

  console.log('');
  console.log('Content Verification — Path Check');
  console.log('═'.repeat(50));

  for (const m of verifiedPaths) {
    const p = m[1].split(':')[0].trim();
    if (fileExists(p)) {
      report('file', p, 'PASS', 'exists');
    } else {
      report('file', p, 'FAIL', 'CLAIMED VERIFIED but file NOT FOUND');
    }
  }

  for (const m of unverifiedPaths) {
    report('file', m[1].trim(), 'WARN', 'marked unverified by SME');
  }

  // Check bare path references that aren't already covered
  const checked = new Set(verifiedPaths.map(m => m[1].split(':')[0].trim()));
  for (const m of barePaths) {
    const p = m[1].split(':')[0];
    if (checked.has(p)) continue;
    checked.add(p);
    if (p.includes('node_modules')) continue;
    if (fileExists(p)) {
      report('file', p, 'PASS', 'exists');
    } else {
      report('file', p, 'FAIL', 'referenced but NOT FOUND in repo');
    }
  }

  // Extract function names from code blocks and check
  const fnNames = [...input.matchAll(/(?:function|const|class|export)\s+(\w{3,})/g)];
  const uniqueFns = [...new Set(fnNames.map(m => m[1]))].filter(n =>
    !['const', 'function', 'class', 'export', 'return', 'undefined', 'null', 'true', 'false'].includes(n)
  );
  if (uniqueFns.length > 0) {
    console.log('');
    console.log('Function/Symbol Spot Check (sampling 10):');
    const sample = uniqueFns.slice(0, 10);
    for (const fn of sample) {
      const found = grepFor(fn, ROOT);
      if (found.length > 0) {
        report('symbol', fn, 'PASS', `found in ${path.relative(ROOT, found[0])}`);
      } else {
        report('symbol', fn, 'WARN', 'not found via grep — may be fabricated');
      }
    }
  }

  printSummary();
}

// ─── Mode: --check-manifest (JSON file) ─────────────────────────────────────
else if (mode === '--check-manifest') {
  const file = args[1];
  if (!file || !fs.existsSync(file)) {
    console.error(`Manifest file not found: ${file}`);
    process.exit(2);
  }

  const manifest = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const claims = manifest.claims || [];

  console.log('');
  console.log('Content Verification — Manifest Check');
  console.log('═'.repeat(50));
  console.log(`Claims: ${claims.length}`);
  console.log('');

  for (const claim of claims) {
    if (claim.type === 'file') {
      if (fileExists(claim.path)) {
        report('file', claim.path, 'PASS', `exists (section ${claim.section})`);
      } else {
        report('file', claim.path, 'FAIL', `NOT FOUND (section ${claim.section})`);
      }
    }

    else if (claim.type === 'function') {
      const found = grepFor(claim.name, claim.expectedFile ? path.resolve(ROOT, claim.expectedFile) : ROOT);
      if (found.length > 0) {
        report('function', claim.name, 'PASS', `found in ${path.relative(ROOT, found[0])}`);
      } else {
        report('function', claim.name, 'FAIL', `NOT FOUND anywhere (section ${claim.section})`);
      }
    }

    else if (claim.type === 'code') {
      // Check if a distinctive fragment exists
      const snippet = claim.snippet.slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const found = grepFor(snippet, claim.expectedFile ? path.dirname(path.resolve(ROOT, claim.expectedFile)) : ROOT);
      if (found.length > 0) {
        report('code', claim.snippet.slice(0, 40) + '...', 'PASS', 'found in codebase');
      } else {
        report('code', claim.snippet.slice(0, 40) + '...', 'FAIL', `NOT FOUND (section ${claim.section}) — likely hallucinated`);
      }
    }

    else if (claim.type === 'url') {
      // URL check is best done by the Research Librarian; we just flag empties
      if (!claim.url || claim.url === 'https://...') {
        report('url', claim.url || '(empty)', 'FAIL', 'placeholder URL');
      } else {
        report('url', claim.url.slice(0, 50), 'PASS', 'URL present (accessibility not checked here)');
      }
    }
  }

  printSummary();
}

// ─── Mode: --check-html (extract from generated HTML) ───────────────────────
else if (mode === '--check-html') {
  const file = args[1];
  if (!file || !fs.existsSync(file)) {
    console.error(`HTML file not found: ${file}`);
    process.exit(2);
  }

  const html = fs.readFileSync(file, 'utf-8');

  console.log('');
  console.log('Content Verification — HTML Extraction');
  console.log('═'.repeat(50));

  // Extract file paths from code blocks and comments
  const pathRefs = [...html.matchAll(/(?:from|require\(|import\s)['"` ]([a-zA-Z][\w./-]+\.[jt]sx?)/g)];
  const langTagPaths = [...html.matchAll(/(?:File|Source|from):\s*`?([a-zA-Z][\w./-]+\.[jt]sx?)/g)];
  const allPaths = [...new Set([...pathRefs, ...langTagPaths].map(m => m[1]))];

  if (allPaths.length === 0) {
    console.log('  No file path references found in HTML');
  } else {
    console.log(`  Found ${allPaths.length} file references`);
    console.log('');
    for (const p of allPaths) {
      if (p.includes('node_modules') || p.startsWith('http')) continue;
      if (fileExists(p)) {
        report('file', p, 'PASS', 'exists');
      } else {
        report('file', p, 'FAIL', 'referenced in course HTML but NOT FOUND');
      }
    }
  }

  printSummary();
}

// ─── Mode: --scan-dir ───────────────────────────────────────────────────────
else if (mode === '--scan-dir') {
  const dir = args[1] || '.';
  console.log(`Scanning ${path.resolve(dir)} for indexing...`);
  const files = execSync(
    `find "${dir}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.rs" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null`,
    { encoding: 'utf-8' }
  ).trim().split('\n').filter(Boolean);
  console.log(`Found ${files.length} source files`);
  files.forEach(f => console.log(`  ${path.relative(ROOT, f)}`));
}

// ─── Mode: --check-activities (JSON file) ──────────────────────────────────
else if (mode === '--check-activities') {
  const file = args[1];
  if (!file || !fs.existsSync(file)) {
    console.error(`Activities file not found: ${file}`);
    process.exit(2);
  }

  const activities = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const items = Array.isArray(activities) ? activities : (activities.activities || []);

  console.log('');
  console.log('Content Verification — Activity Check');
  console.log('═'.repeat(50));
  console.log(`Activities: ${items.length}`);
  console.log('');

  for (const act of items) {
    // Validate starterCode / solution syntax (JS only — best-effort)
    if (act.starterCode) {
      try {
        new Function(act.starterCode);
        report('syntax', `${act.id} starterCode`, 'PASS', 'parses as JS');
      } catch (e) {
        // Not necessarily a failure — could be a snippet, not a full function body
        report('syntax', `${act.id} starterCode`, 'WARN', `JS parse issue: ${e.message}`);
      }
    }
    if (act.solution) {
      try {
        new Function(act.solution);
        report('syntax', `${act.id} solution`, 'PASS', 'parses as JS');
      } catch (e) {
        report('syntax', `${act.id} solution`, 'WARN', `JS parse issue: ${e.message}`);
      }
    }

    // Validate expectedPatterns regex
    if (act.expectedPatterns) {
      for (const pattern of act.expectedPatterns) {
        if (pattern.type === 'regex') {
          try {
            new RegExp(pattern.value);
            report('regex', `${act.id} pattern "${pattern.value.substring(0, 30)}"`, 'PASS', 'valid regex');
          } catch (e) {
            report('regex', `${act.id} pattern "${pattern.value.substring(0, 30)}"`, 'FAIL', `invalid regex: ${e.message}`);
          }
        }
      }
    }

    // Validate bugs patterns (debug challenges)
    if (act.bugs) {
      for (const bug of act.bugs) {
        for (const key of ['buggy_pattern', 'fixed_pattern']) {
          if (bug[key]) {
            try {
              new RegExp(bug[key]);
              report('regex', `${act.id} ${key}`, 'PASS', 'valid regex');
            } catch (e) {
              report('regex', `${act.id} ${key}`, 'FAIL', `invalid regex: ${e.message}`);
            }
          }
        }
      }
    }
  }

  printSummary();
}

else {
  console.error(`Unknown mode: ${mode}`);
  process.exit(2);
}

function printSummary() {
  console.log('');
  console.log('─'.repeat(50));
  console.log(`  Verified: ${verified} | Warnings: ${warnings} | Failures: ${failures}`);
  console.log(`  Result: ${failures === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}`);
  if (failures > 0) {
    console.log('');
    console.log('  ⛔ DO NOT proceed to HTML generation with unresolved failures.');
    console.log('  Fix each failure: find the real file/function or remove the reference.');
  }
  console.log('');
  process.exit(failures > 0 ? 1 : 0);
}

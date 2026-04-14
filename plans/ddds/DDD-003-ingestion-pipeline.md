# DDD-003: Ingestion Pipeline Design

## Overview

This document specifies the detailed design of the source ingestion pipeline:
how the system classifies, fetches, scores, and assembles source material into
a unified ContentBundle for downstream consumption by the educator agents.

**Related ADRs**: ADR-004 (source ingestion strategy), ADR-007 (file scoring)

## Input Classification

### Pattern Matching Rules

The classifier applies rules in order; the first match wins.

```javascript
const PATTERNS = [
  {
    name: "github_url",
    regex: /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+)(?:\/(.+))?)?/,
    extract: (m) => ({
      type: "github_url",
      owner: m[1],
      repo: m[2],
      branch: m[3] || null,
      path: m[4] || null
    })
  },
  {
    name: "github_slug_with_path",
    regex: /^([\w.-]+)\/([\w.-]+)\/(.+)/,
    extract: (m) => ({
      type: "github_slug",
      owner: m[1],
      repo: m[2],
      path: m[3],
      branch: null
    })
  },
  {
    name: "github_slug",
    regex: /^([\w.-]+)\/([\w.-]+)$/,
    extract: (m) => ({
      type: "github_slug",
      owner: m[1],
      repo: m[2],
      path: null,
      branch: null
    })
  },
  {
    name: "npm_package",
    regex: /^npm:([@\w.-]+(?:\/[\w.-]+)?)/,
    extract: (m) => ({
      type: "npm_package",
      package: m[1]
    })
  },
  {
    name: "pypi_package",
    regex: /^pypi:([\w.-]+)/,
    extract: (m) => ({
      type: "pypi_package",
      package: m[1]
    })
  },
  {
    name: "documentation_url",
    regex: /^https?:\/\/.+/,
    extract: (m) => ({
      type: "documentation_url",
      url: m[0]
    })
  },
  {
    name: "local_path",
    regex: /^\.?\/.+/,
    extract: (m) => ({
      type: "local_path",
      path: m[0]
    })
  }
];
```

### Ambiguity Resolution

| Input | Could Be | Resolution |
|-------|----------|-----------|
| `facebook/react` | GitHub slug or directory | GitHub slug (directories require `./` prefix) |
| `express` | npm package or GitHub slug | Error: ambiguous. Prompt: "Did you mean `npm:express` or `expressjs/express`?" |
| `https://docs.python.org/...` | GitHub URL or doc URL | Doc URL (no `github.com` in host) |

Single-word inputs without a prefix (`npm:`, `pypi:`, `./`) are ambiguous
and rejected with a helpful error message listing available formats.

## GitHub Ingester

### Clone Strategy

```
IF GITHUB_TOKEN is set:
  Use: gh repo clone {owner}/{repo} {temp_dir} -- --depth 1
ELSE:
  Use: git clone --depth 1 https://github.com/{owner}/{repo}.git {temp_dir}
```

`--depth 1` avoids downloading full history. For repositories with specified
subdirectory paths, sparse checkout is used:

```bash
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/{owner}/{repo}.git {temp_dir}
cd {temp_dir}
git sparse-checkout set {path}
```

### Size Guards

| Check | Threshold | Action |
|-------|-----------|--------|
| Repo size (from GitHub API) | > 500MB | Warn user, suggest `--path` to narrow scope |
| Clone timeout | 60 seconds | Abort with error |
| File count (post-clone) | > 10,000 source files | Score and read only top 500 |
| Single file size | > 100KB | Skip with warning (likely generated/minified) |

### File Discovery

After cloning, discover all source files:

```javascript
const SOURCE_EXTENSIONS = new Set([
  // JavaScript/TypeScript
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  // Python
  '.py', '.pyi',
  // Rust
  '.rs',
  // Go
  '.go',
  // Java/Kotlin
  '.java', '.kt', '.kts',
  // Ruby
  '.rb',
  // C/C++
  '.c', '.h', '.cpp', '.hpp',
  // Documentation
  '.md', '.mdx', '.rst', '.txt',
  // Configuration
  '.json', '.yaml', '.yml', '.toml',
]);

const IGNORE_PATTERNS = [
  'node_modules/**',
  'vendor/**',
  'dist/**',
  'build/**',
  '.git/**',
  '__pycache__/**',
  '*.min.js',
  '*.min.css',
  '*.map',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  '*.pyc',
  '*.wasm',
  '*.png', '*.jpg', '*.gif', '*.svg', '*.ico',
  '*.zip', '*.tar', '*.gz',
];
```

## URL Ingester

### Fetch Strategy

```
1. Fetch the primary URL via WebFetch
2. Extract text content, headings, code blocks
3. Find internal links (same domain, max depth 1)
4. Fetch up to 20 linked pages
5. Assemble into a documentation-focused ContentBundle
```

### Content Extraction

From each fetched page:

| Element | Extraction |
|---------|-----------|
| `<h1>-<h6>` | Document structure / section headings |
| `<p>`, `<li>` | Body text |
| `<pre>`, `<code>` | Code examples (detect language from class) |
| `<table>` | Data tables (convert to markdown) |
| `<a>` with same-domain href | Follow links for crawling |
| `<meta name="description">` | Page summary |

### Domain Restrictions

The URL ingester only follows links within the same domain. It does NOT:
- Follow external links
- Download resources (images, PDFs)
- Execute JavaScript (static HTML only)
- Access URLs behind authentication

### Documentation URL ContentBundle

Documentation sources produce a ContentBundle with a different shape than
repo sources:

```javascript
{
  source_type: "documentation_url",
  source_ref: "https://docs.python.org/3/library/asyncio.html",
  workspace_path: null,  // No local workspace
  readme: null,
  docs: [
    { url: "https://...", title: "...", content: "..." },
    // ... up to 20 pages
  ],
  file_tree: [],          // Empty for URL sources
  languages: [],          // Empty for URL sources
  key_files: [],          // Empty -- content is in docs[]
  // ... other fields empty/null
}
```

Downstream agents detect `source_type === "documentation_url"` and switch
to documentation-teaching mode (explain concepts from the docs rather than
walking through code files).

## Package Ingester

### npm Resolution

```
1. GET https://registry.npmjs.org/{package_name}
2. Extract: repository.url (GitHub URL)
3. Extract: description, version, keywords
4. Delegate to GitHub ingester with the resolved URL
5. Enrich ContentBundle with npm metadata
```

### PyPI Resolution

```
1. GET https://pypi.org/pypi/{package_name}/json
2. Extract: info.project_urls.Source or info.project_urls.Repository
3. Extract: info.summary, info.version, info.classifiers
4. Delegate to GitHub ingester with the resolved URL
5. Enrich ContentBundle with PyPI metadata
```

### Resolution Failure

If the package registry does not contain a GitHub URL:

1. Try `info.project_urls.Homepage` and check if it's a GitHub URL
2. Try searching GitHub: `gh search repos {package_name} --limit 3`
3. If still unresolved: error with message "Could not resolve GitHub
   repository for {package}. Try providing the GitHub URL directly."

## File Importance Scorer

### Scoring Algorithm

```javascript
function scoreFile(file, repoRoot) {
  let score = 0;

  const rel = path.relative(repoRoot, file.path);
  const name = path.basename(file.path);
  const ext = path.extname(file.path);
  const dir = path.dirname(rel);

  // ── Positive signals ──

  // Entry points
  if (/^(index|main|app|server|lib)\.(js|ts|py|rs|go)$/.test(name)) score += 100;
  if (name === 'mod.rs' || name === '__init__.py') score += 80;

  // README and docs
  if (/^README/i.test(name)) score += 90;
  if (/^(CONTRIBUTING|ARCHITECTURE|DESIGN)/i.test(name)) score += 70;

  // Configuration
  if (/^(package\.json|tsconfig|pyproject\.toml|Cargo\.toml|go\.mod)/.test(name)) score += 80;

  // Source directories
  if (/^(src|lib)\//i.test(rel)) score += 60;
  if (/^(core|internal|pkg)\//i.test(rel)) score += 50;

  // Type definitions
  if (ext === '.d.ts' || name.includes('types') || name.includes('interfaces')) score += 50;

  // Examples
  if (/^(examples?|samples?|demo)\//i.test(rel)) score += 40;

  // Documentation
  if (/^docs?\//i.test(rel)) score += 35;

  // Tests (useful but lower priority)
  if (/\.(test|spec)\./i.test(name) || /^(tests?|__tests__)\//i.test(rel)) score += 30;

  // CI/CD
  if (/^\.github\//i.test(rel)) score += 15;

  // ── Negative signals ──

  // Generated output
  if (/^(dist|build|out|\.next|\.nuxt|target)\//i.test(rel)) score -= 100;

  // Vendor
  if (/^(node_modules|vendor|third_party)\//i.test(rel)) score -= 200;

  // Lock files
  if (/lock\.(json|yaml)$/i.test(name) || name === 'Cargo.lock') score -= 150;

  // Large files (diminishing returns)
  if (file.size > 50000) score -= 20;
  if (file.size > 100000) score -= 50;

  // Minified files
  if (/\.min\.(js|css)$/.test(name)) score -= 200;

  return score;
}
```

### Budget Enforcement

```javascript
function selectFilesWithinBudget(scoredFiles, tokenBudget = 100000) {
  const sorted = scoredFiles.sort((a, b) => b.score - a.score);
  const selected = [];
  let remaining = tokenBudget;

  for (const file of sorted) {
    if (file.score < 0) continue;  // Skip negatively-scored files

    const estimatedTokens = Math.ceil(file.size / 4);  // ~4 chars per token
    if (estimatedTokens > remaining) continue;

    selected.push(file);
    remaining -= estimatedTokens;
  }

  return { selected, remaining, skipped: sorted.length - selected.length };
}
```

## ContentBundle Assembly

### Assembly Order

```
1. Read README and top-level docs (always, regardless of score)
2. Read configuration files (package.json, etc.)
3. Build file tree (directory listing, no content)
4. Detect languages (by extension frequency)
5. Find entry points (by name pattern)
6. Score all source files
7. Read files in score order until token budget exhausted
8. Read type definitions (separate budget)
9. Read sample test files (separate budget)
10. Read example files (separate budget)
```

### Logging

The assembler logs what was included and excluded:

```
ContentBundle assembled:
  Source: anthropics/claude-code (github_slug)
  Files discovered: 1,247
  Files scored: 892 (355 ignored by pattern)
  Files read: 67 (within 100K token budget)
  Token usage: 94,312 / 100,000
  Skipped (budget): 825 files
  Languages: TypeScript (72%), JavaScript (18%), Markdown (10%)
  Entry points: src/index.ts, src/cli.ts
```

This log is shown to the user so they can judge whether the ingestion
captured the right content.

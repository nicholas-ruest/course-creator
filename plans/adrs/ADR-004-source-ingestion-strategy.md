# ADR-004: Multi-Source Ingestion with Unified ContentBundle

## Status

Accepted

## Date

2026-04-13

## Context

The system must accept diverse source types as input: GitHub slugs, GitHub URLs,
documentation URLs, npm packages, PyPI packages, and local paths. Each source
type requires a different fetching mechanism, but all downstream components
(brief assembly, educator agents, content verification) need a uniform data
structure to work with.

We considered two approaches:

1. **Source-specific pipelines**: Each source type has its own end-to-end
   pipeline from ingestion through course generation, with shared components
   where possible.
2. **Unified ContentBundle**: All source types are normalized into a single
   `ContentBundle` data structure by source-specific ingesters, and all
   downstream processing operates on the ContentBundle only.

## Decision

We will use **Option 2: Unified ContentBundle**.

The ingestion layer consists of:

1. **Input Classifier** (`classifier.js`): Parses the source string and
   determines the ingestion strategy using regex pattern matching.
2. **Source-specific ingesters**: Each source type has a dedicated module
   (`github.js`, `url.js`, `package.js`) that fetches content and produces
   a `ContentBundle`.
3. **File Scorer** (`scorer.js`): Ranks files by teaching value for token
   budget management.
4. **Extractor** (`extractor.js`): Reads prioritized files and assembles the
   final `ContentBundle`.

All downstream components (agents, verification, generation) receive only
the `ContentBundle` and have no knowledge of the original source type.

## Rationale

**Option 1 rejected** because it would lead to significant code duplication.
The educator agents, synthesis, HTML generation, and validation are all
source-independent -- they care about *what* the content says, not *where* it
came from. Duplicating these components per source type would multiply
maintenance burden and inconsistency risk.

**Option 2** cleanly separates the "how to fetch" concern from the "how to
teach" concern. Adding a new source type (e.g., GitLab, Bitbucket, Crates.io)
requires only a new ingester module -- everything downstream works unchanged.

## ContentBundle Schema

```typescript
interface ContentBundle {
  // Source metadata
  source_type: "github_slug" | "github_url" | "documentation_url"
              | "npm_package" | "pypi_package" | "local_path";
  source_ref: string;           // original user input
  workspace_path: string;       // local filesystem path to fetched content

  // Documentation
  readme: string | null;
  docs: string[];

  // Project metadata
  package_json: object | null;
  pyproject: object | null;
  cargo_toml: object | null;
  claude_md: string | null;

  // Structural analysis
  file_tree: TreeNode[];
  languages: { lang: string; percentage: number }[];
  entry_points: string[];

  // Prioritized source content (within token budget)
  key_files: {
    path: string;
    content: string;
    language: string;
    importance_score: number;
  }[];

  // Supplementary
  type_definitions: string[];
  test_files: { path: string; content: string }[];
  examples: { path: string; content: string }[];

  // Package registry metadata (npm/PyPI sources)
  registry_metadata: {
    name: string;
    version: string;
    description: string;
    dependencies: Record<string, string>;
  } | null;
}
```

## Source Resolution Chain

Some source types resolve through others:

```
npm:zod ──> npm registry API ──> github.com/colinhacks/zod ──> git clone
pypi:fastapi ──> PyPI API ──> github.com/tiangolo/fastapi ──> git clone
https://github.com/owner/repo ──> parse URL ──> git clone
owner/repo ──> direct ──> git clone
```

The package ingesters (`package.js`) resolve the GitHub repository URL from
the package registry metadata, then delegate to the GitHub ingester. This
avoids duplicating clone logic.

## Consequences

### Positive

- Single data contract for all downstream components
- New source types require only a new ingester module
- Package sources get enriched metadata (version, dependencies) alongside code
- Token budget management is centralized in the scorer/extractor

### Negative

- Some source-type-specific information may be lost in normalization (e.g.,
  npm download counts, PyPI classifiers)
- URL ingestion produces a fundamentally different ContentBundle than repo
  ingestion (no file tree, no type definitions) -- downstream components
  must handle sparse bundles

### Mitigations

- The `registry_metadata` field preserves package-specific information
- Downstream components check for null/empty fields and adapt their behavior
  (e.g., SME agent skips "code walkthrough" mode if no `key_files` exist)
- The `source_type` field is available for source-aware behavior where needed

## Token Budget Strategy

Repositories can be enormous. The system must be selective about what it reads.

| Priority | Category | Budget Share | Rationale |
|----------|----------|-------------|-----------|
| 1 | README + docs | 15% | High-level understanding |
| 2 | Entry points | 20% | Core application logic |
| 3 | src/lib source | 35% | Primary teaching material |
| 4 | Type definitions | 10% | API contracts |
| 5 | Tests | 10% | Behavioral examples |
| 6 | Examples/samples | 10% | Usage patterns |

Total budget: 100,000 tokens. Files are read in priority order until the
budget is exhausted. The scorer penalizes generated output, vendor directories,
binaries, and very large files.

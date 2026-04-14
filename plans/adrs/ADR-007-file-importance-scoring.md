# ADR-007: File Importance Scoring for Token Budget Management

## Status

Accepted

## Date

2026-04-13

## Context

Repositories can contain thousands of files and millions of lines of code.
The system cannot read all of it -- there is a practical token budget (~100K
tokens) for content that can be passed to the educator agents. We need a
strategy to determine which files are most valuable for teaching purposes.

We considered three approaches:

1. **Read everything, truncate at budget**: Read files in filesystem order,
   stop when the budget is exhausted.
2. **Manual selection**: Ask the user which files to include.
3. **Heuristic scoring**: Assign importance scores to files based on their
   path, name, type, and size, then read in score order until the budget
   is exhausted.

## Decision

We will use **Option 3: Heuristic scoring** via a dedicated File Scorer
component.

## Scoring Rubric

| Signal | Score Modifier | Rationale |
|--------|---------------|-----------|
| Entry point (`index.js`, `main.py`, `lib.rs`, `app.ts`) | +100 | Core application logic, highest teaching value |
| README, CONTRIBUTING | +90 | Project overview, intent, architecture |
| Configuration (`package.json`, `tsconfig.json`, `pyproject.toml`) | +80 | Dependencies, project structure |
| Source in `lib/` or `src/` directories | +60 | Primary implementation code |
| Type definitions (`.d.ts`, `.pyi`, `interfaces.ts`) | +50 | API contracts, shape of the system |
| Test files (`*.test.js`, `*_test.py`, `*_spec.rs`) | +30 | Behavioral documentation |
| Examples/samples in `examples/` or `samples/` | +40 | Usage patterns |
| Documentation in `docs/` | +35 | Supplementary explanation |
| Files with many imports (hub files) | +20 | Architectural connectors |
| Recently modified files (git recency) | +10 | Active development areas |
| Generated output (`dist/`, `build/`, `.next/`) | -100 | Not source code |
| Vendor directories (`node_modules/`, `vendor/`) | -200 | Third-party code |
| Binary files (images, compiled, archives) | -200 | Cannot be tokenized |
| Very large files (>50KB) | -20 | Diminishing returns per token |
| Lock files (`package-lock.json`, `yarn.lock`) | -150 | No teaching value |
| CI/CD configuration (`.github/workflows/`) | +15 | Useful context |
| Changelog, release notes | +10 | Project history |

## Rationale

**Option 1 rejected** because filesystem order is arbitrary (usually
alphabetical). The system would read `AUTHORS`, `.babelrc`, `.circleci/` and
exhaust the budget before reaching `src/`. The most important files would be
the ones most likely to be excluded.

**Option 2 rejected** because it defeats the purpose of automated ingestion.
The user should not need to understand the repo structure before generating a
course -- that is the system's job.

**Option 3** ensures that the most pedagogically valuable files are always
read first. Even for a 10,000-file repo, the top 50-100 files by importance
score will cover the core architecture, API surface, and key implementation
details.

## Budget Allocation

Total budget: 100,000 tokens, distributed by priority tier:

| Tier | Category | Budget Share | Max Tokens |
|------|----------|-------------|------------|
| 1 | README + top-level docs | 15% | 15,000 |
| 2 | Entry points | 20% | 20,000 |
| 3 | Core source (`src/`, `lib/`) | 35% | 35,000 |
| 4 | Type definitions | 10% | 10,000 |
| 5 | Tests (sampling) | 10% | 10,000 |
| 6 | Examples/samples | 10% | 10,000 |

Within each tier, files are read in descending score order. If a tier's budget
is exhausted, remaining files in that tier are skipped, and the unused budget
does NOT roll over to the next tier. This prevents any single category from
dominating the context.

## Consequences

### Positive

- Deterministic, reproducible file selection for any given repo
- Core files are always included regardless of repo size
- Scoring is fast (path pattern matching, no content analysis needed)
- Easily tunable: adjust score modifiers without changing pipeline structure

### Negative

- Heuristics may misjudge importance for unconventional repo structures (e.g.,
  all source in `modules/` instead of `src/`)
- No content-aware scoring: a 5-line utility in `src/` scores higher than a
  critical algorithm in `scripts/`
- Per-tier budgets may waste tokens if some tiers have few files

### Mitigations

- The user can specify a subdirectory path (`owner/repo/path/to/dir`) to focus
  the ingestion on the relevant area
- The `--path` option accepts a comma-separated list of directories to
  prioritize
- Log which files were read and which were skipped so the user can adjust if
  the course is missing key content
- Future enhancement: content-aware scoring using embedding similarity to the
  user's topic description

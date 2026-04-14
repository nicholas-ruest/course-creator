# ADR-005: Two-Gate Content Verification Pipeline

## Status

Accepted

## Date

2026-04-13

## Context

LLM agents hallucinate. The Subject Matter Expert agent may fabricate file
paths, invent function names, describe code that does not exist, or attribute
ideas to papers that were never written. A course built on hallucinated content
is actively harmful -- it teaches falsehoods with the authority of a structured
educational experience.

The existing course skill has a two-gate verification system:

- **Gate 1** (`verify-content.js`): Pre-generation. Checks that claimed file
  paths, function names, and code examples exist in the codebase before any
  HTML is assembled.
- **Gate 2** (`validate-course.js`): Post-generation. Checks structural
  integrity of the generated HTML: COURSE_DATA validity, section count, brand
  compliance, accessibility.

The question is whether to retain, modify, or replace this system for the new
automated ingestion pipeline.

## Decision

We will **retain and extend** the two-gate verification system.

### Gate 1 Enhancements (Pre-Generation)

| Existing Check | Retained | Enhancement |
|---------------|----------|-------------|
| File path verification | Yes | Paths verified against cloned workspace (not just CWD) |
| Function/class name grep | Yes | Grep runs against the ingested workspace |
| Code snippet matching | Yes | Match against actual file content, not just grep |
| URL reachability | Yes | WebFetch HEAD request to verify URLs |
| -- | NEW | Activity starter code syntax validation (parse, don't execute) |
| -- | NEW | Activity expected output validation (plausibility check) |
| -- | NEW | Cross-reference: every file path in SME output must exist in ContentBundle.file_tree |

### Gate 2 Enhancements (Post-Generation)

| Existing Check | Retained | Enhancement |
|---------------|----------|-------------|
| COURSE_DATA JSON integrity | Yes | No change |
| Section count/structure | Yes | No change |
| Vernacular boxes | Yes | No change |
| Glossary panel | Yes | No change |
| Quiz components | Yes | No change |
| Brand compliance | Yes | No change |
| Font sizes | Yes | No change |
| Self-contained check | Yes | No change |
| File size | Yes | Updated target for video-enabled courses |
| -- | NEW | Video manifest validation: each section's videoUrl has a corresponding .mp4 |
| -- | NEW | Activity component validation: sections with activities have correct HTML structure |
| -- | NEW | Video player HTML/CSS/JS injection check |
| -- | NEW | Transcript presence for every section with video |

## Rationale

The two-gate architecture is sound and proven. Gate 1 catches fabricated
content before it enters the HTML (preventing students from ever seeing lies).
Gate 2 catches structural defects after HTML assembly (ensuring the UI works).

Replacing this with a single gate would either:
- Move content verification to post-generation (too late -- HTML has already
  been assembled with bad content, wasting generation time)
- Move structural validation to pre-generation (impossible -- there is no HTML
  to validate yet)

Extending (rather than rewriting) preserves the existing validation logic that
has been tested and tuned against real course outputs.

## The 30% Rule

If more than 30% of the SME's content claims fail Gate 1 verification, the
system does NOT proceed. Instead, it:

1. Re-runs the SME agent with stricter instructions
2. Pre-loads actual file contents into the SME's context (rather than letting
   it infer from the brief)
3. Re-runs Gate 1 on the new output

This threshold was chosen because:
- Below 30%: individual fixes are tractable (find the right path, correct the
  function name)
- Above 30%: the SME fundamentally misunderstood the codebase structure, and
  patching individual claims will produce an incoherent narrative

## Consequences

### Positive

- Students never see hallucinated file paths or fabricated code
- Structural defects are caught before the user sees the output
- The system self-corrects when hallucination rate is high (re-run with more
  context)
- New checks for video and activities are additive -- they don't break existing
  validation

### Negative

- Gate 1 adds 10-20 seconds to the pipeline (file existence checks, grep)
- The 30% threshold is heuristic -- some courses may have legitimate reasons
  for many "unverified" claims (e.g., conceptual topics with no codebase)
- Re-running the SME agent doubles its cost when triggered

### Mitigations

- For conceptual topics (no codebase), Gate 1 focuses on URL reachability and
  citation accuracy rather than file path verification
- The 30% threshold only triggers on file/code claims, not on all claim types
- Re-runs are rare in practice -- most SME agents produce >85% verified content
  when given adequate source files in their context

## Verification Flow

```
SME Agent Output
  |
  v
Gate 1: verify-content.js (enhanced)
  |
  +-- File paths exist?          --> FAIL: find correct path or remove
  +-- Function names exist?      --> FAIL: find real name via grep
  +-- Code snippets match source? --> FAIL: replace with verified code
  +-- URLs reachable?            --> FAIL: flag as [unverified]
  +-- Activity code parses?      --> FAIL: fix syntax
  |
  +-- Failure rate > 30%?  ----YES----> Re-run SME with actual files
  |                                     Re-run Gate 1
  +-- Failure rate <= 30%?
  |
  v
Coordinator fixes individual failures
  |
  v
Phase 4: Synthesis (only verified content enters)
  |
  v
Phase 6: HTML Generation
  |
  v
Gate 2: validate-course.js (enhanced)
  |
  +-- COURSE_DATA valid?
  +-- Sections present?
  +-- Vernacular boxes?
  +-- Video manifest valid?       (NEW)
  +-- Activity components valid?  (NEW)
  +-- Video player injected?      (NEW)
  +-- Brand compliance?
  |
  v
Fix failures --> Re-validate --> Output
```

# Course Creator -- Planning Documents Index

## SPARC Specification

- [SPARC.md](SPARC.md) -- Full specification: goals, pseudocode, architecture, refinement plan, completion criteria

## Architecture Decision Records (ADRs)

Architectural decisions at the system level. Each ADR captures the context,
alternatives considered, and rationale for a structural choice.

| ADR | Title | Status | Summary |
|-----|-------|--------|---------|
| [ADR-001](adrs/ADR-001-single-file-html-output.md) | Single-File HTML Output with Sidecar Video Directory | Accepted | HTML + `videos/` directory; collapses to single file with `--no-video` |
| [ADR-002](adrs/ADR-002-seven-agent-educator-swarm.md) | Seven-Agent Parallel Educator Swarm | Accepted | Added Activity Designer as 7th agent alongside existing 6 |
| [ADR-003](adrs/ADR-003-heygen-async-video-pipeline.md) | Asynchronous HeyGen Video Pipeline | Accepted | Parallel video submission, deferred collection, graceful degradation to text |
| [ADR-004](adrs/ADR-004-source-ingestion-strategy.md) | Multi-Source Ingestion with Unified ContentBundle | Accepted | All source types normalize to ContentBundle; downstream is source-agnostic |
| [ADR-005](adrs/ADR-005-two-gate-content-verification.md) | Two-Gate Content Verification Pipeline | Accepted | Retain and extend existing verify-content.js + validate-course.js gates |
| [ADR-006](adrs/ADR-006-video-caching-by-script-hash.md) | Video Caching by Script Hash | Accepted | SHA-256 of (script + avatar + voice) as cache key; avoids duplicate HeyGen generation |
| [ADR-007](adrs/ADR-007-file-importance-scoring.md) | File Importance Scoring for Token Budget | Accepted | Heuristic scoring: entry points > README > src > types > tests; 100K token budget |
| [ADR-008](adrs/ADR-008-activity-system-design.md) | In-Browser Activity System with Client-Side Validation | Accepted | 5 activity types with regex/pattern validation; WebAssembly execution as future enhancement |

## Design Decision Documents (DDDs)

Detailed component-level designs. Each DDD specifies HTML structure, CSS,
JavaScript, data models, and edge cases for a specific subsystem.

| DDD | Title | Summary |
|-----|-------|---------|
| [DDD-001](ddds/DDD-001-video-player-component.md) | Video Player Component | HTML5 video in lecturer pane, controls, transcript sync, responsive behavior, keyboard accessibility |
| [DDD-002](ddds/DDD-002-activity-engine.md) | Activity Engine | 5 activity types (code exercise, guided exploration, build challenge, debug challenge, architecture puzzle), validation engine, progress tracking |
| [DDD-003](ddds/DDD-003-ingestion-pipeline.md) | Ingestion Pipeline | Input classification, GitHub/URL/package ingesters, file scoring algorithm, ContentBundle assembly |
| [DDD-004](ddds/DDD-004-course-data-schema.md) | COURSE_DATA Schema | Complete TypeScript interface definitions for v2 schema: video metadata, activities, Bloom's taxonomy, versioning |
| [DDD-005](ddds/DDD-005-tts-sanitization.md) | TTS Sanitization Pipeline | 7-stage pipeline: HTML stripping, entity decoding, acronym expansion, code humanization, punctuation, pauses, length enforcement |
| [DDD-006](ddds/DDD-006-brand-system-extension.md) | Brand System Extension | Activity type colors, video player brand integration, dark mode, print styles, 30-component inventory |

## Document Dependency Map

```
SPARC.md (specification)
  │
  ├── ADR-001 (output format)
  │     └── DDD-001 (video player)
  │     └── DDD-006 (brand extension)
  │
  ├── ADR-002 (agent swarm)
  │     └── DDD-002 (activity engine)
  │
  ├── ADR-003 (HeyGen pipeline)
  │     └── DDD-001 (video player)
  │     └── DDD-005 (TTS sanitization)
  │
  ├── ADR-004 (ingestion strategy)
  │     └── DDD-003 (ingestion pipeline)
  │
  ├── ADR-005 (verification gates)
  │     └── DDD-004 (COURSE_DATA schema)
  │
  ├── ADR-006 (video caching)
  │     └── DDD-005 (TTS sanitization)
  │
  ├── ADR-007 (file scoring)
  │     └── DDD-003 (ingestion pipeline)
  │
  └── ADR-008 (activity system)
        └── DDD-002 (activity engine)
        └── DDD-004 (COURSE_DATA schema)
        └── DDD-006 (brand extension)
```

## Implementation Prompts

- [IMPLEMENTATION_PROMPTS.md](IMPLEMENTATION_PROMPTS.md) -- 10 sequential implementation prompts with explicit ADR/DDD references and dependency ordering

| Prompt | Focus | ADRs | DDDs |
|--------|-------|------|------|
| 1 | Project Scaffold & Config | -- | DDD-004 |
| 2 | Input Classifier | ADR-004 | DDD-003 |
| 3 | File Scorer & Extractor | ADR-007 | DDD-003 |
| 4 | Source Ingesters | ADR-004 | DDD-003 |
| 5 | Schema & Validators | ADR-005, ADR-001 | DDD-004 |
| 6 | HTML Generator | ADR-001 | DDD-006 |
| 7 | Activity Engine | ADR-008, ADR-002 | DDD-002, DDD-006 |
| 8 | TTS & HeyGen Client | ADR-003, ADR-006 | DDD-005 |
| 9 | Video Player | ADR-001, ADR-003 | DDD-001, DDD-006 |
| 10 | Orchestrator & E2E | ADR-002, ADR-005 | DDD-006 |

## Implementation Order (summary)

Based on the dependency map, the build sequence is:

1. **Prompt 1-2**: Scaffold + Input Classifier (foundation)
2. **Prompt 3-4**: Scorer/Extractor + Ingesters (content pipeline)
3. **Prompt 5-6**: Schema/Validators + HTML Generator (output pipeline)
4. **Prompt 7**: Activities (content enhancement)
5. **Prompt 8-9**: TTS/HeyGen + Video Player (video pipeline)
6. **Prompt 10**: Orchestrator & E2E (integration)

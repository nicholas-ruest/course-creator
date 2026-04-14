# DDD-004: COURSE_DATA Schema Design

## Overview

This document specifies the complete COURSE_DATA JavaScript object schema that
is embedded in every generated course HTML file. This object is the single
source of truth for all course content, driving the section navigation, quiz
engine, activity engine, glossary, citations, and video player.

**Related ADRs**: ADR-001 (output format), ADR-008 (activity system)

## Schema Evolution

The existing skill defines a COURSE_DATA with `meta`, `sections`, `glossary`,
and `citations`. The new system extends this with video metadata, activities,
and richer section information. All extensions are additive -- an existing
course HTML with the old schema will not break.

## Complete Schema

```typescript
interface CourseData {
  meta: CourseMeta;
  sections: CourseSection[];
  glossary: GlossaryEntry[];
  citations: Citation[];
}

interface CourseMeta {
  // ── Existing fields ──
  title: string;                    // "Understanding Agentic Workflows"
  topic: string;                    // "agentic-workflows" (kebab-case slug)
  generated: string;                // ISO 8601 date: "2026-04-13"
  sectionCount: number;             // 8
  totalQuestions: number;           // 18

  // ── New fields ──
  source: string;                   // "anthropics/claude-code" (original input)
  sourceType: string;               // "github_slug" | "github_url" | etc.
  audience: string;                 // "beginner" | "intermediate" | "advanced"
  estimatedDuration: number;        // Total estimated minutes: 45
  totalActivities: number;          // 6
  totalVideoDuration: number;       // Total video seconds: 960
  hasVideo: boolean;                // true (false for --no-video courses)
  version: string;                  // Schema version: "2.0.0"
  generator: string;                // "course-creator/1.0.0"
  instructor: InstructorMeta;
}

interface InstructorMeta {
  name: string;                     // "Dr. Ada"
  emoji: string;                    // "🤖" (used for text fallback)
  role: string;                     // "Course Instructor"
  avatarId: string | null;          // HeyGen avatar ID
  voiceId: string | null;           // HeyGen voice ID
}

interface CourseSection {
  // ── Existing fields ──
  id: string;                       // "s1", "s2", ... "s12"
  title: string;                    // "Why Agents?"
  lectureScript: string;            // HTML: "<p>Welcome to...</p><p>...</p>"
  assessments: Assessment[];

  // ── New fields ──
  bloomLevel: string;               // "remember" | "understand" | "apply" |
                                    // "analyze" | "evaluate" | "create"
  learningObjectives: string[];     // ["Explain the motivation for agents", ...]
  estimatedMinutes: number;         // 5
  prerequisites: string[];          // ["s1", "s2"] (section IDs)

  // Video
  videoUrl: string | null;          // "videos/s1-intro.mp4" (null if no video)
  videoPoster: string | null;       // "videos/s1-intro.jpg"
  videoDuration: number | null;     // Seconds: 142
  videoTimestamps: VideoTimestamp[] | null;

  // Activities
  activities: Activity[];

  // Content structure hints (used by nav, not rendered)
  termCount: number;                // How many new terms this section introduces
  hasVisualization: boolean;        // Whether section contains a canvas/SVG demo
  hasCodeBlock: boolean;            // Whether section contains code examples
}

// ── Assessments (enhanced from existing) ──

type Assessment = MultipleChoice | CodeCompletion | ConceptMatch;

interface MultipleChoice {
  type: "multiple-choice";
  bloom: string;                    // Bloom's level
  difficulty: number;               // 1-5
  question: string;                 // "What is the purpose of...?"
  options: string[];                // ["Option A", "Option B", "Option C", "Option D"]
  correct: number;                  // Index: 2
  explanation: string;              // "Option C is correct because..."
  distractorNotes: string[];        // Why each wrong answer is wrong
}

interface CodeCompletion {
  type: "code-completion";
  bloom: string;
  difficulty: number;
  prompt: string;                   // "Complete the function to..."
  starterCode: string;              // "function example() {\n  // TODO\n}"
  solution: string;                 // "function example() {\n  return 42;\n}"
  hints: string[];                  // Progressive hints
  language: string;                 // "javascript", "python", etc.
}

interface ConceptMatch {
  type: "concept-match";
  bloom: string;
  difficulty: number;
  pairs: [string, string][];        // [["Term", "Definition"], ...]
  distractorDefinitions: string[];  // Extra wrong definitions
}

// ── Activities (new) ──

type Activity = CodeExercise | GuidedExploration | BuildChallenge
              | DebugChallenge | ArchitecturePuzzle;

interface ActivityBase {
  id: string;                       // "act-s3-1"
  type: string;                     // Discriminator
  title: string;                    // "Build a Route Handler"
  description: string;
  estimatedMinutes: number;         // 5
  bloomLevel: string;
  hints: string[];                  // Progressive hints (3 max)
}

interface CodeExercise extends ActivityBase {
  type: "code-exercise";
  language: string;                 // "javascript"
  starterCode: string;
  solution: string;
  expectedPatterns: ValidationPattern[];
}

interface GuidedExploration extends ActivityBase {
  type: "guided-exploration";
  fileTree: ExplorerNode[];
  fileContents: Record<string, string>;  // path -> content
  steps: ExplorationStep[];
}

interface BuildChallenge extends ActivityBase {
  type: "build-challenge";
  language: string;
  scaffoldCode: string;
  solution: string;
  steps: BuildStep[];
}

interface DebugChallenge extends ActivityBase {
  type: "debug-challenge";
  language: string;
  buggyCode: string;
  fixedCode: string;
  bugs: BugSpec[];
}

interface ArchitecturePuzzle extends ActivityBase {
  type: "architecture-puzzle";
  pieces: string[];                 // Component names (shuffled for display)
  correctOrder: string[];           // Correct arrangement
  connections: [string, string][];  // Which pieces connect
}

// ── Supporting types ──

interface ValidationPattern {
  type: "contains" | "regex" | "not_contains";
  value: string;
  hint: string;                     // Shown on failure
  pass_msg?: string;
  fail_msg?: string;
}

interface ExplorerNode {
  name: string;
  type: "file" | "directory";
  children?: ExplorerNode[];
  isTarget?: boolean;               // Highlighted as exploration target
}

interface ExplorationStep {
  instruction: string;
  targetFile?: string;              // File to open for this step
}

interface BuildStep {
  title: string;
  description: string;
  patterns: ValidationPattern[];    // Validation for this step
  fail_msg: string;
}

interface BugSpec {
  test_name: string;                // "Variable name typo"
  description: string;              // "userId is referenced as usrId"
  buggy_pattern: string;            // Regex matching the bug
  fixed_pattern: string;            // Regex matching the fix
  hint: string;
}

interface VideoTimestamp {
  start: number;                    // Seconds
  end: number;
  paragraph: number;                // Index into lectureScript paragraphs
}

// ── Glossary (enhanced) ──

interface GlossaryEntry {
  term: string;                     // "GNN"
  definition: string;               // "Graph Neural Network -- ..."
  category: string;                 // "algorithm" | "data-structure" |
                                    // "architecture" | "api" | "concept" |
                                    // "tool" | "metric" | "acronym"
  firstIntroduced: string;          // "s2" (section ID)
  related: string[];                // ["GAT", "message passing"]
}

// ── Citations (unchanged) ──

interface Citation {
  id: string;                       // "c1"
  title: string;                    // "Attention Is All You Need"
  url: string;                      // "https://arxiv.org/..."
  accessed: string;                 // "2026-04-13"
  relevance: string;                // "Describes the transformer architecture"
  sections: string[];               // ["s3", "s5"]
}
```

## Schema Versioning

The `meta.version` field tracks schema changes:

| Version | Changes |
|---------|---------|
| `1.0.0` | Original schema (existing skill): meta, sections, glossary, citations |
| `2.0.0` | This document: video fields, activities, bloom levels, instructor meta, source tracking |

The course engine JavaScript checks `meta.version` and applies appropriate
defaults for missing fields, enabling forward compatibility:

```javascript
// Handle v1 courses loaded in v2 engine
if (!COURSE_DATA.meta.version || COURSE_DATA.meta.version < "2.0.0") {
  COURSE_DATA.meta.hasVideo = false;
  COURSE_DATA.meta.totalActivities = 0;
  COURSE_DATA.sections.forEach(s => {
    s.activities = s.activities || [];
    s.videoUrl = s.videoUrl || null;
  });
}
```

## Size Considerations

The COURSE_DATA object is embedded as a JavaScript literal in the HTML.
Its size varies significantly with course complexity:

| Component | Typical Size | Notes |
|-----------|-------------|-------|
| meta | 500 bytes | Fixed overhead |
| sections (8) content | 15-30 KB | lectureScript HTML is the bulk |
| assessments (16) | 8-15 KB | Question text + explanations |
| activities (8) | 10-25 KB | Starter code + solutions are verbose |
| glossary (40 terms) | 4-8 KB | Definitions |
| citations (15) | 2-4 KB | URLs + relevance |
| **Total** | **40-85 KB** | As embedded JSON-in-JS |

This is well within the 500KB HTML target even after adding all the CSS/JS
template code (~30KB minified).

## Validation Rules

The `validate-course.js` script checks these structural rules:

```
COURSE_DATA must exist as a const declaration
meta.title must be non-empty
meta.sectionCount must equal sections.length
meta.totalQuestions must equal sum of section assessment counts
meta.totalActivities must equal sum of section activity counts
meta.version must be "2.0.0"

For each section:
  id must match pattern /^s\d+$/
  title must be non-empty
  lectureScript must be non-empty HTML
  assessments must be an array (may be empty)
  activities must be an array (may be empty)
  bloomLevel must be one of the 6 Bloom's levels
  
  If hasVideo:
    videoUrl must be a relative path ending in .mp4
    videoDuration must be > 0

  For each assessment:
    type must be one of the 3 known types
    If multiple-choice:
      options.length must be 4
      correct must be 0-3
      explanation must be non-empty

  For each activity:
    type must be one of the 5 known types
    id must match pattern /^act-s\d+-\d+$/
    hints must be an array with 1-3 entries

glossary must be a non-empty array
Each glossary entry must have term, definition, category, firstIntroduced
firstIntroduced must reference an existing section ID

citations must be an array (may be empty for codebase-only courses)
Each citation must have id, title, url, accessed
```

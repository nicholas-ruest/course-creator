# Implementation Prompts

## How To Use This Document

This document contains **10 sequential implementation prompts**. Each prompt is
a self-contained instruction set designed to be handed to a coding agent (or
followed by a developer) to build one vertical slice of the course-creator
platform.

**Rules:**
1. Execute prompts **in order**. Each prompt declares its dependencies and
   assumes all prior prompts have been completed.
2. Do not skip prompts. Later prompts reference files, types, and exports
   created by earlier ones.
3. Each prompt includes a **Verification** section. Do not proceed to the
   next prompt until all verification checks pass.
4. Each prompt references specific ADRs and DDDs. Read the referenced
   documents before implementing -- they contain the exact schemas, patterns,
   and rationale.

---

## Prompt 1: Project Scaffold & Configuration

### References
- **SPARC.md** Section 3.4 (File Structure)
- **DDD-004** (COURSE_DATA Schema -- `config.js` defaults)
- **ADR-004** Section "ContentBundle Schema" (data type stubs)

### Dependencies
None -- this is the foundation.

### Instruction

Set up the project structure, package.json, and configuration module.

1. **Initialize the project:**
   - Create `package.json` with `name: "course-creator"`, `type: "module"`,
     `node engine: ">=18"`.
   - Add `"bin": { "course-creator": "./src/cli.js" }`.
   - No external runtime dependencies yet -- only dev dependencies:
     `vitest` for testing.
   - Add scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

2. **Create the directory structure** (empty files are fine as placeholders,
   but the directories must exist):
   ```
   src/
     ingestion/
     agents/
     video/
     generator/
     validation/
     cli.js              <- Entry point (stub: parse args, print usage)
     orchestrator.js      <- Pipeline coordinator (stub: export async function generateCourse)
     config.js            <- Configuration with defaults
   resources/
     templates/           <- Copy agentics-shell.html from course/resources/templates/
     brand/               <- Copy brand assets from course/resources/brand/
   tests/
   courses/               <- Output directory (gitignored)
   ```

3. **Implement `src/config.js`:**
   - Export a `DEFAULTS` object with the exact structure from SPARC.md
     Section 4.6 (Configuration Defaults):
     - `heygen`: avatar_id, voice_id, background_color, resolution,
       max_script_words (400), poll_interval_ms (15000), timeout_ms (600000),
       max_retries (3).
     - `ingestion`: token_budget (100000), max_files (500),
       max_file_size_bytes (102400), max_repo_size_mb (500), clone_depth (1),
       max_crawl_pages (20).
     - `course`: min_sections (3), max_sections (12), default_sections ("auto"),
       assessments_per_section (2), activities_per_section (1),
       min_font_size_rem (0.8), target_file_size_kb (300).
     - `output`: dir ("courses"), video_dir ("videos"),
       manifest_file ("manifest.json").
   - Export a `loadConfig(overrides)` function that deep-merges user overrides
     onto DEFAULTS.
   - Read `HEYGEN_API_KEY` and `GITHUB_TOKEN` from `process.env`.

4. **Create `src/cli.js`** (stub):
   - Parse `process.argv` for the source string and options (`--no-video`,
     `--no-quizzes`, `--sections N`, `--avatar`, `--voice`, `--deep`,
     `--quick`, `--audience`).
   - Print parsed config to stdout.
   - Call `generateCourse(source, options)` from orchestrator (which is a
     stub that just logs "Not yet implemented").

5. **Copy the existing skill assets:**
   - Copy `course/resources/templates/agentics-shell.html` to
     `resources/templates/agentics-shell.html`.
   - Copy `course/resources/brand/*` to `resources/brand/`.
   - Copy `course/scripts/validate-course.js` to `src/validation/validate-course.js`.
   - Copy `course/scripts/verify-content.js` to `src/validation/verify-content.js`.

6. **Add `.gitignore`:**
   - `node_modules/`, `courses/`, `.course-creator-cache/`, `.env`.

### Verification
- `node src/cli.js anthropics/claude-code` prints parsed config and
  "Not yet implemented".
- `node src/cli.js --help` prints usage with all options listed.
- `npm test` runs vitest (0 tests, 0 failures).
- Directory structure matches SPARC.md Section 3.4.
- `src/config.js` exports `DEFAULTS` and `loadConfig`.

---

## Prompt 2: Input Classifier

### References
- **ADR-004** (Multi-Source Ingestion with Unified ContentBundle)
- **DDD-003** Section "Input Classification" (regex patterns, ambiguity rules)

### Dependencies
- Prompt 1 (project scaffold, config.js)

### Instruction

Implement the Input Classifier that parses a user's source string and returns
a structured descriptor.

1. **Create `src/ingestion/classifier.js`:**
   - Export a function `classifySource(input)` that takes a raw source string
     and returns a descriptor object.
   - Implement the exact `PATTERNS` array from DDD-003 Section "Pattern
     Matching Rules" -- 7 patterns checked in order:
     1. `github_url` -- matches `https://github.com/{owner}/{repo}...`
        extracts owner, repo, branch (optional), path (optional).
     2. `github_slug_with_path` -- matches `owner/repo/path/...`
        extracts owner, repo, path.
     3. `github_slug` -- matches `owner/repo` exactly.
        extracts owner, repo.
     4. `npm_package` -- matches `npm:{name}` (including scoped `@org/pkg`).
     5. `pypi_package` -- matches `pypi:{name}`.
     6. `documentation_url` -- matches any `http://` or `https://` URL.
     7. `local_path` -- matches `./` or `/` prefixed paths.
   - First matching pattern wins.
   - For ambiguous single-word inputs (no prefix, no slash), throw an error
     with a helpful message listing valid formats -- per DDD-003 "Ambiguity
     Resolution" table.

2. **Create `tests/classifier.test.js`:**
   - Test every source type format from ADR-004 Section 1.4 input table:
     - `"anthropics/claude-code"` -> `{ type: "github_slug", owner: "anthropics", repo: "claude-code", path: null, branch: null }`
     - `"vercel/next.js/packages/next/src/server"` -> `{ type: "github_slug", owner: "vercel", repo: "next.js", path: "packages/next/src/server" }`
     - `"https://github.com/vercel/next.js/tree/canary/packages/next"` -> `{ type: "github_url", owner: "vercel", repo: "next.js", branch: "canary", path: "packages/next" }`
     - `"npm:zod"` -> `{ type: "npm_package", package: "zod" }`
     - `"npm:@anthropic-ai/sdk"` -> `{ type: "npm_package", package: "@anthropic-ai/sdk" }`
     - `"pypi:fastapi"` -> `{ type: "pypi_package", package: "fastapi" }`
     - `"https://docs.python.org/3/library/asyncio.html"` -> `{ type: "documentation_url", url: "..." }`
     - `"./src/lib"` -> `{ type: "local_path", path: "./src/lib" }`
   - Test ambiguity rejection: `"express"` alone should throw.
   - Test edge cases: repos with dots (`"tj/co"`, `"user/my.repo"`),
     repos with hyphens.

### Verification
- `npm test` -- all classifier tests pass.
- `node -e "import('./src/ingestion/classifier.js').then(m => console.log(m.classifySource('anthropics/claude-code')))"` prints the correct descriptor.

---

## Prompt 3: File Scorer & ContentBundle Extractor

### References
- **ADR-007** (File Importance Scoring for Token Budget Management)
- **DDD-003** Sections "File Importance Scorer" and "ContentBundle Assembly"
- **ADR-004** Section "ContentBundle Schema"

### Dependencies
- Prompt 1 (config.js with `ingestion.token_budget`)
- Prompt 2 (classifier.js)

### Instruction

Implement the file importance scorer and ContentBundle assembly logic. These
components work on an already-fetched workspace directory (the actual fetching
is Prompt 4). Building them first allows isolated unit testing with fixture
directories.

1. **Create `src/ingestion/scorer.js`:**
   - Export `scoreFile(filePath, repoRoot)` implementing the exact scoring
     rubric from ADR-007:
     - Entry points (`index.js`, `main.py`, `app.ts`, `lib.rs`, `mod.rs`,
       `__init__.py`): +100
     - README/CONTRIBUTING/ARCHITECTURE: +90/+70
     - Config files (package.json, tsconfig, pyproject.toml, Cargo.toml,
       go.mod): +80
     - `src/` or `lib/` directories: +60
     - `core/`, `internal/`, `pkg/`: +50
     - Type definitions (.d.ts, types.ts, interfaces.ts): +50
     - Examples/samples directories: +40
     - Documentation in `docs/`: +35
     - Test files: +30
     - CI/CD (.github/): +15
     - Generated output (dist/, build/, .next/, target/): -100
     - Vendor (node_modules/, vendor/): -200
     - Lock files: -150
     - Large files (>50KB: -20, >100KB: -50)
     - Minified files: -200
   - Export `selectFilesWithinBudget(scoredFiles, tokenBudget)` from DDD-003:
     - Sort by score descending.
     - Skip negatively-scored files.
     - Estimate tokens as `Math.ceil(fileSize / 4)`.
     - Accumulate files until budget exhausted.
     - Return `{ selected, remaining, skipped }`.

2. **Create `src/ingestion/extractor.js`:**
   - Export `async function extractContentBundle(workspacePath, sourceDescriptor, config)`.
   - Implement the assembly order from DDD-003 "ContentBundle Assembly":
     1. Read README and top-level docs (always, regardless of score).
     2. Read config files (package.json, pyproject.toml, Cargo.toml, etc.).
     3. Build file tree (directory listing via `fs.readdirSync` recursive,
        max depth 4, respecting `IGNORE_PATTERNS` from DDD-003).
     4. Detect languages by extension frequency.
     5. Find entry points by name pattern.
     6. Discover all source files matching `SOURCE_EXTENSIONS` from DDD-003
        (`.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.py`, `.pyi`, `.rs`,
        `.go`, `.java`, `.kt`, `.rb`, `.c`, `.h`, `.cpp`, `.hpp`, `.md`,
        `.json`, `.yaml`, `.yml`, `.toml`).
     7. Score all discovered files via `scorer.js`.
     8. Select files within token budget via `selectFilesWithinBudget`.
     9. Read selected files and populate `key_files[]`.
     10. Read type definitions (separate 10K budget).
     11. Read sample test files (separate 10K budget, max 5 files).
     12. Read examples (separate 10K budget, max 5 files).
   - Return a `ContentBundle` object matching the schema from ADR-004.
   - Log a summary: files discovered, files read, token usage, languages,
     entry points (per DDD-003 "Logging" section).

3. **Create `tests/scorer.test.js`:**
   - Test that `src/index.ts` scores higher than `tests/foo.test.ts`.
   - Test that `node_modules/foo/bar.js` scores deeply negative.
   - Test that `README.md` scores higher than `docs/guide.md`.
   - Test that `dist/bundle.js` scores negative.
   - Test budget selection: given 10 files with known sizes/scores, verify
     correct selection and budget accounting.

4. **Create `tests/extractor.test.js`:**
   - Create a fixture directory (`tests/fixtures/sample-repo/`) with a
     realistic mini repo structure: README.md, package.json, src/index.js,
     src/lib/utils.js, src/types.d.ts, tests/index.test.js,
     node_modules/dep/index.js, dist/bundle.js.
   - Test that `extractContentBundle` produces a ContentBundle with:
     - readme populated.
     - package_json populated.
     - key_files contains src/ files but NOT node_modules/ or dist/ files.
     - languages detected (JavaScript).
     - entry_points includes `src/index.js`.

### Verification
- `npm test` -- all scorer and extractor tests pass.
- ContentBundle from the fixture repo contains exactly the expected files.
- Token budget is respected (no over-budget selections).

---

## Prompt 4: Source Ingesters (GitHub, URL, Package)

### References
- **ADR-004** (Multi-Source Ingestion with Unified ContentBundle)
- **DDD-003** Sections "GitHub Ingester", "URL Ingester", "Package Ingester"

### Dependencies
- Prompt 2 (classifier.js -- source descriptors)
- Prompt 3 (extractor.js -- ContentBundle assembly from workspace)

### Instruction

Implement the three source-type-specific ingesters that fetch content and
delegate to the extractor for ContentBundle assembly.

1. **Create `src/ingestion/github.js`:**
   - Export `async function ingestGitHub(descriptor, config)`.
   - Clone strategy from DDD-003:
     - If `process.env.GITHUB_TOKEN` is set: use
       `gh repo clone {owner}/{repo} {tempDir} -- --depth 1`.
     - Else: use
       `git clone --depth 1 https://github.com/{owner}/{repo}.git {tempDir}`.
     - If `descriptor.path` is set: use sparse checkout:
       ```
       git clone --depth 1 --filter=blob:none --sparse {url} {tempDir}
       cd {tempDir} && git sparse-checkout set {path}
       ```
     - If `descriptor.branch` is set: add `--branch {branch}` to clone.
   - Clone into a temp directory (`os.tmpdir()` + random suffix).
   - Apply size guards from DDD-003:
     - Clone timeout: 60 seconds.
     - If descriptor.path is set, use it as `workspacePath` for the extractor
       (not the repo root).
   - Call `extractContentBundle(workspacePath, descriptor, config)`.
   - Return the ContentBundle.

2. **Create `src/ingestion/url.js`:**
   - Export `async function ingestURL(descriptor, config)`.
   - Fetch strategy from DDD-003 "URL Ingester":
     - Fetch the primary URL (use Node `fetch` or a lightweight HTTP client).
     - Extract text content, headings (`<h1>`-`<h6>`), code blocks
       (`<pre>`, `<code>`), paragraphs (`<p>`, `<li>`).
     - Find internal links (same domain, max depth 1).
     - Follow up to `config.ingestion.max_crawl_pages` (20) linked pages.
     - Extract content from each linked page.
   - Assemble a documentation-focused ContentBundle per DDD-003
     "Documentation URL ContentBundle":
     - `workspace_path: null`.
     - `file_tree: []`, `languages: []`, `key_files: []` (empty).
     - Content goes in `docs[]` array.
   - Do NOT follow external links, download resources, or execute JavaScript.

3. **Create `src/ingestion/package.js`:**
   - Export `async function ingestPackage(descriptor, config)`.
   - npm resolution from DDD-003:
     - `GET https://registry.npmjs.org/{packageName}` (use Node `fetch`).
     - Extract `repository.url` to find GitHub URL.
     - Parse the GitHub URL into an owner/repo descriptor.
     - Delegate to `ingestGitHub`.
     - Enrich ContentBundle with `registry_metadata`: name, version,
       description, keywords.
   - PyPI resolution from DDD-003:
     - `GET https://pypi.org/pypi/{packageName}/json`.
     - Extract `info.project_urls.Source` or `info.project_urls.Repository`.
     - Parse the GitHub URL, delegate to `ingestGitHub`.
     - Enrich with PyPI metadata.
   - Resolution failure from DDD-003: if no GitHub URL is found, try
     `info.project_urls.Homepage`. If still unresolved, throw with helpful
     message.

4. **Create `src/ingestion/index.js`:**
   - Export `async function ingest(source, config)` -- the top-level entry
     point.
   - Call `classifySource(source)` to get the descriptor.
   - Route to the correct ingester based on `descriptor.type`:
     - `github_slug`, `github_url` -> `ingestGitHub`
     - `documentation_url` -> `ingestURL`
     - `npm_package`, `pypi_package` -> `ingestPackage`
     - `local_path` -> `extractContentBundle(descriptor.path, descriptor, config)` directly.
   - Return the ContentBundle.

5. **Create `tests/ingestion.test.js`:**
   - Test GitHub ingester with a small public repo (use a known tiny repo,
     or mock `child_process.execSync` to simulate git clone).
   - Test URL ingester with a mock HTML page (use a fixture HTML string).
   - Test npm resolver: mock the registry response for `zod`, verify it
     extracts the correct GitHub URL.
   - Test the top-level `ingest` routing for each source type.

### Verification
- `npm test` -- all ingestion tests pass.
- `node -e "import('./src/ingestion/index.js').then(m => m.ingest('./course').then(b => console.log(b.readme?.substring(0,100))))"` prints the first 100 chars of the local `course/` directory's README (or SKILL.md content).
- The GitHub ingester clones, extracts, and cleans up the temp directory.

---

## Prompt 5: COURSE_DATA v2 Schema & Enhanced Validators

### References
- **DDD-004** (COURSE_DATA Schema Design -- complete TypeScript interfaces)
- **ADR-005** (Two-Gate Content Verification Pipeline)
- **ADR-001** (Output format -- manifest.json)

### Dependencies
- Prompt 1 (existing validate-course.js and verify-content.js copied into place)
- Prompt 3 (ContentBundle type -- used by verify-content enhancements)

### Instruction

Define the v2 COURSE_DATA schema, build the JSON builder, and enhance both
validation gates.

1. **Create `src/generator/course-data.js`:**
   - Export `function buildCourseData(unifiedOutline, options)` that assembles
     the COURSE_DATA JavaScript object matching the complete schema from
     DDD-004.
   - The function takes a unified outline (the synthesized output of the
     educator agents) and returns:
     ```javascript
     {
       meta: {
         title, topic, generated, sectionCount, totalQuestions,
         source, sourceType, audience, estimatedDuration,
         totalActivities, totalVideoDuration, hasVideo,
         version: "2.0.0", generator: "course-creator/1.0.0",
         instructor: { name, emoji, role, avatarId, voiceId }
       },
       sections: [{ id, title, bloomLevel, learningObjectives,
         estimatedMinutes, prerequisites, lectureScript,
         videoUrl, videoPoster, videoDuration, videoTimestamps,
         assessments, activities, termCount, hasVisualization,
         hasCodeBlock }],
       glossary: [{ term, definition, category, firstIntroduced, related }],
       citations: [{ id, title, url, accessed, relevance, sections }]
     }
     ```
   - Compute derived fields:
     - `totalQuestions` = sum of all section assessment counts.
     - `totalActivities` = sum of all section activity counts.
     - `estimatedDuration` = sum of section `estimatedMinutes`.
     - `totalVideoDuration` = sum of section `videoDuration` (0 if no video).
   - Export `function buildManifest(courseData, videoManifest)` that produces
     the `manifest.json` structure from SPARC.md Section 3.3 `CourseManifest`.

2. **Enhance `src/validation/validate-course.js`:**
   Add the following checks from ADR-005 "Gate 2 Enhancements", preserving
   all existing checks:
   - `meta.version` exists and equals `"2.0.0"`.
   - `meta.totalActivities` equals the actual sum of activity arrays.
   - For each section with `videoUrl`: verify a corresponding `.mp4` file
     exists on disk (check relative to the HTML file's directory).
   - For each section: if `activities` array is non-empty, verify each
     activity has `id`, `type`, `title`, and `hints` (array with 1-3 entries).
   - Activity `type` must be one of: `code-exercise`, `guided-exploration`,
     `build-challenge`, `debug-challenge`, `architecture-puzzle`.
   - Activity `id` must match pattern `/^act-s\d+-\d+$/`.
   - Verify the video player HTML is present when `meta.hasVideo` is true:
     check for `id="instructor-video"` and `id="lecturer-video"`.
   - Verify transcript element exists: `id="lecturer-transcript"` or
     `id="lecturer-dialogue"`.

3. **Enhance `src/validation/verify-content.js`:**
   Add the following checks from ADR-005 "Gate 1 Enhancements":
   - Accept an optional `--workspace` argument pointing to the ingested
     workspace directory (the cloned repo). When provided, all file path
     verification runs against that workspace rather than CWD.
   - New `--check-activities` mode: takes a JSON file of activity
     specifications and validates:
     - `starterCode` and `solution` fields parse as valid JavaScript/Python
       (use a simple syntax check -- try `new Function(code)` for JS,
       or regex-based brace/paren matching as fallback).
     - `expectedPatterns` with type `"regex"` are valid regular expressions
       (try `new RegExp(pattern)`).

4. **Create `tests/course-data.test.js`:**
   - Test `buildCourseData` with a minimal outline fixture (2 sections, 1
     quiz each, 1 activity, 3 glossary terms, 1 citation).
   - Verify all computed fields are correct.
   - Verify `meta.version` is `"2.0.0"`.
   - Test `buildManifest`.

5. **Create `tests/validation.test.js`:**
   - Test the enhanced `validate-course.js` against a fixture HTML string
     that includes v2 features (activities, video manifest).
   - Test that missing video files are flagged.
   - Test that invalid activity types are caught.

### Verification
- `npm test` -- all schema and validation tests pass.
- Running `node src/validation/validate-course.js` against the existing
  `resources/templates/agentics-shell.html` produces warnings (no COURSE_DATA)
  but does not crash.

---

## Prompt 6: HTML Generator & Template Engine

### References
- **ADR-001** (Single-File HTML Output)
- **DDD-006** (Brand System Extension -- new CSS variables, component inventory)
- **SPARC.md** Section 2.5 (HTML Generation pseudocode)
- Existing `resources/templates/agentics-shell.html` (the base template)

### Dependencies
- Prompt 5 (course-data.js -- `buildCourseData`, `buildManifest`)
- Prompt 1 (agentics-shell.html copied to resources/templates/)

### Instruction

Implement the HTML generator that takes a unified outline and produces the
final course HTML file. This prompt builds the text-only version (no video
player, no activities yet -- those are layered in later prompts).

1. **Create `src/generator/template.js`:**
   - Export `function loadTemplate()` that reads
     `resources/templates/agentics-shell.html` and returns it as a string.
   - Export `function fillPlaceholders(html, data)` that replaces:
     - `{{COURSE_TITLE}}` -> `data.title`
     - `{{AVATAR_EMOJI}}` -> `data.instructor.emoji`
     - `{{INSTRUCTOR_NAME}}` -> `data.instructor.name`
     - `{{COURSE_DATA_JSON}}` -> `JSON.stringify(data.courseData)` (the
       COURSE_DATA object, inserted into the `const COURSE_DATA = ...;` slot).

2. **Create `src/generator/sections.js`:**
   - Export `function generateSectionHTML(section, index)` that produces the
     HTML for one course section.
   - Follow the exact component structure from the existing agentics-shell.html
     section template comment (lines 508-534):
     ```html
     <div class="section" data-section="{id}">
       <div class="section-label">{padded index} -- {title}</div>
       <h2>{title}</h2>
       {content paragraphs}
       {analogy box if present}
       {code blocks}
       {demo container if visualization specified}
       {vernacular box -- MANDATORY}
       {key insight if present}
     </div>
     ```
   - Wrap glossary terms at first occurrence per section using `.term` spans
     with `.term-tooltip` (per SKILL.md "Terminology Integration" rules).
   - Generate the vernacular `<dl>` from the section's terms array.
   - All content must be HTML-escaped to prevent XSS (section titles, term
     definitions, any user-derived text).

3. **Create `src/generator/html.js`:**
   - Export `async function generateHTML(unifiedOutline, options, config)`.
   - Orchestrate the full HTML generation:
     1. `loadTemplate()`.
     2. Build COURSE_DATA via `buildCourseData(unifiedOutline, options)`.
     3. Generate section HTML for all sections via `generateSectionHTML`.
     4. Generate nav items HTML for the lecturer nav list.
     5. Generate the citations section at the bottom of content.
     6. Inject all generated HTML into the template at the correct insertion
        points (`<main class="content">`, `<ul id="lecturer-nav">`).
     7. Fill placeholders via `fillPlaceholders`.
   - Return the complete HTML string.

4. **Create `src/generator/index.js`:**
   - Export `async function writeCourseToDisk(html, slug, videoManifest, config)`.
   - Implements the output logic from ADR-001:
     - If no video: write `courses/{slug}.html` (single file).
     - If video: create `courses/{slug}/` directory, write `index.html`,
       create `videos/` subdirectory, write `manifest.json` via
       `buildManifest`.
   - Create the `courses/` directory if it does not exist.

5. **Create `tests/generator.test.js`:**
   - Build a minimal unified outline fixture (2 sections, instructor data,
     3 glossary terms, 1 citation).
   - Call `generateHTML` and verify:
     - Output is valid HTML (contains `<!DOCTYPE html>`, `</html>`).
     - COURSE_DATA is embedded and parseable.
     - Both sections appear with correct data-section attributes.
     - Glossary terms are wrapped with `.term` spans.
     - Vernacular boxes are present in each section.
     - Nav list has the correct `<li>` items.
     - Citations section is populated.
   - Call `writeCourseToDisk` and verify files are written to the correct
     paths.

### Verification
- `npm test` -- all generator tests pass.
- The generated HTML can be opened in a browser and shows the 3-pane layout
  with 2 test sections, working nav, and a populated glossary.

---

## Prompt 7: Activity Engine & Activity Designer Agent

### References
- **ADR-008** (In-Browser Activity System with Client-Side Validation)
- **ADR-002** (Seven-Agent Educator Swarm -- Activity Designer spec)
- **DDD-002** (Activity Engine -- complete HTML, CSS, JS, data model)
- **DDD-006** (Brand System Extension -- activity type colors, badges)

### Dependencies
- Prompt 5 (COURSE_DATA v2 schema with activity types defined)
- Prompt 6 (HTML generator -- we extend it with activity injection)

### Instruction

Implement the activity engine (client-side JS/CSS/HTML) and the Activity
Designer agent prompt, then integrate activities into the HTML generator.

1. **Create `src/generator/activities.js`:**
   - Export `function generateActivityHTML(activity)` that produces the HTML
     for a single activity card. Implement all 5 activity types from DDD-002:
     - **Code Exercise**: Activity card with textarea editor, Check Solution /
       Hint / Show Solution buttons, feedback area. Use the exact HTML from
       DDD-002 "Type 1: Code Exercise".
     - **Guided Exploration**: File tree (nested `<details>` elements) + file
       preview pane + step checklist. Use DDD-002 "Type 2".
     - **Build Challenge**: Multi-step checklist with step status indicators +
       textarea editor + Check Current Step button. Use DDD-002 "Type 3".
     - **Debug Challenge**: Bug count badge + scenario description + textarea
       with pre-filled buggy code + Run Tests button + test results area.
       Use DDD-002 "Type 4".
     - **Architecture Puzzle**: Draggable pieces area + drop target slots +
       Check Arrangement button. Use DDD-002 "Type 5".
   - Export `function generateActivityCSS()` that returns the complete CSS
     from DDD-002 "CSS Specification" -- all `.activity-card`, `.activity-badge`,
     `.activity-editor`, `.feedback-item`, `.hint-item`, `.file-explorer`,
     `.challenge-step`, `.debug-*`, `.puzzle-*` styles.
   - Export `function generateActivityJS()` that returns the complete
     JavaScript activity engine from DDD-002 "JavaScript: Activity Engine" --
     `initActivities()`, `checkActivity()`, `checkDebug()`,
     `checkBuildStep()`, `checkExplorationProgress()`, `checkPuzzle()`,
     `showNextHint()`, `showSolution()`, `resetActivity()`,
     `markActivityComplete()`.

2. **Integrate activities into `src/generator/sections.js`:**
   - After code blocks and before the vernacular box in each section,
     inject activity cards:
     ```html
     {code blocks}
     {activity cards -- for each activity in section.activities}
     {vernacular box}
     {key insight}
     ```
   - Each activity card is produced by `generateActivityHTML(activity)`.

3. **Integrate CSS and JS into `src/generator/html.js`:**
   - Inject `generateActivityCSS()` into the `<style>` block.
   - Inject `generateActivityJS()` into the `<script>` block, after the
     existing quiz engine code.
   - Add the new CSS variables from DDD-006 to the `:root` block:
     `--activity-blue`, `--activity-blue-dim`, `--activity-purple`,
     `--activity-purple-dim`.

4. **Create `src/agents/activity-designer.md`:**
   - Write the Activity Designer agent prompt from ADR-002 Agent 7 spec and
     SPARC.md Section 2.3.
   - The prompt must instruct the agent to:
     - Design 1-2 activities per section.
     - Select activity type based on Bloom's taxonomy level.
     - Provide starter code, validation patterns, hints, solutions.
     - Output as markdown with JSON-ready structure per DDD-004 Activity
       interfaces.

5. **Create `tests/activities.test.js`:**
   - Test `generateActivityHTML` for each of the 5 activity types with
     fixture data matching DDD-004 activity interfaces.
   - Verify each produces valid HTML with the correct data attributes.
   - Test that activity CSS contains all required class selectors.
   - Test that activity JS contains all required function declarations.
   - Test a full section HTML with an embedded activity: verify the activity
     card appears between code block and vernacular box.

### Verification
- `npm test` -- all activity tests pass.
- Generate an HTML file with the fixture outline from Prompt 6, but now
  with activities added to sections. Open in browser:
  - Code Exercise: textarea renders, Hint button reveals hints.
  - Guided Exploration: file tree expands, checklist checks off.
  - Build Challenge: step indicators show.
  - Debug Challenge: bug badge displays count.
  - Architecture Puzzle: pieces are draggable.

---

## Prompt 8: TTS Sanitizer & HeyGen API Client

### References
- **ADR-003** (Asynchronous HeyGen Video Pipeline)
- **ADR-006** (Video Caching by Script Hash)
- **DDD-005** (TTS Sanitization Pipeline -- 7 stages, term expansions, tests)

### Dependencies
- Prompt 1 (config.js with `heygen` defaults)
- Prompt 5 (COURSE_DATA sections with `lectureScript` field)

### Instruction

Implement the TTS sanitization pipeline and the HeyGen API client with caching.

1. **Create `src/video/tts-sanitizer.js`:**
   - Implement all 7 stages from DDD-005 exactly:
     - Stage 1: `stripHtml(html)` -- remove tags, preserve `<br>` as newlines,
       `</p><p>` as double newlines.
     - Stage 2: `decodeEntities(text)` -- full `ENTITY_MAP` from DDD-005
       (19 entities + numeric entity handling).
     - Stage 3: `expandTerms(text)` -- the complete `TERM_EXPANSIONS` table
       from DDD-005 (50+ entries). Sort by length descending, word-boundary
       matching.
     - Stage 4: `humanizeCodeRefs(text)` -- file paths to "the file X slash
       Y dot Z", function refs to "the X function", variable refs to spaced
       camelCase. Include the `camelToWords(str)` helper.
     - Stage 5: `normalizePunctuation(text)` -- collapse whitespace, em dashes
       to commas, normalize quotes.
     - Stage 6: `insertPauses(text)` -- double newlines at paragraph breaks,
       before transition words.
     - Stage 7: `enforceLength(text, maxWords)` -- truncate at paragraph
       boundary, then sentence boundary. Default 400 words.
   - Export `sanitizeForTTS(lecturerScript)` as the top-level pipeline
     function that chains all 7 stages.
   - Export each stage function individually for unit testing.

2. **Create `src/video/cache.js`:**
   - Export `class VideoCache`:
     - Constructor takes a cache directory path (default:
       `.course-creator-cache/videos/`).
     - `has(hash)` -- returns boolean.
     - `get(hash)` -- returns `{ videoPath, metadata }` or null.
     - `set(hash, videoPath, metadata)` -- copies video file to cache dir,
       writes metadata JSON.
     - `computeHash(script, avatarId, voiceId)` -- SHA-256 of
       `normalize(script) + "|" + avatarId + "|" + voiceId` per ADR-006.
       Normalize: trim, collapse whitespace.
   - Cache storage: `.course-creator-cache/videos/{hash}.mp4` +
     `{hash}.json` per ADR-006.
   - Create the cache directory on first write.

3. **Create `src/video/heygen.js`:**
   - Export `class HeyGenClient`:
     - Constructor takes `apiKey` and `config.heygen` options.
     - `async submitVideo(script, sectionId, options)`:
       - Sanitize script via `sanitizeForTTS(script)`.
       - Check cache via `VideoCache`. If hit, return cached result.
       - Build the request payload from ADR-003 / SPARC.md Section 2.4:
         ```json
         {
           "video_inputs": [{
             "character": { "type": "avatar", "avatar_id": "...", "avatar_style": "normal" },
             "voice": { "type": "text", "input_text": "...", "voice_id": "...", "speed": 1.0 },
             "background": { "type": "color", "value": "#FAF9F6" }
           }],
           "dimension": { "width": 1920, "height": 1080 },
           "aspect_ratio": "16:9"
         }
         ```
       - POST to `https://api.heygen.com/v2/video/generate` with header
         `X-Api-Key: {apiKey}`.
       - Return `{ video_id, status: "processing", script_hash, section_id }`.
     - `async pollVideoStatus(videoId)`:
       - GET `https://api.heygen.com/v1/video_status.get?video_id={videoId}`.
       - Return status object.
     - `async downloadVideo(videoUrl, outputPath)`:
       - Download the video file to the specified local path.
       - Store in cache.

4. **Create `src/video/poller.js`:**
   - Export `async function awaitAllVideos(jobs, client, config)`:
     - Implements the polling loop from SPARC.md Section 2.4
       `await_all_videos`:
     - Poll every `config.heygen.poll_interval_ms` (15s).
     - Timeout per video: `config.heygen.timeout_ms` (600s).
     - For completed videos: download to `courses/{slug}/videos/{sectionId}.mp4`.
     - For failed/timed-out: mark as failed, log warning.
     - Return the complete jobs array with updated statuses.
   - Implement the fallback table from ADR-003: completed -> video player,
     failed/timeout -> text lecturer.

5. **Create `tests/tts-sanitizer.test.js`:**
   - Implement ALL test cases from DDD-005 "Testing Strategy":
     - `stripHtml('<p>Hello <strong>world</strong></p>')` -> `'Hello world'`
     - `expandTerms('Use the API')` -> `'Use the A P I'`
     - `humanizeCodeRefs('\`processQuery()\`')` -> `'the process query function'`
     - `humanizeCodeRefs('in \`src/router/index.ts\`')` ->
       `'in the file src slash router slash index dot T S'`
     - Full integration test with the HTML input/output example from DDD-005.
   - Test `enforceLength` truncation at paragraph and sentence boundaries.
   - Test `TERM_EXPANSIONS` covers at least: API, HTML, CSS, JSON, npm,
     async, Kubernetes.

6. **Create `tests/heygen.test.js`:**
   - Mock the HeyGen API (do not make real API calls in tests).
   - Test `submitVideo`: verify payload structure, cache check, and return
     value.
   - Test `VideoCache`: verify hash computation, has/get/set lifecycle.
   - Test `awaitAllVideos` with mocked poll responses: simulate 2 completed
     + 1 failed scenario.

### Verification
- `npm test` -- all TTS and HeyGen tests pass.
- `node -e "import('./src/video/tts-sanitizer.js').then(m => console.log(m.sanitizeForTTS('<p>The API uses <code>processQuery()</code> from <code>src/router.ts</code>.</p>')))"` prints the expected natural-language output.
- VideoCache creates the cache directory and stores/retrieves entries.

---

## Prompt 9: Video Player Component & HTML Integration

### References
- **ADR-001** (Single-File HTML Output with Sidecar Video Directory)
- **ADR-003** (Asynchronous HeyGen Video Pipeline -- fallback table)
- **DDD-001** (Video Player Component -- complete HTML, CSS, JS spec)
- **DDD-006** (Brand System Extension -- video player brand integration)

### Dependencies
- Prompt 6 (HTML generator -- we modify the template and generator)
- Prompt 8 (HeyGen client + TTS sanitizer -- video pipeline is callable)

### Instruction

Implement the video player component and integrate it into the HTML generator
and orchestrator pipeline.

1. **Create `src/generator/video-player.js`:**
   - Export `function generateVideoPlayerHTML()` returning the exact HTML
     from DDD-001 "HTML Structure":
     - `<div class="lecturer-video">` with `<video>`, controls (play, progress,
       time, mute), and `.video-fallback` (avatar + name for graceful
       degradation).
     - Transcript section: `<div class="lecturer-transcript">` with
       `.transcript-header` and `.transcript-body`.
   - Export `function generateVideoPlayerCSS()` returning the complete CSS
     from DDD-001 "CSS Specification":
     - `.lecturer-video`, `.instructor-video-player`, `.video-controls`,
       `.video-ctrl-btn`, `.video-progress-track`, `.video-progress-fill`,
       `.video-time`, `.video-fallback`, `.lecturer-transcript`,
       `.transcript-header`, `.transcript-body`, `.transcript-active`.
     - Include the mobile mini-player `@media (max-width: 768px)` rule.
   - Export `function generateVideoPlayerJS()` returning the complete
     JavaScript from DDD-001 "JavaScript Specification":
     - `loadSectionVideo(sid)` -- loads video or shows fallback.
     - Play/pause, progress bar, mute, keyboard controls (Space, arrows, M).
     - `syncTranscript(currentTime)` -- highlights active transcript paragraph.
     - Video error handler -> show fallback.
     - Integration hook: `activateSection` calls `loadSectionVideo`.

2. **Modify `src/generator/html.js`:**
   - When `options.hasVideo` is true (NOT `--no-video`):
     - Replace the lecturer pane content in the template. Remove the static
       `lecturer-avatar`, `lecturer-name`, `lecturer-role`, and
       `lecturer-dialogue` elements. Insert the video player HTML from
       `generateVideoPlayerHTML()`.
     - Inject `generateVideoPlayerCSS()` into the `<style>` block.
     - Inject `generateVideoPlayerJS()` into the `<script>` block.
     - Modify the existing `activateSection` JS function to call
       `loadSectionVideo(sid)`.
   - When `options.hasVideo` is false:
     - Leave the template unchanged (text-only lecturer, backward compatible).
   - In both cases, ensure the lecturer pane retains the nav list and
     progress bar.

3. **Modify `src/generator/index.js` (`writeCourseToDisk`):**
   - When video manifest is provided:
     - Create `courses/{slug}/` directory.
     - Create `courses/{slug}/videos/` directory.
     - Copy downloaded video files from their temp locations to
       `courses/{slug}/videos/{sectionId}.mp4`.
     - Write `manifest.json`.
   - Patch the HTML's COURSE_DATA to include `videoUrl` paths per section
     (relative: `"videos/s1.mp4"`).

4. **Integrate into `src/orchestrator.js`:**
   - After synthesis (unified outline is ready), implement the parallel
     pipeline from ADR-003 "Timing Diagram":
     - Submit all HeyGen video jobs in parallel (one per section) via
       `HeyGenClient.submitVideo`.
     - Immediately proceed to HTML generation (do not wait for videos).
     - After HTML generation completes, enter video collection via
       `awaitAllVideos`.
     - Download completed videos.
     - Patch the HTML with video URLs.
     - Write everything to disk.
   - If `--no-video`: skip the entire video pipeline, generate text-only
     HTML.
   - If `HEYGEN_API_KEY` is not set and `--no-video` is not specified:
     warn and fall back to text-only (per ADR-003 fallback table).

5. **Update `src/validation/validate-course.js`:**
   - Add video-specific checks (from ADR-005 Gate 2):
     - If `meta.hasVideo`: verify `id="instructor-video"` exists in HTML.
     - If `meta.hasVideo`: verify `id="lecturer-transcript"` exists.
     - For each section with `videoUrl`: verify the video file exists on
       disk (relative to the HTML file's parent directory).

6. **Create `tests/video-player.test.js`:**
   - Test that `generateVideoPlayerHTML()` produces HTML with the required
     IDs: `instructor-video`, `video-source`, `video-play-btn`,
     `video-progress-fill`, `video-time`, `video-mute-btn`, `video-fallback`,
     `lecturer-transcript`, `transcript-body`.
   - Test that `generateVideoPlayerCSS()` contains all required selectors.
   - Test that `generateVideoPlayerJS()` contains `loadSectionVideo`,
     `syncTranscript`, and keyboard event listener.
   - Test HTML generation with `hasVideo: true` vs `hasVideo: false`:
     verify the video player is present/absent.

### Verification
- `npm test` -- all video player tests pass.
- Generate an HTML course with `hasVideo: true` (using fixture data with
  fake video URLs). Open in browser:
  - Video player area visible in left pane.
  - Transcript area visible below video.
  - Clicking a nav item updates the transcript text.
  - Play/pause button toggles icon.
  - Progress bar and time display render.
- Generate with `hasVideo: false`: verify text-only lecturer pane (emoji
  avatar, dialogue text).

---

## Prompt 10: Orchestrator, Agent Prompts & End-to-End Pipeline

### References
- **SPARC.md** Section 2.1 (Top-Level Orchestration pseudocode)
- **ADR-002** (Seven-Agent Educator Swarm -- all 7 agent specs)
- **ADR-005** (Two-Gate Verification -- Phase 3.5 flow, 30% rule)
- **DDD-006** (Brand System Extension -- course meta bar)
- All ADRs and DDDs (this is the integration prompt)

### Dependencies
- ALL prior prompts (1-9). This prompt wires everything together.

### Instruction

Implement the full orchestrator pipeline, all 7 agent prompt files, the
course meta bar, and the end-to-end CLI flow.

1. **Create all agent prompt files in `src/agents/`:**
   Each file is a Markdown document containing the system prompt for one
   educator agent. The prompts are adapted from SKILL.md Phases 2-3 and
   ADR-002:

   - `src/agents/curriculum-designer.md` -- SKILL.md Agent 1 prompt
     (section structure, Bloom's levels, learning objectives, progressive
     complexity curve, opening hook).
   - `src/agents/sme.md` -- SKILL.md Agent 2 prompt (technical content,
     code examples with `[VERIFIED: path]` markers, terminology extraction,
     anti-hallucination requirements, verification manifest).
   - `src/agents/visualization.md` -- SKILL.md Agent 3 prompt
     (per-section viz specs, type/interaction/priority, Canvas vs SVG vs
     Plotly preference order).
   - `src/agents/assessment.md` -- SKILL.md Agent 4 prompt (MC questions
     with plausible distractors, code-completion, concept-matching,
     Bloom's alignment, difficulty 1-5).
   - `src/agents/activity-designer.md` -- From ADR-002 Agent 7 and
     SPARC.md Section 2.3:
     - Design 1-2 activities per section.
     - Select type based on Bloom's level (Remember/Understand ->
       Guided Exploration; Apply -> Code Exercise; Analyze -> Debug
       Challenge; Evaluate/Create -> Build Challenge).
     - Output JSON-ready activity specs matching DDD-004 Activity interfaces.
   - `src/agents/research-librarian.md` -- SKILL.md Agent 5 prompt
     (citation manifest, source validation, hyper-current research).
   - `src/agents/ux-reviewer.md` -- SKILL.md Agent 6 prompt (font
     compliance, color contrast, keyboard nav, responsive strategy).

2. **Implement `src/orchestrator.js`:**
   - Export `async function generateCourse(source, options)`.
   - Implement the exact phase sequence from SPARC.md Section 2.1:

   **Phase 1: Ingestion**
   ```
   const content = await ingest(source, config);
   ```

   **Phase 2: Brief Assembly**
   - Analyze the ContentBundle to determine audience level, topic scope,
     key concepts.
   - Write a 5-8 sentence brief per SKILL.md Phase 1.
   - Classify topic type: codebase walkthrough, library tutorial, or
     conceptual topic.

   **Phase 3: Educator Panel (7 parallel agents)**
   - Load each agent prompt from `src/agents/*.md`.
   - Spawn 7 agents in parallel (use the Agent tool with
     `subagent_type: "general-purpose"`, `model: "sonnet"` for each).
   - Each agent receives: the brief + relevant content from the ContentBundle.
   - Collect all 7 outputs.

   **Phase 3.5: Content Verification Gate**
   - Run `verify-content.js` with `--workspace {content.workspace_path}`
     against the SME's output.
   - If failure rate > 30%: re-run SME with stricter instructions and
     actual file contents in context.
   - Fix individual failures in the coordinator.

   **Phase 4: Synthesis**
   - Merge all 7 agent outputs into a unified outline per SKILL.md Phase 3.
   - Apply the conflict resolution table from SKILL.md (Curriculum Designer
     wins on structure, SME wins on accuracy, UX Reviewer has veto on
     accessibility).
   - Write lecturer scripts per section (conversational tone, 3-6
     paragraphs, 150-400 words).

   **Phase 5: HeyGen Video Submission (if not --no-video)**
   - Submit all section videos in parallel via `HeyGenClient.submitVideo`.

   **Phase 6: HTML Generation**
   - Call `generateHTML(unifiedOutline, options, config)`.
   - This runs concurrently with video generation.

   **Phase 7: Validation**
   - Run `validate-course.js` on the generated HTML.
   - Fix any FAILURES, re-generate if needed.

   **Phase 8: Video Collection (if not --no-video)**
   - Call `awaitAllVideos(jobs, client, config)`.
   - Download completed videos.
   - Patch HTML with video URLs.

   **Phase 9: Output**
   - Call `writeCourseToDisk(html, slug, videoManifest, config)`.
   - Print summary to the user (section count, quiz count, activity count,
     video status, file size, estimated study time).

3. **Add the course meta bar from DDD-006:**
   - In `src/generator/html.js`: inject the `.course-meta-bar` HTML below
     the topnav (from DDD-006 "Course Metadata Bar" section).
   - Populate with computed values from COURSE_DATA: section count, video
     duration, activity count, quiz count, estimated time.
   - Include the CSS from DDD-006.
   - Adjust the `.course-layout` top offset to `88px` (56px topnav + 32px
     meta bar) when meta bar is present.

4. **Finalize `src/cli.js`:**
   - Parse all options.
   - Call `loadConfig(options)`.
   - Call `generateCourse(source, options)`.
   - Handle errors with user-friendly messages.
   - Print the final course summary.

5. **Create `tests/e2e.test.js`:**
   - End-to-end test using a local fixture directory as source:
     - Use `tests/fixtures/sample-repo/` from Prompt 3.
     - Call `generateCourse('./tests/fixtures/sample-repo', { noVideo: true })`.
     - Verify output file exists at `courses/{slug}.html`.
     - Verify HTML passes `validate-course.js`.
     - Verify COURSE_DATA contains sections, glossary, assessments.
   - A second E2E test with `noVideo: true` and `noQuizzes: true`:
     - Verify no quiz cards in sidebar.
     - Verify no video player in lecturer pane.

6. **Create `CLAUDE.md`:**
   - Document the project for future Claude sessions:
     - Project purpose: course generator with GitHub ingestion + HeyGen video.
     - How to run: `node src/cli.js <source> [options]`.
     - How to test: `npm test`.
     - Key architectural decisions: reference the ADR index.
     - File structure overview.
     - Environment variables: `HEYGEN_API_KEY`, `GITHUB_TOKEN`.

### Verification
- `npm test` -- ALL tests pass (ingestion, scorer, extractor, classifier,
  course-data, validation, generator, activities, tts-sanitizer, heygen,
  video-player, e2e).
- `node src/cli.js ./tests/fixtures/sample-repo --no-video` produces a
  valid HTML course at `courses/sample-repo.html`.
- Opening the generated HTML in a browser shows:
  - 3-pane layout with Agentics brand (warm cream, coral, IBM Plex Mono).
  - Sections with content, vernacular boxes, glossary terms.
  - Working quiz sidebar.
  - Activity cards with correct type badges.
  - Course meta bar with section/activity/quiz counts.
  - Text-only lecturer pane (since --no-video).
  - Glossary panel opens from topnav button.
- `node src/validation/validate-course.js courses/sample-repo.html` exits 0.

---

## Dependency Graph Summary

```
Prompt 1: Scaffold
   │
   ├─> Prompt 2: Classifier
   │      │
   │      └─> Prompt 4: Ingesters (GitHub, URL, Package)
   │
   ├─> Prompt 3: Scorer & Extractor
   │      │
   │      └─> Prompt 4: Ingesters
   │
   ├─> Prompt 5: Schema & Validators
   │      │
   │      ├─> Prompt 6: HTML Generator
   │      │      │
   │      │      ├─> Prompt 7: Activities
   │      │      │
   │      │      └─> Prompt 9: Video Player
   │      │
   │      └─> Prompt 7: Activities
   │
   └─> Prompt 8: TTS & HeyGen Client
          │
          └─> Prompt 9: Video Player

Prompt 10: Orchestrator (depends on ALL above)
```

## ADR/DDD Cross-Reference Matrix

| Prompt | ADRs | DDDs | Key Files Created |
|--------|------|------|-------------------|
| 1 | -- | DDD-004 (config defaults) | config.js, cli.js, orchestrator.js (stubs) |
| 2 | ADR-004 | DDD-003 | ingestion/classifier.js |
| 3 | ADR-007 | DDD-003 | ingestion/scorer.js, ingestion/extractor.js |
| 4 | ADR-004 | DDD-003 | ingestion/github.js, url.js, package.js, index.js |
| 5 | ADR-005, ADR-001 | DDD-004 | generator/course-data.js, validation enhancements |
| 6 | ADR-001 | DDD-006 | generator/template.js, sections.js, html.js, index.js |
| 7 | ADR-008, ADR-002 | DDD-002, DDD-006 | generator/activities.js, agents/activity-designer.md |
| 8 | ADR-003, ADR-006 | DDD-005 | video/tts-sanitizer.js, cache.js, heygen.js, poller.js |
| 9 | ADR-001, ADR-003 | DDD-001, DDD-006 | generator/video-player.js, orchestrator video integration |
| 10 | ADR-002, ADR-005 | DDD-006 | orchestrator.js (full), agents/*.md, cli.js (full), CLAUDE.md |

# SPARC Specification: Course Creator with GitHub Ingestion & HeyGen Talking Heads

---

## Table of Contents

1. [Specification](#1-specification)
2. [Pseudocode](#2-pseudocode)
3. [Architecture](#3-architecture)
4. [Refinement](#4-refinement)
5. [Completion](#5-completion)

---

## 1. Specification

### 1.1 Problem Statement

The existing course skill generates interactive HTML courses from topics a user
describes in chat. It has two critical limitations:

1. **No automated source ingestion.** The user must manually describe what to
   teach. There is no mechanism to point at a GitHub repository, documentation
   URL, or any external resource and have the system autonomously extract,
   analyze, and curricularize that content.

2. **No video instruction.** The "lecturer" pane is a static emoji avatar with
   text paragraphs. Modern e-learning expects a talking-head instructor --
   a human (or AI-generated) presenter who narrates each section, making the
   experience feel like a real class.

This specification defines a system that solves both problems: accept a GitHub
slug (e.g., `anthropics/claude-code`) or other URL, automatically ingest and
analyze the content, generate a comprehensive multi-section course with quizzes
and activities, and produce HeyGen talking-head video for each section's
instructor narration.

### 1.2 Goals

| # | Goal | Success Criteria |
|---|------|-----------------|
| G1 | Accept any GitHub slug (`owner/repo`) or URL as input | System clones the repo / fetches the URL and extracts teachable content without user intervention |
| G2 | Generate a complete, structured course | 5-12 sections with learning objectives, progressive difficulty, and Bloom's taxonomy alignment |
| G3 | Include comprehensive assessments | Each section has 2-3 assessments: multiple-choice, code-completion, concept-matching, and/or hands-on activities |
| G4 | Include hands-on activities | At least 2 interactive activities per course: code exercises, guided explorations, build challenges |
| G5 | Produce HeyGen talking-head videos | Each section has a 1-3 minute AI-generated video of an instructor narrating the lecture script |
| G6 | Output a self-contained deliverable | Single HTML file (or HTML + sidecar video manifest) that works offline (except video streaming) |
| G7 | Maintain content accuracy | Zero hallucinated file paths, function names, or code examples -- verified against the actual source |
| G8 | Brand compliance | Agentics Foundation visual identity preserved (coral accent, IBM Plex Mono, warm cream palette) |

### 1.3 Non-Goals

- Real-time collaborative editing of courses
- LMS integration (SCORM/xAPI export is a future enhancement, not MVP)
- User-uploaded video (HeyGen-only for MVP)
- Multi-language translation (English-only for MVP)
- Paid course hosting or DRM

### 1.4 Input Specification

The system accepts one or more source identifiers:

```
/course <source> [options]
```

**Source types:**

| Type | Format | Example |
|------|--------|---------|
| GitHub slug | `owner/repo` | `anthropics/claude-code` |
| GitHub slug with path | `owner/repo/path/to/dir` | `vercel/next.js/packages/next/src/server` |
| GitHub URL | `https://github.com/owner/repo` | Full URL with optional branch/path |
| Documentation URL | `https://docs.example.com/...` | Any web page or doc site |
| npm package | `npm:package-name` | `npm:zod` |
| PyPI package | `pypi:package-name` | `pypi:fastapi` |
| Local path | `./path/to/dir` | Relative to working directory |

**Options (appended to prompt):**

| Option | Effect |
|--------|--------|
| `--sections N` | Target N sections (default: auto, 5-12 based on complexity) |
| `--no-video` | Skip HeyGen video generation, fall back to text lecturer |
| `--no-quizzes` | Omit assessments entirely |
| `--avatar <id>` | Use a specific HeyGen avatar ID |
| `--voice <id>` | Use a specific HeyGen voice ID |
| `--deep` | Deep dive: 8-12 sections, advanced assessments |
| `--quick` | Quick overview: 3-5 sections, lighter content |
| `--audience <level>` | `beginner`, `intermediate`, `advanced` (default: auto-detect) |

### 1.5 Output Specification

```
courses/
  {topic-slug}/
    index.html          <- Main course file (self-contained HTML)
    videos/
      s1-intro.mp4      <- HeyGen video for section 1
      s2-basics.mp4     <- HeyGen video for section 2
      ...
    manifest.json       <- Course metadata + video manifest
```

If `--no-video` is used, the output collapses to a single
`courses/{topic-slug}.html` file (backward-compatible with existing skill).

### 1.6 HeyGen Integration Requirements

| Requirement | Detail |
|-------------|--------|
| API | HeyGen API v2 (`https://api.heygen.com/v2/video/generate`) |
| Authentication | API key via environment variable `HEYGEN_API_KEY` |
| Avatar | Configurable; default to a professional presenter avatar |
| Voice | Configurable; default to a natural English voice |
| Script source | Lecturer scripts from Phase 3 synthesis (conversational tone, 150-400 words per section) |
| Video length | Target 1-3 minutes per section |
| Resolution | 1080p landscape (16:9) for desktop embed, 720p as fallback |
| Polling | Video generation is async; poll `GET /v1/video_status.get?video_id={id}` until `completed` |
| Fallback | If HeyGen fails or times out, fall back to text lecturer (never block course delivery) |
| Caching | Cache generated videos by script hash to avoid re-generation on re-runs |

### 1.7 Activity Types (beyond quizzes)

The existing skill only has quizzes (multiple-choice, code-completion,
concept-matching). The new system adds **Activities** -- richer, hands-on
exercises embedded in the course:

| Activity Type | Description | Implementation |
|--------------|-------------|----------------|
| **Code Exercise** | Write/modify code with inline editor and validation | Monaco-style textarea with "Run" button, diff against expected output |
| **Guided Exploration** | Step-by-step walkthrough of a repo structure | Interactive file tree with expandable nodes, highlight target files |
| **Build Challenge** | Multi-step project building on section concepts | Checklist-driven, with scaffolding code and hint system |
| **Architecture Puzzle** | Drag-and-drop components into correct arrangement | SVG-based drag targets with snap-to-grid validation |
| **Debug Challenge** | Find and fix a bug in provided code | Pre-filled editor with intentionally broken code, test runner |

Each section should have at least one quiz AND one activity where
pedagogically appropriate.

---

## 2. Pseudocode

### 2.1 Top-Level Orchestration

```
FUNCTION generate_course(source, options):
    // Phase 1: Ingestion
    content = ingest_source(source)
    
    // Phase 2: Analysis & Brief
    brief = analyze_and_brief(content, options)
    
    // Phase 3: Educator Panel (6 parallel agents)
    panel_outputs = run_educator_panel(brief, content)
    
    // Phase 3.5: Content Verification Gate
    verified_content = verify_content(panel_outputs, content)
    IF verified_content.failure_rate > 0.3:
        panel_outputs.sme = re_run_sme(brief, content, stricter=true)
        verified_content = verify_content(panel_outputs, content)
    
    // Phase 4: Synthesis
    unified_outline = synthesize(panel_outputs, verified_content)
    
    // Phase 5: HeyGen Video Generation (async, parallel)
    IF NOT options.no_video:
        video_jobs = []
        FOR EACH section IN unified_outline.sections:
            job = submit_heygen_video(section.lecturer_script, options)
            video_jobs.append(job)
        // Don't block -- continue to HTML generation while videos render
    
    // Phase 6: HTML Generation
    html = generate_html(unified_outline, options)
    
    // Phase 7: Validation
    run_validate_course(html)
    
    // Phase 8: Video Collection (wait for HeyGen jobs)
    IF NOT options.no_video:
        videos = await_all_videos(video_jobs, timeout=600s)
        write_video_files(videos)
        patch_html_with_video_urls(html, videos)
    
    // Phase 9: Final Verification
    write_output(html, videos, manifest)
    
    RETURN course_summary
```

### 2.2 Source Ingestion Pipeline

```
FUNCTION ingest_source(source):
    source_type = classify_source(source)
    
    MATCH source_type:
        CASE "github_slug":
            repo = parse_slug(source)  // {owner, repo, path?, branch?}
            workspace = clone_or_fetch(repo)
            content = extract_repo_content(workspace)
        
        CASE "github_url":
            repo = parse_github_url(source)
            workspace = clone_or_fetch(repo)
            content = extract_repo_content(workspace)
        
        CASE "documentation_url":
            pages = crawl_documentation(source, max_pages=20)
            content = extract_doc_content(pages)
        
        CASE "npm_package":
            pkg_name = source.replace("npm:", "")
            metadata = fetch_npm_registry(pkg_name)
            repo = resolve_github_from_npm(metadata)
            workspace = clone_or_fetch(repo)
            content = extract_repo_content(workspace)
        
        CASE "pypi_package":
            pkg_name = source.replace("pypi:", "")
            metadata = fetch_pypi_api(pkg_name)
            repo = resolve_github_from_pypi(metadata)
            workspace = clone_or_fetch(repo)
            content = extract_repo_content(workspace)
        
        CASE "local_path":
            content = extract_repo_content(source)
    
    RETURN content


FUNCTION extract_repo_content(workspace):
    content = {
        readme: read_if_exists(workspace, "README.md"),
        package_json: read_if_exists(workspace, "package.json"),
        pyproject: read_if_exists(workspace, "pyproject.toml"),
        cargo_toml: read_if_exists(workspace, "Cargo.toml"),
        claude_md: read_if_exists(workspace, "CLAUDE.md"),
        
        // Structural analysis
        file_tree: build_file_tree(workspace, max_depth=4),
        languages: detect_languages(workspace),
        entry_points: find_entry_points(workspace),
        
        // Key source files (prioritized)
        key_files: [],
        type_definitions: [],
        test_files: [],
        examples: [],
        docs: []
    }
    
    // Prioritize files by importance
    all_files = glob(workspace, "**/*.{js,ts,py,rs,go,java,md}")
    scored_files = score_file_importance(all_files)
    
    // Read top files up to context budget (~100K tokens)
    token_budget = 100_000
    FOR file IN scored_files (sorted by score, descending):
        file_content = read(file)
        file_tokens = count_tokens(file_content)
        IF token_budget - file_tokens < 0:
            BREAK
        content.key_files.append({
            path: relative_path(file, workspace),
            content: file_content,
            language: detect_language(file),
            importance_score: file.score
        })
        token_budget -= file_tokens
    
    // Extract type definitions separately (high value, low token cost)
    type_files = glob(workspace, "**/*.d.ts", "**/types.{ts,py}", "**/interfaces.{ts,java}")
    FOR file IN type_files:
        content.type_definitions.append(read(file))
    
    // Find example/sample files
    example_dirs = glob(workspace, "**/examples/**", "**/samples/**", "**/demo/**")
    content.examples = read_first_n(example_dirs, 5)
    
    RETURN content


FUNCTION score_file_importance(files):
    FOR EACH file IN files:
        score = 0
        
        // Entry points are highest value
        IF is_entry_point(file): score += 100
        
        // README, docs
        IF file.name IN ["README.md", "CONTRIBUTING.md"]: score += 90
        
        // Config files (package.json, etc.)
        IF is_config(file): score += 80
        
        // Source in lib/src directories
        IF "lib/" IN file.path OR "src/" IN file.path: score += 60
        
        // Type definitions
        IF file.extension IN [".d.ts", ".pyi"]: score += 50
        
        // Tests (useful for understanding behavior)
        IF is_test(file): score += 30
        
        // Penalize generated/vendor/build output
        IF "dist/" IN file.path OR "build/" IN file.path: score -= 100
        IF "node_modules/" IN file.path: score -= 200
        IF "vendor/" IN file.path: score -= 200
        
        // Penalize very large files
        IF file.size > 50_000: score -= 20
        
        file.score = score
    
    RETURN files
```

### 2.3 Educator Panel Agents

```
FUNCTION run_educator_panel(brief, content):
    // Spawn all 6 agents in parallel
    agents = parallel_spawn([
        Agent("curriculum-designer", brief, content),
        Agent("subject-matter-expert", brief, content),
        Agent("visualization-specialist", brief, content),
        Agent("assessment-engineer", brief, content),
        Agent("research-librarian", brief, content),
        Agent("ux-accessibility-reviewer", brief, content),
        Agent("activity-designer", brief, content),  // NEW: 7th agent
    ])
    
    results = await_all(agents)
    
    RETURN {
        curriculum: results[0],
        sme_content: results[1],
        visualizations: results[2],
        assessments: results[3],
        citations: results[4],
        ux_review: results[5],
        activities: results[6]
    }


// NEW: Activity Designer Agent
AGENT activity_designer(brief, content):
    """
    Design hands-on activities for each section.
    
    For each section, produce 1-2 activities:
    
    1. Analyze the section's learning objectives and Bloom's level
    2. Choose the appropriate activity type:
       - Remember/Understand -> Guided Exploration or Architecture Puzzle
       - Apply -> Code Exercise
       - Analyze -> Debug Challenge
       - Evaluate/Create -> Build Challenge
    3. For each activity, specify:
       - Type (from the activity types enum)
       - Title and description
       - Starter code / scaffold (if applicable)
       - Expected outcome / validation criteria
       - Hints (progressive, 2-3 per activity)
       - Estimated completion time (2-10 minutes)
       - Connection to section content
    """
    
    FOR EACH section IN brief.sections:
        activity = design_activity(section, content)
        YIELD activity
```

### 2.4 HeyGen Video Pipeline

```
FUNCTION submit_heygen_video(lecturer_script, options):
    // Prepare the script for TTS
    clean_script = sanitize_for_tts(lecturer_script)
    
    // Check cache
    script_hash = sha256(clean_script + options.avatar + options.voice)
    cached = lookup_cache(script_hash)
    IF cached:
        RETURN cached
    
    // Submit to HeyGen API
    payload = {
        video_inputs: [{
            character: {
                type: "avatar",
                avatar_id: options.avatar OR DEFAULT_AVATAR_ID,
                avatar_style: "normal"
            },
            voice: {
                type: "text",
                input_text: clean_script,
                voice_id: options.voice OR DEFAULT_VOICE_ID,
                speed: 1.0
            },
            background: {
                type: "color",
                value: "#FAF9F6"  // Agentics warm cream
            }
        }],
        dimension: {
            width: 1920,
            height: 1080
        },
        aspect_ratio: "16:9"
    }
    
    response = POST("https://api.heygen.com/v2/video/generate", payload, 
                     headers={"X-Api-Key": HEYGEN_API_KEY})
    
    IF response.error:
        log_warning("HeyGen submission failed: " + response.error)
        RETURN {status: "failed", fallback: "text"}
    
    RETURN {
        video_id: response.data.video_id,
        status: "processing",
        script_hash: script_hash,
        section_id: lecturer_script.section_id
    }


FUNCTION await_all_videos(jobs, timeout):
    deadline = now() + timeout
    completed = []
    
    WHILE any_pending(jobs) AND now() < deadline:
        FOR EACH job IN jobs WHERE job.status == "processing":
            status = GET("https://api.heygen.com/v1/video_status.get",
                         params={video_id: job.video_id})
            
            IF status.data.status == "completed":
                job.status = "completed"
                job.video_url = status.data.video_url
                job.thumbnail_url = status.data.thumbnail_url
                job.duration = status.data.duration
                
                // Download video to local
                video_bytes = download(job.video_url)
                job.local_path = write_file(
                    "courses/{slug}/videos/{section_id}.mp4",
                    video_bytes
                )
                cache_store(job.script_hash, job)
                completed.append(job)
            
            ELSE IF status.data.status == "failed":
                job.status = "failed"
                log_warning("Video failed for " + job.section_id)
                completed.append(job)
        
        IF any_pending(jobs):
            sleep(15s)  // HeyGen typically takes 2-5 minutes
    
    // Handle timeouts
    FOR EACH job IN jobs WHERE job.status == "processing":
        job.status = "timeout"
        log_warning("Video timed out for " + job.section_id)
    
    RETURN jobs


FUNCTION sanitize_for_tts(script):
    // Remove HTML tags
    text = strip_html(script)
    
    // Expand acronyms for natural speech
    text = expand_acronyms(text, {
        "API": "A P I",
        "HTML": "H T M L",
        "CSS": "C S S",
        "JS": "JavaScript",
        "SQL": "S Q L",
        "URL": "U R L",
        "CLI": "command line interface",
        "SDK": "S D K",
        "GNN": "graph neural network",
    })
    
    // Add SSML pauses at paragraph breaks
    text = add_pauses(text)
    
    // Ensure script is within HeyGen limits
    IF word_count(text) > 1500:
        text = split_into_segments(text)
    
    RETURN text
```

### 2.5 HTML Generation with Video Player

```
FUNCTION generate_html(unified_outline, options):
    // Start from the agentics-shell.html template
    html = read_template("agentics-shell.html")
    
    IF NOT options.no_video:
        // Replace the text lecturer pane with a video player pane
        html = inject_video_player_pane(html)
    
    // Fill placeholders
    html = replace(html, "{{COURSE_TITLE}}", unified_outline.title)
    html = replace(html, "{{INSTRUCTOR_NAME}}", unified_outline.instructor.name)
    html = replace(html, "{{AVATAR_EMOJI}}", unified_outline.instructor.emoji)
    
    // Generate section HTML
    sections_html = ""
    FOR EACH section IN unified_outline.sections:
        sections_html += generate_section_html(section)
    
    html = inject(html, "#content", sections_html)
    
    // Generate nav items
    nav_html = ""
    FOR EACH section IN unified_outline.sections:
        nav_html += '<li data-section="' + section.id + '">'
                  + section.index + '. ' + section.title + '</li>'
    html = inject(html, "#lecturer-nav", nav_html)
    
    // Generate COURSE_DATA JSON
    course_data = build_course_data(unified_outline)
    html = replace(html, "{{COURSE_DATA_JSON}}", JSON.stringify(course_data))
    
    // Generate per-section visualization scripts
    viz_scripts = ""
    FOR EACH section IN unified_outline.sections:
        IF section.visualization:
            viz_scripts += generate_viz_script(section)
    html = inject_before_closing_script(html, viz_scripts)
    
    // Generate activity components
    IF unified_outline.activities:
        activity_html = generate_activity_components(unified_outline.activities)
        activity_js = generate_activity_engine_js()
        html = inject(html, activity_html, activity_js)
    
    RETURN html


FUNCTION inject_video_player_pane(html):
    // Replace the static lecturer-dialogue div with a video player
    video_player_html = """
    <div class="lecturer-video" id="lecturer-video">
        <video id="instructor-video" 
               playsinline
               preload="metadata"
               poster=""
               class="instructor-video-player">
            <source src="" type="video/mp4">
        </video>
        <div class="video-controls">
            <button class="video-play-btn" id="video-play-btn">Play</button>
            <div class="video-progress-bar">
                <div class="video-progress-fill" id="video-progress-fill"></div>
            </div>
            <span class="video-time" id="video-time">0:00</span>
        </div>
    </div>
    <div class="lecturer-dialogue" id="lecturer-dialogue">
        <!-- Transcript fallback shown below video -->
    </div>
    """
    
    html = replace_section(html, ".lecturer-dialogue", video_player_html)
    html = inject_video_css(html)
    html = inject_video_js(html)
    
    RETURN html
```

### 2.6 Activity Engine

```
FUNCTION generate_activity_components(activities):
    html = ""
    
    FOR EACH activity IN activities:
        MATCH activity.type:
            CASE "code-exercise":
                html += """
                <div class="activity-card" data-section="{activity.section_id}">
                    <div class="activity-header">
                        <span class="activity-type-badge">Code Exercise</span>
                        <h4>{activity.title}</h4>
                    </div>
                    <p class="activity-description">{activity.description}</p>
                    <div class="code-editor-container">
                        <textarea class="activity-editor" 
                                  id="editor-{activity.id}"
                                  rows="10">{activity.starter_code}</textarea>
                        <div class="activity-actions">
                            <button onclick="checkSolution('{activity.id}')">
                                Check Solution
                            </button>
                            <button onclick="showHint('{activity.id}')">
                                Hint
                            </button>
                        </div>
                        <div class="activity-feedback" id="feedback-{activity.id}"></div>
                    </div>
                </div>
                """
            
            CASE "guided-exploration":
                html += """
                <div class="activity-card" data-section="{activity.section_id}">
                    <div class="activity-header">
                        <span class="activity-type-badge">Guided Exploration</span>
                        <h4>{activity.title}</h4>
                    </div>
                    <div class="file-explorer" id="explorer-{activity.id}">
                        {render_interactive_file_tree(activity.file_tree)}
                    </div>
                    <div class="exploration-steps">
                        {render_step_checklist(activity.steps)}
                    </div>
                </div>
                """
            
            CASE "build-challenge":
                html += """
                <div class="activity-card" data-section="{activity.section_id}">
                    <div class="activity-header">
                        <span class="activity-type-badge">Build Challenge</span>
                        <h4>{activity.title}</h4>
                    </div>
                    <p>{activity.description}</p>
                    <div class="challenge-steps">
                        {render_challenge_checklist(activity.steps)}
                    </div>
                    <div class="code-editor-container">
                        <textarea class="activity-editor"
                                  id="editor-{activity.id}"
                                  rows="15">{activity.scaffold_code}</textarea>
                    </div>
                </div>
                """
            
            CASE "debug-challenge":
                html += """
                <div class="activity-card" data-section="{activity.section_id}">
                    <div class="activity-header">
                        <span class="activity-type-badge">Debug Challenge</span>
                        <h4>{activity.title}</h4>
                    </div>
                    <p class="activity-description">{activity.description}</p>
                    <div class="code-editor-container">
                        <textarea class="activity-editor"
                                  id="editor-{activity.id}"
                                  rows="12">{activity.buggy_code}</textarea>
                        <div class="activity-actions">
                            <button onclick="runTests('{activity.id}')">
                                Run Tests
                            </button>
                            <button onclick="showHint('{activity.id}')">
                                Hint
                            </button>
                        </div>
                        <div class="test-results" id="tests-{activity.id}"></div>
                    </div>
                </div>
                """
    
    RETURN html
```

---

## 3. Architecture

### 3.1 System Overview

```
                                    USER INPUT
                                        |
                                        v
                    +-------------------------------------------+
                    |          INPUT CLASSIFIER                  |
                    |  (GitHub slug, URL, npm, pypi, local)     |
                    +-------------------------------------------+
                                        |
                                        v
                    +-------------------------------------------+
                    |         INGESTION PIPELINE                |
                    |                                           |
                    |  github-slug --> git clone (sparse)       |
                    |  url         --> web fetch/crawl          |
                    |  npm/pypi    --> registry -> github       |
                    |  local       --> direct read              |
                    |                                           |
                    |  Output: ContentBundle {                  |
                    |    readme, package_json, file_tree,       |
                    |    key_files[], type_defs[], examples[]   |
                    |  }                                        |
                    +-------------------------------------------+
                                        |
                                        v
                    +-------------------------------------------+
                    |         BRIEF ASSEMBLY                    |
                    |  Analyze content, determine audience,     |
                    |  write 5-8 sentence educational brief     |
                    +-------------------------------------------+
                                        |
                        +---------------+----------------+
                        |               |                |
                        v               v                v
              +-----------+   +-----------+    +-----------+
              | Curriculum|   |    SME    |    |Visualiz.  |   ... (x7 agents)
              | Designer  |   |  Expert   |    |Specialist |
              +-----------+   +-----------+    +-----------+
                        |               |                |
                        +---------------+----------------+
                                        |
                                        v
                    +-------------------------------------------+
                    |       CONTENT VERIFICATION GATE           |
                    |  verify-content.js                        |
                    |  Check all paths, functions, code exist   |
                    +-------------------------------------------+
                                        |
                                        v
                    +-------------------------------------------+
                    |           SYNTHESIS                       |
                    |  Merge all agent outputs                  |
                    |  Resolve conflicts per priority table     |
                    |  Write lecturer scripts                   |
                    +-------------------------------------------+
                            |                       |
                            v                       v
              +-------------------+    +------------------------+
              |  HEYGEN PIPELINE  |    |   HTML GENERATION      |
              |                   |    |                        |
              | For each section: |    | - Load shell template  |
              |  1. Sanitize TTS  |    | - Inject sections      |
              |  2. POST /v2/     |    | - Build COURSE_DATA    |
              |     video/generate|    | - Inject activities    |
              |  3. Poll status   |    | - Inject viz scripts   |
              |  4. Download .mp4 |    | - Inject video player  |
              +-------------------+    +------------------------+
                            |                       |
                            v                       v
                    +-------------------------------------------+
                    |         ASSEMBLY & VALIDATION             |
                    |                                           |
                    |  1. Patch HTML with video URLs            |
                    |  2. Run validate-course.js                |
                    |  3. Write output files                    |
                    |  4. Generate manifest.json                |
                    +-------------------------------------------+
                                        |
                                        v
                    +-------------------------------------------+
                    |              OUTPUT                       |
                    |                                           |
                    |  courses/{slug}/                          |
                    |    index.html                             |
                    |    videos/s1.mp4, s2.mp4, ...             |
                    |    manifest.json                          |
                    +-------------------------------------------+
```

### 3.2 Component Breakdown

#### 3.2.1 Input Classifier (`src/ingestion/classifier.js`)

Responsibility: Parse the user's source string and determine the ingestion
strategy.

```
Input:  "anthropics/claude-code"
Output: { type: "github_slug", owner: "anthropics", repo: "claude-code",
          path: null, branch: null }

Input:  "https://github.com/vercel/next.js/tree/canary/packages/next"
Output: { type: "github_url", owner: "vercel", repo: "next.js",
          path: "packages/next", branch: "canary" }

Input:  "npm:zod"
Output: { type: "npm_package", package: "zod" }

Input:  "https://docs.python.org/3/library/asyncio.html"
Output: { type: "documentation_url", url: "...", domain: "docs.python.org" }
```

Patterns:
- `/^[\w.-]+\/[\w.-]+/` -> GitHub slug
- `/^https:\/\/github\.com\//` -> GitHub URL
- `/^npm:/` -> npm package
- `/^pypi:/` -> PyPI package
- `/^https?:\/\//` -> Documentation URL
- `/^\.?\//` -> Local path

#### 3.2.2 Ingestion Pipeline (`src/ingestion/`)

**GitHub Ingester** (`src/ingestion/github.js`):
- Uses `gh repo clone` for authenticated access or `git clone --depth 1` for public repos
- Supports sparse checkout when a subdirectory path is specified
- Respects `.gitignore` and skips binary files, `node_modules`, `dist/`, `.git/`
- Produces a `ContentBundle` object

**URL Ingester** (`src/ingestion/url.js`):
- Fetches the page via WebFetch
- If the page links to subpages within the same domain, follows up to 20 links
- Extracts text content, code blocks, headings, and structure
- Produces a `ContentBundle` with extracted documentation

**Package Ingester** (`src/ingestion/package.js`):
- Queries the npm registry or PyPI API for package metadata
- Resolves the GitHub repository URL from the metadata
- Delegates to the GitHub ingester
- Enriches the ContentBundle with package metadata (version, description, dependencies)

**File Scorer** (`src/ingestion/scorer.js`):
- Assigns importance scores to every file in the repository
- Ensures the most valuable files are read within the token budget
- Scoring heuristics: entry points > README > src/lib > types > tests > config
- Penalizes: generated output, vendor, node_modules, binaries

#### 3.2.3 Educator Panel (7 Agents)

The existing 6 agents are retained, with enhancements:

| # | Agent | Changes from Existing |
|---|-------|-----------------------|
| 1 | Curriculum Designer | No changes -- drives section structure |
| 2 | Subject Matter Expert | Enhanced to work from ingested ContentBundle instead of requiring manual context. Automatically maps file paths to the cloned workspace |
| 3 | Visualization Specialist | No changes |
| 4 | Assessment Engineer | Enhanced to produce activities in addition to quizzes |
| 5 | Research Librarian | Enhanced to validate URLs via WebFetch |
| 6 | UX/Accessibility Reviewer | Enhanced to review video player accessibility (captions, keyboard controls) |
| 7 | **Activity Designer** (NEW) | Designs hands-on activities per section: code exercises, guided explorations, build challenges, debug challenges |

#### 3.2.4 HeyGen Video Service (`src/video/heygen.js`)

Responsibilities:
1. Accept a lecturer script (text) and configuration (avatar, voice)
2. Submit video generation request to HeyGen API v2
3. Poll for completion
4. Download completed video to local filesystem
5. Generate thumbnail
6. Maintain a script-hash cache to avoid duplicate generations

Key design decisions:
- **Async pipeline**: Video generation is the slowest step (2-5 min per video).
  All section videos are submitted in parallel immediately after synthesis.
  HTML generation proceeds concurrently -- videos are patched into the HTML
  after both complete.
- **Graceful degradation**: If any video fails, the course still works.
  The lecturer pane falls back to text for that section. A warning is shown.
- **Caching**: Video generation is expensive ($). A SHA-256 hash of the
  script text + avatar ID + voice ID is used as a cache key. If the same
  script was already generated, the cached video is reused.

#### 3.2.5 HTML Generator (`src/generator/html.js`)

Extends the existing shell template with:

1. **Video player pane**: Replaces the static text lecturer with an HTML5
   `<video>` element. The player updates its `src` when a section scrolls
   into view (same IntersectionObserver pattern as the existing text swap).

2. **Activity components**: New HTML/CSS/JS for interactive activities
   (code editor, file explorer, drag-and-drop). Activities are placed
   inline within sections, after the content and before the vernacular box.

3. **Video manifest in COURSE_DATA**: The existing data model is extended:
   ```javascript
   sections: [{
     id: "s1",
     title: "...",
     lectureScript: "<p>...</p>",       // Text fallback
     videoUrl: "videos/s1.mp4",          // NEW: HeyGen video
     videoPoster: "videos/s1-thumb.jpg", // NEW: thumbnail
     videoDuration: 142,                 // NEW: seconds
     activities: [{ ... }],              // NEW: hands-on activities
     assessments: [{ ... }]
   }]
   ```

4. **Transcript sync**: The lecturer script text is displayed below the
   video as a scrollable transcript, synchronized with video playback
   via timestamp markers.

#### 3.2.6 Validation Pipeline (`src/validation/`)

Two gates, matching the existing skill:

1. **Pre-generation** (`verify-content.js` -- enhanced):
   - All existing checks (file paths, function names, code snippets)
   - NEW: Validates that ContentBundle file paths map correctly to cloned workspace
   - NEW: Checks that activity starter code compiles/parses

2. **Post-generation** (`validate-course.js` -- enhanced):
   - All existing checks (COURSE_DATA integrity, sections, vernacular, glossary, brand)
   - NEW: Validates video manifest entries have corresponding files
   - NEW: Validates activity components are present in sections
   - NEW: Checks video player HTML/CSS/JS is correctly injected
   - NEW: Validates transcript timestamps match video durations

### 3.3 Data Flow

```
ContentBundle {
  source_type: string
  source_ref: string                  // original input
  workspace_path: string              // cloned/fetched location
  readme: string
  package_json: object
  file_tree: TreeNode[]
  languages: {lang: string, pct: number}[]
  key_files: {path, content, language, score}[]
  type_definitions: string[]
  examples: {path, content}[]
  docs: string[]
  metadata: {                         // from package registry if applicable
    name, version, description,
    dependencies, devDependencies
  }
}

Brief {
  topic: string
  slug: string
  audience: "beginner" | "intermediate" | "advanced"
  source_type: string
  summary: string                     // 5-8 sentences
  key_concepts: string[]
  constraints: string[]               // from user options
  content_ref: ContentBundle
}

UnifiedOutline {
  title: string
  slug: string
  instructor: {name, emoji, role}
  sections: [{
    id: string                        // "s1", "s2", ...
    title: string
    bloom_level: string
    learning_objectives: string[]
    content_html: string              // main content
    lecturer_script: string           // for HeyGen TTS
    visualizations: [{type, spec, priority}]
    assessments: [{type, question, options, correct, explanation}]
    activities: [{type, title, description, starter_code, ...}]
    terms: [{term, definition, category}]
    citations: [{id, title, url}]
    ux_notes: string[]
  }]
  glossary: [{term, definition, category, firstIntroduced, related}]
  citations: [{id, title, url, accessed, relevance, sections}]
}

VideoManifest {
  sections: [{
    section_id: string
    video_id: string                  // HeyGen ID
    status: "completed" | "failed" | "timeout"
    local_path: string                // relative to course dir
    duration: number                  // seconds
    thumbnail_path: string
    script_hash: string
  }]
  avatar_id: string
  voice_id: string
  generated_at: string               // ISO date
}

CourseManifest {                      // manifest.json in output dir
  title: string
  slug: string
  generated: string
  source: string
  section_count: number
  total_questions: number
  total_activities: number
  total_video_duration: number        // seconds
  file_size_kb: number
  sections: [{id, title, has_video, has_quiz, has_activity}]
  heygen: VideoManifest
}
```

### 3.4 File Structure

```
course-creator/
  src/
    ingestion/
      classifier.js         <- Parse source type from user input
      github.js              <- Clone repos, sparse checkout
      url.js                 <- Fetch & crawl documentation URLs
      package.js             <- npm/PyPI registry -> GitHub resolution
      scorer.js              <- File importance scoring
      extractor.js           <- ContentBundle assembly
    agents/
      curriculum-designer.md <- Agent prompt for curriculum design
      sme.md                 <- Agent prompt for SME content
      visualization.md       <- Agent prompt for viz specs
      assessment.md          <- Agent prompt for quizzes
      activity-designer.md   <- Agent prompt for activities (NEW)
      research-librarian.md  <- Agent prompt for citations
      ux-reviewer.md         <- Agent prompt for accessibility
    video/
      heygen.js              <- HeyGen API client
      tts-sanitizer.js       <- Script -> TTS text conversion
      cache.js               <- Video caching by script hash
      poller.js              <- Async job polling
    generator/
      html.js                <- Main HTML generation
      template.js            <- Shell template loading & placeholder filling
      sections.js            <- Per-section HTML generation
      activities.js          <- Activity component HTML/CSS/JS
      video-player.js        <- Video player pane injection
      course-data.js         <- COURSE_DATA JSON builder
    validation/
      verify-content.js      <- Pre-generation content verification (enhanced)
      validate-course.js     <- Post-generation structural validation (enhanced)
    orchestrator.js          <- Top-level pipeline coordinator
    config.js               <- Default configuration, env vars
  resources/
    templates/
      agentics-shell.html    <- Base HTML template (from existing skill)
    brand/
      agentics-favicon.svg
      agentics-og.png
  courses/                   <- Generated output directory
  tests/
    ingestion.test.js
    heygen.test.js
    generator.test.js
    validation.test.js
    e2e.test.js
  package.json
  SPARC.md                   <- This file
  CLAUDE.md                  <- Project instructions for Claude
```

### 3.5 External Dependencies

| Dependency | Purpose | Required |
|-----------|---------|----------|
| `gh` CLI | GitHub repository cloning and API access | Yes (for GitHub sources) |
| `git` | Repository cloning | Yes (for GitHub sources) |
| HeyGen API | Talking-head video generation | Yes (unless `--no-video`) |
| Node.js 18+ | Runtime for all scripts | Yes |
| `HEYGEN_API_KEY` | Environment variable for HeyGen auth | Yes (unless `--no-video`) |
| `GITHUB_TOKEN` | Environment variable for private repo access | Optional |

### 3.6 Video Player Design

The video player replaces the text-only lecturer dialogue in the left pane.

**Layout (within the existing 3-pane grid):**

```
+------------------+----------------------------------+--------------+
|   LECTURER (L)   |         CONTENT (C)              |  QUIZ (R)    |
|                  |                                  |              |
| [Video Player]   |  Section content scrolls here    | Quiz cards   |
| 16:9 ratio       |  with visualizations, code,      | update per   |
| within 240px     |  activities, vernacular boxes     | section      |
| wide pane        |                                  |              |
|                  |                                  |              |
| [Nav list]       |                                  |              |
| [Transcript]     |                                  |              |
+------------------+----------------------------------+--------------+
```

**Behavior:**
- When a section scrolls into view (IntersectionObserver), the video player
  loads that section's video and optionally auto-plays
- The transcript text (lecturer script) scrolls below the video
- If no video exists for a section (failed/timeout), show the text fallback
- Video controls: play/pause, progress bar, mute, fullscreen
- Keyboard accessible: Space = play/pause, arrow keys = seek

**CSS additions:**

```css
.lecturer-video {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: 16px;
  background: var(--bg-code);
}

.instructor-video-player {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.video-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
}

.video-play-btn {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 4px 12px;
  background: var(--primary);
  color: var(--text-on-primary);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.video-progress-bar {
  flex: 1;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  cursor: pointer;
}

.video-progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  transition: width 0.1s;
}

.video-time {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-dim);
}
```

---

## 4. Refinement

### 4.1 Edge Cases & Error Handling

| Scenario | Handling |
|----------|----------|
| Private GitHub repo without `GITHUB_TOKEN` | Error with clear message: "Set GITHUB_TOKEN for private repo access" |
| Empty or trivial repo (< 3 source files) | Generate a shorter "quick" course (3-5 sections) with a warning |
| Very large repo (> 10K files) | Use sparse checkout, limit to specified path or auto-detect most important directory |
| HeyGen API key missing | Warn and fall back to text-only lecturer (`--no-video` implicit) |
| HeyGen rate limit hit | Queue remaining videos, retry with exponential backoff (max 3 retries) |
| HeyGen video generation fails | Fall back to text for that section, continue course generation |
| All HeyGen videos fail | Complete course with text-only lecturer, warn user |
| Source URL returns 404 | Error with clear message, suggest alternatives |
| Non-English source content | Process as-is (course in English, code in original language), warn about potential quality issues |
| Repository has no README | Generate brief from code analysis alone, warn about reduced context |
| Token budget exceeded during ingestion | Truncate least-important files, log which files were skipped |
| User cancels during video generation | Save HTML immediately, mark videos as pending, provide resume command |
| Network interruption during clone | Retry once, then error with suggestion to use local path |

### 4.2 Performance Considerations

**Parallelism strategy:**

```
Timeline:

0s     Phase 1: Ingestion (sequential, 10-30s)
       |
30s    Phase 2: Brief Assembly (sequential, 5-10s)
       |
40s    Phase 3: Educator Panel
       |-----> Agent 1: Curriculum Designer -------|
       |-----> Agent 2: SME ----------------------|
       |-----> Agent 3: Visualization Specialist --|
       |-----> Agent 4: Assessment Engineer -------|  (all parallel)
       |-----> Agent 5: Research Librarian --------|
       |-----> Agent 6: UX Reviewer ---------------|
       |-----> Agent 7: Activity Designer ---------|
       |
120s   Phase 3.5: Content Verification (sequential, 10-20s)
       |
140s   Phase 4: Synthesis (sequential, 30-60s)
       |
200s   Phase 5+6: HTML Gen + HeyGen Submit (parallel)
       |-----> Generate HTML --------------------|
       |-----> Submit all HeyGen jobs ------------|
       |                                          |
260s   Phase 7: Validation (sequential, 5-10s)
       |
270s   Phase 8: Video Collection (wait for HeyGen)
       |-----> Poll every 15s until all complete -|
       |                                          |
570s   Phase 9: Assembly (sequential, 5-10s)
       |
580s   Done (total: ~10 min with video, ~5 min without)
```

**Token budget management:**
- Ingestion: Cap at 100K tokens of source content
- Each agent: Gets the brief (~500 tokens) + relevant content slice (~20K tokens)
- Synthesis: All agent outputs (~50K tokens total)
- HTML generation: Template + synthesized outline

### 4.3 HeyGen Cost Management

| Item | Cost (approximate) |
|------|-------------------|
| 1 minute of video | ~$0.50-1.00 |
| Typical section (2 min) | ~$1.00-2.00 |
| 8-section course | ~$8.00-16.00 |

**Cost mitigation strategies:**
1. **Caching**: Never regenerate the same script. SHA-256 hash as key.
2. **Script length control**: Target 150-300 words per section (1-2 min video).
   The synthesis phase should enforce this limit.
3. **`--no-video` default for iterations**: During development/preview, default
   to text-only. Only generate video on explicit `--with-video` or final pass.
4. **Dry run mode**: `--dry-run` shows the plan and estimated cost without
   executing.

### 4.4 Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Cloning malicious repos | Clone into a sandboxed temp directory; never execute cloned code |
| API key exposure | `HEYGEN_API_KEY` via env var only; never logged or embedded in HTML |
| XSS in course content | All user-derived content (repo descriptions, file names) is HTML-escaped before injection |
| SSRF via URL ingestion | URL ingester validates domain against allowlist for non-GitHub URLs; no internal network access |
| Large file DoS | File size limits (100MB per file, 1GB per repo); token budget caps |

### 4.5 Accessibility Enhancements for Video

| Feature | Implementation |
|---------|---------------|
| Transcript | Full text transcript displayed below video, scrollable |
| Keyboard controls | Space = play/pause, Left/Right = seek 10s, M = mute |
| Reduced motion | `prefers-reduced-motion` disables autoplay |
| Screen reader | `aria-label` on video, `aria-live` for transcript region |
| Fallback | Text-only lecturer always available as fallback |

### 4.6 Configuration Defaults

```javascript
const DEFAULTS = {
  // HeyGen
  heygen: {
    avatar_id: "Daisy-inskirt-20220818",  // Professional female presenter
    voice_id: "en-US-JennyNeural",         // Natural English voice
    background_color: "#FAF9F6",           // Agentics warm cream
    resolution: { width: 1920, height: 1080 },
    max_script_words: 400,
    poll_interval_ms: 15000,
    timeout_ms: 600000,                    // 10 min per video
    max_retries: 3
  },
  
  // Ingestion
  ingestion: {
    token_budget: 100000,
    max_files: 500,
    max_file_size_bytes: 100 * 1024,       // 100KB per file
    max_repo_size_mb: 500,
    clone_depth: 1,
    max_crawl_pages: 20
  },
  
  // Course
  course: {
    min_sections: 3,
    max_sections: 12,
    default_sections: "auto",              // auto-detect from content
    assessments_per_section: 2,
    activities_per_section: 1,
    min_font_size_rem: 0.8,
    target_file_size_kb: 300               // HTML only, excluding videos
  },
  
  // Output
  output: {
    dir: "courses",
    video_dir: "videos",
    manifest_file: "manifest.json"
  }
};
```

---

## 5. Completion

### 5.1 Implementation Phases

#### Phase A: Foundation (Week 1)

| Task | Description | Deliverable |
|------|-------------|-------------|
| A1 | Set up project structure, `package.json`, config system | Scaffolded project |
| A2 | Implement Input Classifier | `src/ingestion/classifier.js` with tests |
| A3 | Implement GitHub Ingester (clone, sparse checkout, file reading) | `src/ingestion/github.js` with tests |
| A4 | Implement File Scorer | `src/ingestion/scorer.js` with tests |
| A5 | Implement ContentBundle assembly (extractor) | `src/ingestion/extractor.js` with tests |
| A6 | Port existing SKILL.md agent prompts to standalone files | `src/agents/*.md` |
| A7 | Implement the Orchestrator skeleton (phases 1-4 without HeyGen) | `src/orchestrator.js` |

**Exit criteria**: Can run `/course anthropics/claude-code` and get a text-only
HTML course generated from the cloned repo. No video, no activities yet.

#### Phase B: Activities & Enhanced Agents (Week 2)

| Task | Description | Deliverable |
|------|-------------|-------------|
| B1 | Write Activity Designer agent prompt | `src/agents/activity-designer.md` |
| B2 | Implement activity component HTML/CSS/JS generator | `src/generator/activities.js` |
| B3 | Add activity data model to COURSE_DATA | Updated schema |
| B4 | Implement URL ingester (web fetch, crawl, extract) | `src/ingestion/url.js` |
| B5 | Implement package ingester (npm/PyPI -> GitHub) | `src/ingestion/package.js` |
| B6 | Enhance validate-course.js for activities | Updated validator |
| B7 | End-to-end test: URL source -> course with activities | E2E test |

**Exit criteria**: Can ingest GitHub slugs, URLs, and npm packages. Courses
include hands-on activities. Still no video.

#### Phase C: HeyGen Integration (Week 3)

| Task | Description | Deliverable |
|------|-------------|-------------|
| C1 | Implement HeyGen API client (submit, poll, download) | `src/video/heygen.js` |
| C2 | Implement TTS sanitizer (script -> speakable text) | `src/video/tts-sanitizer.js` |
| C3 | Implement video caching layer | `src/video/cache.js` |
| C4 | Implement video player pane (HTML/CSS/JS) | `src/generator/video-player.js` |
| C5 | Integrate video pipeline into orchestrator | Updated `src/orchestrator.js` |
| C6 | Implement graceful fallback (video failure -> text lecturer) | Error handling in orchestrator |
| C7 | Enhance validate-course.js for video manifest | Updated validator |
| C8 | End-to-end test: full pipeline with HeyGen video | E2E test |

**Exit criteria**: Full pipeline works end-to-end. Course with HeyGen videos
for each section, activities, quizzes, and verified content.

#### Phase D: Polish & Hardening (Week 4)

| Task | Description | Deliverable |
|------|-------------|-------------|
| D1 | Transcript synchronization (scroll transcript with video playback) | Video player enhancement |
| D2 | `--dry-run` mode (show plan + cost estimate without executing) | CLI option |
| D3 | Progress reporting to user during generation | Status updates |
| D4 | Responsive video player (mobile breakpoints) | CSS enhancements |
| D5 | Accessibility audit (keyboard nav, screen reader, captions) | Accessibility fixes |
| D6 | Performance optimization (parallel video submission, token budget tuning) | Profiling + fixes |
| D7 | Error recovery (resume interrupted video generation) | Resume mechanism |
| D8 | Documentation and CLAUDE.md | Project docs |

**Exit criteria**: Production-ready system. All edge cases handled. Accessible.
Documented.

### 5.2 Testing Strategy

| Level | What | How |
|-------|------|-----|
| Unit | Input classifier patterns | Jest tests with all source type formats |
| Unit | File scorer heuristics | Jest tests with mock file lists |
| Unit | TTS sanitizer | Jest tests with various script formats |
| Unit | HTML escaping | Jest tests with XSS payloads |
| Integration | GitHub ingester | Clone a small public repo, verify ContentBundle |
| Integration | HeyGen client | Submit a test video, poll, verify download (requires API key) |
| Integration | HTML generator | Generate from a fixture outline, validate structure |
| E2E | Full pipeline (no video) | `course anthropics/claude-code --no-video`, validate output |
| E2E | Full pipeline (with video) | `course anthropics/claude-code`, validate output + videos |
| Visual | Course rendering | Open generated HTML in browser, verify 3-pane layout |
| Accessibility | WCAG AA compliance | axe-core audit on generated HTML |

### 5.3 Validation Checklist (enhanced from existing)

#### Pre-Generation (verify-content.js)
- [ ] All file paths from SME output exist in the cloned workspace
- [ ] All function/class names exist in the codebase (grep verified)
- [ ] All code examples match actual source (not hallucinated)
- [ ] All URLs from Research Librarian are reachable
- [ ] Activity starter code is syntactically valid
- [ ] No fabricated paper titles, author names, or conference names

#### Post-Generation (validate-course.js)
- [ ] COURSE_DATA JSON is valid and complete
- [ ] Section count matches outline (5-12)
- [ ] Every section has a `.vernacular` box
- [ ] Glossary panel exists and is populated
- [ ] Inline `.term` spans have matching glossary entries
- [ ] Quiz components render and are interactive
- [ ] Activity components render with correct types
- [ ] Video manifest entries have corresponding `.mp4` files
- [ ] Video player HTML/CSS/JS is correctly injected
- [ ] Brand compliance: IBM Plex Mono, `#E25C3D`, warm cream background
- [ ] Font sizes meet minimums (body >= 0.95rem, canvas text >= 12px)
- [ ] Self-contained (no external CSS, only CDN JS for fonts/charts)
- [ ] File size within target (HTML < 500KB, excluding videos)
- [ ] localStorage progress tracking works
- [ ] Print view hides interactive panes
- [ ] Responsive at 1024px and 640px breakpoints

### 5.4 Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Ingestion success rate | > 95% of public GitHub repos | Automated test suite across 50 repos |
| Content accuracy | 0 hallucinated paths/functions | verify-content.js exit code |
| Video generation success | > 90% of sections get video | HeyGen job completion rate |
| Course completeness | 100% of sections have content + quiz | validate-course.js |
| Activity coverage | >= 1 activity per course | validate-course.js |
| Generation time (no video) | < 5 minutes | End-to-end timer |
| Generation time (with video) | < 15 minutes | End-to-end timer |
| Accessibility | WCAG AA pass | axe-core automated audit |
| File size | HTML < 500KB (excl. videos) | validate-course.js |

### 5.5 Future Enhancements (Post-MVP)

| Enhancement | Priority | Rationale |
|-------------|----------|-----------|
| SCORM/xAPI export | High | LMS integration for corporate training |
| Multi-language support | High | Translate courses to other languages |
| Custom avatar upload | Medium | Users bring their own HeyGen avatar |
| Real-time code execution (WebAssembly) | Medium | Run activity code in-browser |
| Collaborative editing | Low | Multiple users editing a course |
| Analytics dashboard | Medium | Track learner progress across courses |
| Batch generation | Medium | Generate courses for all repos in an org |
| Interactive video (branching) | Low | Choose-your-own-adventure style video |
| Voice cloning | Low | Clone the user's voice for the avatar |
| Auto-update courses | Medium | Re-run on repo changes, diff the course |

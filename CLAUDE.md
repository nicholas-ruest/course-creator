# Course Creator

Generate comprehensive interactive HTML courses from GitHub repos, URLs, and
packages with HeyGen talking-head instructors.

## Quick Start

```bash
# Install dependencies
npm install

# Generate a course from a local directory (no video)
node src/cli.js ./path/to/repo --no-video

# Generate from a GitHub slug
node src/cli.js anthropics/claude-code --no-video

# Generate with HeyGen video (requires API key)
HEYGEN_API_KEY=your-key node src/cli.js owner/repo

# Run tests
npm test
```

## Source Types

| Format | Example |
|--------|---------|
| `owner/repo` | `anthropics/claude-code` |
| `owner/repo/path` | `vercel/next.js/packages/next` |
| `https://github.com/...` | Full GitHub URL |
| `https://docs.example.com` | Documentation URL |
| `npm:package-name` | `npm:zod` |
| `pypi:package-name` | `pypi:fastapi` |
| `./path/to/dir` | Local directory |

## CLI Options

```
--sections N      Target section count (default: auto)
--no-video        Skip HeyGen video generation
--no-quizzes      Omit quizzes/assessments
--avatar <id>     HeyGen avatar ID
--voice <id>      HeyGen voice ID
--deep            8-12 sections, advanced content
--quick           3-5 sections, lighter content
--audience <lvl>  beginner | intermediate | advanced
```

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `HEYGEN_API_KEY` | For video | HeyGen API authentication |
| `GITHUB_TOKEN` | For private repos | GitHub API / gh CLI authentication |

## Architecture

See `plans/INDEX.md` for the full planning document index.

### Key Decisions (ADRs)

- **ADR-001**: Single HTML file + sidecar video directory
- **ADR-002**: 7-agent parallel educator swarm
- **ADR-003**: Async HeyGen video pipeline with graceful degradation
- **ADR-004**: Multi-source ingestion with unified ContentBundle
- **ADR-005**: Two-gate content verification (pre + post generation)
- **ADR-006**: Video caching by script hash (SHA-256)
- **ADR-007**: File importance scoring for token budget management
- **ADR-008**: In-browser activity system with client-side validation

### File Structure

```
src/
  cli.js                 Entry point
  orchestrator.js        Pipeline coordinator (Phases 1-9)
  config.js              Configuration with defaults
  ingestion/
    classifier.js        Source type detection
    scorer.js            File importance scoring
    extractor.js         ContentBundle assembly
    github.js            GitHub repo cloning
    url.js               URL fetching and extraction
    package.js           npm/PyPI resolution
    index.js             Ingestion router
  agents/                Agent prompts (7 markdown files)
  generator/
    template.js          HTML template loading
    sections.js          Section HTML generation
    activities.js        Activity engine (HTML/CSS/JS)
    video-player.js      Video player component
    course-data.js       COURSE_DATA v2 builder
    html.js              HTML generation orchestrator
    index.js             Disk output writer
  video/
    tts-sanitizer.js     7-stage TTS pipeline
    cache.js             Video caching
    heygen.js            HeyGen API client
    poller.js            Video job polling
  validation/
    validate-course.cjs  Post-generation structural validator
    verify-content.cjs   Pre-generation content verifier
resources/
  templates/             HTML shell template
  brand/                 Agentics brand assets
```

## Validation

```bash
# Validate a generated course
node src/validation/validate-course.cjs courses/my-course.html

# Verify content claims against a workspace
node src/validation/verify-content.cjs --check-html courses/my-course.html --workspace ./repo

# Validate activity specifications
node src/validation/verify-content.cjs --check-activities activities.json
```

## Brand

All courses use the Agentics Foundation brand:
- Primary: `#E25C3D` (coral)
- Background: `#FAF9F6` (warm cream)
- Font: IBM Plex Mono (headings), Barlow Condensed (section titles)
- Console dots motif (red/amber/teal)

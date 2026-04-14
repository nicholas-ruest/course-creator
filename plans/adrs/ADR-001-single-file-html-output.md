# ADR-001: Single-File HTML Output with Sidecar Video Directory

## Status

Accepted

## Date

2026-04-13

## Context

The course creator system must produce a deliverable that is easy to share,
host, and view. The existing course skill outputs a single self-contained HTML
file with all CSS and JS inline. Adding HeyGen video introduces binary assets
(`.mp4` files) that cannot be reasonably inlined into HTML.

We considered three output strategies:

1. **Single HTML file with base64-encoded video**: All content including video
   embedded as data URIs.
2. **Single HTML file + sidecar video directory**: HTML file references local
   video files in an adjacent `videos/` directory.
3. **Multi-file web application**: Standard web app with separate HTML, CSS, JS,
   and video files.

## Decision

We will use **Option 2: Single HTML file + sidecar video directory**.

The output structure is:

```
courses/{topic-slug}/
  index.html          <- Self-contained HTML (CSS/JS inline)
  videos/
    s1-intro.mp4      <- HeyGen video per section
    s2-basics.mp4
    ...
  manifest.json       <- Course metadata + video manifest
```

When `--no-video` is used, the output collapses to a single
`courses/{topic-slug}.html` file, preserving full backward compatibility with
the existing skill's output format.

## Rationale

**Option 1 rejected** because base64-encoding video inflates file size by ~33%.
A typical 8-section course with 2 min/section of 1080p video would be ~400MB
of raw video, ballooning to ~530MB base64-encoded. This makes the HTML file
unusable -- browsers struggle to parse it, it cannot be emailed, and git
hosting rejects it.

**Option 3 rejected** because it loses the key advantage of the existing skill:
shareability. A single HTML file (or a directory you can zip) is drastically
simpler to distribute than a multi-file web app requiring a build step or web
server. The existing user base expects a single artifact.

**Option 2** preserves the self-contained HTML philosophy (all CSS/JS inline,
only fonts loaded from CDN) while cleanly separating binary video assets.
The `manifest.json` provides machine-readable metadata for potential future
integrations (LMS, hosting platforms).

## Consequences

### Positive

- Backward compatible: `--no-video` produces the exact same single-file output
  as the existing skill
- Shareable: zip the directory and send it; open `index.html` in any browser
- Video files can be hosted on a CDN independently of the HTML
- `manifest.json` enables future tooling (course catalogs, LMS import)

### Negative

- Distribution is now a directory rather than a single file (when video is used)
- Video playback requires the `videos/` directory to be co-located with the HTML
- Users must understand relative path structure to host the course

### Mitigations

- The HTML includes a graceful fallback: if a video file is not found, the
  lecturer pane shows the text transcript instead
- We can add a `--bundle` flag in the future that produces a single `.zip`
  for one-step sharing
- The HTML uses relative paths (`videos/s1.mp4`) so the directory can be
  moved or hosted anywhere as long as the structure is preserved

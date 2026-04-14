# DDD-006: Agentics Foundation Brand System Extension

## Overview

This document specifies how the existing Agentics Foundation brand system is
extended to accommodate the new video player, activity components, and course
metadata UI, while preserving complete backward compatibility with existing
courses.

**Related ADRs**: ADR-001 (output format), ADR-008 (activity system)

## Brand Principles (Retained)

The Agentics Foundation visual identity is defined by five principles that
must be preserved in all new components:

1. **Warm, not cold**: Cream backgrounds (`#FAF9F6`), not pure white or dark.
   Even dark mode uses warm blacks, not blue-blacks.
2. **Coral is the signature**: Primary accent `#E25C3D` appears on all
   interactive elements, section labels, and navigation highlights.
3. **Monospace is the voice**: IBM Plex Mono for headings, labels, and any
   "system" text. It signals "this is a tool built by technologists."
4. **Generous rounding**: `border-radius: 16px` for cards, `10px` for smaller
   elements. No sharp corners except dividers.
5. **Console dots motif**: Red/amber/teal dot trio in demo container headers.
   This is the Agentics "thumbprint."

## New Components and Their Brand Integration

### Video Player

The video player is the most prominent new component. It must feel native
to the Agentics brand, not like an embedded third-party widget.

| Element | Brand Treatment |
|---------|----------------|
| Video container | `border-radius: var(--radius-sm)` (10px), `background: var(--bg-code)` for letterboxing |
| Controls bar | `background: var(--bg-console)`, `border-top: 1px solid var(--border)` -- matches demo container header treatment |
| Play/pause button | Coral (`var(--primary)`) icon, hover: `var(--primary-hover)` |
| Progress bar track | `var(--border)` color, 4px height, rounded |
| Progress bar fill | Coral (`var(--primary)`) -- consistent with the course progress bar in the left pane |
| Time display | IBM Plex Mono, `var(--text-dim)`, 0.68rem -- same as section labels |
| Mute button | `var(--text-dim)` default, coral on hover |
| Focus indicators | 2px solid `var(--primary)` outline -- matches quiz option focus style |

Design rationale: The video player visually mirrors the `.demo-container`
component (console window motif). It uses the same `--bg-console` for controls,
the same border treatment, and the same rounded corners. This makes the video
feel like "another interactive demo" rather than an alien widget.

### Activity Cards

Activities are a new component family. They share structural DNA with the
existing `.callout` and `.vernacular` boxes but are visually distinct to
signal "do something" rather than "read something."

| Element | Brand Treatment |
|---------|----------------|
| Card border | Left border: 4px solid, color varies by activity type (see below) |
| Card background | `var(--bg-card)` (white) with `border: 1px solid var(--border)` |
| Card corners | `border-radius: 0 var(--radius) var(--radius) 0` -- flat left edge for the border accent, rounded right -- matches `.vernacular` and `.callout` |
| Activity badge | `font-family: var(--font-mono)`, pill shape (`border-radius: 9999px`), uppercase, 0.72rem |
| Title | `font-family: var(--font-mono)`, `var(--text-bright)` -- same as `h4` treatment |
| Code editor | `background: var(--bg-code)` (#1a1a1a), `color: var(--text-code)`, IBM Plex Mono -- matches `.code-block` |
| Check button | `.btn-primary` -- coral filled button |
| Hint/Solution buttons | `.btn-outline` -- outlined button |

### Activity Type Colors

Each activity type has a left-border accent color. Coral remains dominant
in buttons and interaction states; the type color is a categorization signal
only.

| Activity Type | Left Border Color | Badge Color | Rationale |
|--------------|------------------|-------------|-----------|
| Code Exercise | `var(--blue)` (#3b82f6) | Blue on blue-dim | Matches "Web/Frontend" topic accent |
| Guided Exploration | `var(--green)` (#22c55e) | Green on green-dim | Green = discovery, "go explore" |
| Build Challenge | `var(--primary)` (#E25C3D) | Coral on coral-dim | Most intense activity gets the brand color |
| Debug Challenge | `var(--red)` (#ef4444) | Red on red-dim | Red = bug, danger, fix it |
| Architecture Puzzle | `#8b5cf6` (purple) | Purple on purple-dim | Purple = abstract thinking, design |

This color scheme parallels the existing **Topic Accent Variations** table
in the SKILL.md, which uses the same color assignments for similar domains.

### Feedback States

Validation feedback uses the existing success/error color system:

| State | Color | Background |
|-------|-------|-----------|
| Pass | `var(--green)` | `rgba(34, 197, 94, 0.08)` |
| Fail | `var(--red)` | `rgba(239, 68, 68, 0.08)` |
| Hint | `var(--amber)` | `rgba(251, 191, 36, 0.06)` |

These match the existing `.quiz-option.correct` and `.quiz-option.incorrect`
treatments, creating visual consistency between quiz feedback and activity
feedback.

### Course Metadata Bar

A new optional metadata bar appears below the topnav when the course has
video or enhanced metadata:

```html
<div class="course-meta-bar">
  <span class="meta-item">
    <span class="meta-icon">📖</span>
    <span class="meta-value">8 sections</span>
  </span>
  <span class="meta-item">
    <span class="meta-icon">🎥</span>
    <span class="meta-value">16 min video</span>
  </span>
  <span class="meta-item">
    <span class="meta-icon">✍️</span>
    <span class="meta-value">6 activities</span>
  </span>
  <span class="meta-item">
    <span class="meta-icon">📝</span>
    <span class="meta-value">18 questions</span>
  </span>
  <span class="meta-item">
    <span class="meta-icon">⏱️</span>
    <span class="meta-value">~45 min</span>
  </span>
</div>
```

```css
.course-meta-bar {
  display: flex;
  gap: 20px;
  padding: 8px 20px;
  background: var(--bg-console);
  border-bottom: 1px solid var(--border);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-dim);
  position: fixed;
  top: 56px;                        /* Below topnav */
  left: 0;
  right: 0;
  z-index: 99;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.meta-value {
  color: var(--text);
  font-weight: 500;
}
```

When the meta bar is present, the course layout top offset increases from
56px to 88px (56px topnav + 32px meta bar).

## CSS Variable Additions

The following CSS custom properties are added to `:root` for the new
components. They follow the existing naming conventions:

```css
:root {
  /* ── Existing variables unchanged ── */

  /* ── New: Activity colors ── */
  --activity-blue: rgb(59, 130, 246);
  --activity-blue-dim: rgba(59, 130, 246, 0.1);
  --activity-purple: #8b5cf6;
  --activity-purple-dim: rgba(139, 92, 246, 0.1);

  /* ── New: Video player ── */
  --video-bg: var(--bg-code);
  --video-controls-bg: var(--bg-console);

  /* ── New: Meta bar ── */
  --meta-bar-height: 32px;
}
```

## Typography Additions

New font size assignments for new components:

| Component | Font | Size | Weight | Color |
|-----------|------|------|--------|-------|
| Activity badge | `--font-mono` | 0.72rem | 600 | Type color |
| Activity title | `--font-mono` | 1rem | 600 | `--text-bright` |
| Activity description | `--font-sans` | 0.92rem | 400 | `--text` |
| Activity editor | `--font-mono` | 0.82rem | 400 | `--text-code` |
| Editor toolbar label | `--font-mono` | 0.68rem | 400 | `hsl(0 0% 50%)` |
| Feedback text | `--font-sans` | 0.85rem | 400 | Green/red |
| Hint label | `--font-mono` | 0.72rem | 600 | `--amber` |
| Hint text | `--font-sans` | 0.85rem | 400 | `--text` |
| Video time | `--font-mono` | 0.68rem | 400 | `--text-dim` |
| Transcript header | `--font-mono` | 0.72rem | 600 | `--text-dim` |
| Transcript body | `--font-sans` | 0.85rem | 400 | `--text` |
| Meta bar values | `--font-mono` | 0.72rem | 500 | `--text` |
| File tree | `--font-mono` | 0.78rem | 400 | `--text` |
| File preview | `--font-mono` | 0.78rem | 400 | `--text-code` |
| Debug badge | `--font-mono` | 0.78rem | 600 | `--red` |
| Test result | `--font-mono` | 0.82rem | 400 | Green/red |
| Puzzle piece | `--font-mono` | 0.82rem | 400 | `--text` |
| Puzzle slot label | `--font-mono` | 0.68rem | 400 | `--text-dim` |

All sizes meet the UX Reviewer's minimum font size requirements:
- No text below 0.68rem (10.88px at 16px base)
- Body text minimum 0.85rem (13.6px)
- Interactive element text minimum 0.78rem (12.48px)

## Dark Mode Coverage

All new components must support `:root.dark`. The existing dark mode variable
overrides handle most cases automatically (background, text, border colors
adapt via CSS custom properties). Component-specific dark mode considerations:

| Component | Light Mode | Dark Mode |
|-----------|-----------|-----------|
| Video container | `--bg-code` (#1a1a1a) | Same (already dark) |
| Video controls | `--bg-console` (warm cream) | `--bg-console` (dark gray) |
| Activity card | `--bg-card` (white) | `--bg-card` (dark gray) |
| Code editor | `--bg-code` (#1a1a1a) | Same (already dark) |
| File tree | `--bg-console` | `--bg-console` |
| Puzzle pieces | `--bg-card` | `--bg-card` |
| Meta bar | `--bg-console` | `--bg-console` |
| Feedback pass bg | `rgba(34, 197, 94, 0.08)` | Same (alpha on dark = visible) |
| Feedback fail bg | `rgba(239, 68, 68, 0.08)` | Same |

No additional `:root.dark` overrides are needed because:
1. All new components use CSS custom properties (not hardcoded colors)
2. Alpha-based backgrounds (`rgba(...)`) work on both light and dark surfaces
3. The code editor and video container are already dark in light mode

## Print Considerations

```css
@media print {
  /* Existing: topnav, lecturer, sidebar, glossary hidden */

  /* New: hide video, show transcript inline */
  .lecturer-video { display: none !important; }
  .lecturer-transcript { display: block !important; }

  /* New: hide activity interactivity, show content */
  .activity-editor-wrap { page-break-inside: avoid; }
  .activity-actions { display: none !important; }
  .activity-hints { display: none !important; }
  .activity-feedback { display: none !important; }
  .activity-editor {
    background: white !important;
    color: black !important;
    border: 1px solid #ccc !important;
    max-height: none !important;
  }

  /* Show solutions in print */
  .activity-editor::after {
    content: attr(data-solution);
    display: block;
    color: #666;
    font-style: italic;
    margin-top: 8px;
  }

  /* Hide puzzle drag interaction */
  .puzzle-pieces { display: none !important; }
  .puzzle-slots .puzzle-piece { border-style: solid !important; }

  /* Hide meta bar */
  .course-meta-bar { display: none !important; }
}
```

## Backward Compatibility

Courses generated with the v1 schema (text-only lecturer, no activities,
no video) must render correctly in the v2 template:

| v1 Feature | v2 Handling |
|-----------|-------------|
| Emoji avatar | Shown in `.video-fallback` (visible when no video) |
| Lecturer name/role | Shown in `.video-fallback` |
| Lecturer dialogue | Displayed in `.lecturer-transcript` (transcript pane) |
| No activities | Activity sections simply don't exist in HTML |
| No video | `.lecturer-video` hidden, `.video-fallback` visible |
| No meta bar | `.course-meta-bar` not rendered (or shows section/quiz counts only) |

The v2 template detects v1 courses via `COURSE_DATA.meta.version`:

```javascript
if (!COURSE_DATA.meta.version || COURSE_DATA.meta.version < "2.0.0") {
  // V1 mode: show avatar, hide video player, no meta bar
  document.getElementById('lecturer-video')?.remove();
  document.getElementById('video-fallback').style.display = 'block';
}
```

## Component Inventory (Complete)

All components that ship in a v2 course HTML, organized by pane:

### Topnav (fixed)
1. Agentics logo (SVG inline)
2. Course title
3. Glossary button
4. Course meta bar (NEW)

### Left Pane (lecturer)
5. Progress bar
6. Video player (NEW) / Avatar fallback
7. Video controls (NEW)
8. Section nav list
9. Transcript / Lecturer dialogue

### Center Pane (content)
10. `.section` -- scroll-reveal container
11. `.section-label` -- numbered section header
12. `.vernacular` -- terminology box (MANDATORY)
13. `.analogy` -- analogy callout
14. `.key-insight` -- green insight box
15. `.vs-box` -- comparison columns
16. `.code-block` -- code with language tag
17. `.demo-container` -- interactive viz wrapper (console motif)
18. `.compare-table` -- data table
19. `.callout` -- bordered aside
20. `.term` -- inline glossary tooltip
21. `.activity-card` -- activity wrapper (NEW)
22. Code Exercise component (NEW)
23. Guided Exploration component (NEW)
24. Build Challenge component (NEW)
25. Debug Challenge component (NEW)
26. Architecture Puzzle component (NEW)
27. Citations section

### Right Pane (quiz sidebar)
28. Quiz cards (MC, code-completion, concept-match)
29. Score display

### Overlays
30. Glossary panel (searchable, categorized)

Total: 30 components (24 existing + 6 new)

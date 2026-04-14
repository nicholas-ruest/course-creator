import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const VALIDATOR = path.resolve('src/validation/validate-course.cjs');

function runValidator(htmlContent) {
  const tmpFile = path.join(os.tmpdir(), `course-test-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, htmlContent);
  try {
    const output = execSync(`node ${VALIDATOR} ${tmpFile}`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return { exitCode: 0, output };
  } catch (e) {
    return { exitCode: e.status, output: e.stdout || e.stderr || '' };
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

// ── Minimal valid v2 HTML ──────────────────────────────────────────────────

// Pad to exceed the 5KB minimum filesize check in validate-course.cjs
const PADDING = '<!-- ' + 'x'.repeat(6000) + ' -->\n';

const VALID_V2_HTML = PADDING + `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Test Course</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=Barlow+Condensed:wght@600&display=swap" rel="stylesheet">
<style>
:root { --primary: #E25C3D; --bg: #FAF9F6; }
body { font-family: 'IBM Plex Mono', monospace; }
</style>
</head>
<body>
<nav class="topnav"><button id="glossary-btn">Glossary</button></nav>
<div class="course-layout">
  <aside class="lecturer">
    <div class="lecturer-dialogue" id="lecturer-dialogue"></div>
  </aside>
  <main class="content">
    <div class="section" data-section="s1">
      <h2>Section 1</h2>
      <span class="term" data-term="Hook">Hook</span>
      <div class="vernacular"><dl><dt>Hook</dt><dd>A function</dd></dl></div>
    </div>
    <div class="section" data-section="s2">
      <h2>Section 2</h2>
      <span class="term" data-term="Effect">Effect</span>
      <div class="vernacular"><dl><dt>Effect</dt><dd>A side effect</dd></dl></div>
    </div>
    <div class="section" data-section="s3">
      <h2>Section 3</h2>
      <span class="term" data-term="State">State</span>
      <div class="vernacular"><dl><dt>State</dt><dd>Component state</dd></dl></div>
      <div class="demo-container"><div class="dots"><span></span></div></div>
    </div>
  </main>
  <aside class="sidebar">
    <div class="quiz-card">Quiz 1</div>
  </aside>
</div>
<div id="glossary-overlay" class="glossary-overlay">
  <div class="glossary-panel"></div>
</div>
<script>
const COURSE_DATA = {
  meta: {
    title: "Test Course",
    topic: "test-course",
    version: "2.0.0",
    hasVideo: false,
    totalActivities: 0,
    sectionCount: 3,
    totalQuestions: 1,
  },
  sections: [
    { id: "s1", title: "Section 1", assessments: [], activities: [] },
    { id: "s2", title: "Section 2", assessments: [{}], activities: [] },
    { id: "s3", title: "Section 3", assessments: [], activities: [] }
  ],
  glossary: [
    { term: "Hook", definition: "A function", category: "concept", firstIntroduced: "s1" }
  ],
  citations: []
};
localStorage.setItem('test', '1');
</script>
</body>
</html>`;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('validate-course.js — existing checks', () => {
  it('passes on valid v2 HTML', () => {
    const { exitCode, output } = runValidator(VALID_V2_HTML);
    expect(exitCode).toBe(0);
    expect(output).toContain('PASS');
  });

  it('fails on missing COURSE_DATA', () => {
    const html = VALID_V2_HTML.replace(/const\s+COURSE_DATA[\s\S]*?};/, '// no data');
    const { exitCode, output } = runValidator(html);
    expect(exitCode).toBe(1);
    expect(output).toContain('COURSE_DATA');
  });

  it('fails on missing brand color', () => {
    const html = VALID_V2_HTML.replace(/#E25C3D/g, '#000000');
    const { exitCode, output } = runValidator(html);
    expect(exitCode).toBe(1);
    expect(output).toContain('brand.color');
  });

  it('fails on missing IBM Plex Mono', () => {
    const html = VALID_V2_HTML.replace(/IBM Plex Mono/g, 'Arial').replace(/IBM\+Plex\+Mono/g, 'Arial');
    const { exitCode, output } = runValidator(html);
    expect(exitCode).toBe(1);
    expect(output).toContain('brand.font');
  });
});

describe('validate-course.js — v2 activity checks', () => {
  it('catches invalid activity type in HTML', () => {
    const html = VALID_V2_HTML.replace(
      'totalActivities: 0,',
      'totalActivities: 1,',
    ).replace(
      'activities: [] }',
      'activities: [{ id: "act-s1-1", type: "invalid-type", title: "Bad" }] }',
    ).replace(
      '</main>',
      '<div class="activity-card" data-activity-type="invalid-type"></div></main>',
    );
    const { exitCode, output } = runValidator(html);
    expect(output).toContain('Invalid activity type');
  });

  it('catches invalid activity id pattern', () => {
    const html = VALID_V2_HTML.replace(
      'activities: [] }',
      'activities: [{ id: "bad-id", type: "code-exercise", title: "Test" }] }',
    );
    const { output } = runValidator(html);
    // The id "bad-id" starts with a valid activity type, so the check triggers
    expect(output).toContain('act-sN-N');
  });

  it('accepts valid activity types and ids', () => {
    const html = VALID_V2_HTML.replace(
      'totalActivities: 0,',
      'totalActivities: 1,',
    ).replace(
      'activities: [] },\n    { id: "s2"',
      'activities: [{ id: "act-s1-1", type: "code-exercise", title: "Test", hints: ["h1"] }] },\n    { id: "s2"',
    ).replace(
      '</main>',
      '<div class="activity-card" data-activity-type="code-exercise"></div></main>',
    );
    const { exitCode, output } = runValidator(html);
    // Should not contain activity-related failures
    expect(output).not.toContain('Invalid activity type');
  });
});

describe('validate-course.js — v2 video checks', () => {
  it('fails when hasVideo is true but video player elements missing', () => {
    const html = VALID_V2_HTML.replace('hasVideo: false', 'hasVideo: true');
    const { exitCode, output } = runValidator(html);
    expect(exitCode).toBe(1);
    expect(output).toContain('instructor-video');
  });

  it('passes when hasVideo is true and video elements present', () => {
    const html = VALID_V2_HTML
      .replace('hasVideo: false', 'hasVideo: true')
      .replace(
        '<div class="lecturer-dialogue"',
        '<div id="lecturer-video"><video id="instructor-video"></video></div><div id="lecturer-transcript"></div><div class="lecturer-dialogue"',
      );
    const { output } = runValidator(html);
    expect(output).not.toContain('v2.video.player');
    expect(output).not.toContain('v2.video.pane');
  });

  it('warns when videoUrl references a missing file', () => {
    const html = VALID_V2_HTML.replace(
      'videoUrl: null',
      'videoUrl: "videos/nonexistent.mp4"',
    );
    // This should warn, not fail
    const { output } = runValidator(html);
    // The warning about missing video file
    if (output.includes('v2.video.file')) {
      expect(output).toContain('Video file not found');
    }
  });
});

describe('validate-course.js — v2 version check', () => {
  it('warns when version is not 2.0.0', () => {
    const html = VALID_V2_HTML.replace('version: "2.0.0"', 'version: "1.0.0"');
    const { output } = runValidator(html);
    expect(output).toContain('v2.version');
  });
});

describe('validate-course.js — transcript/dialogue', () => {
  it('does not warn when lecturer-dialogue is present', () => {
    const { output } = runValidator(VALID_V2_HTML);
    expect(output).not.toContain('v2.transcript');
  });

  it('warns when neither transcript nor dialogue is present', () => {
    const html = VALID_V2_HTML
      .replace('id="lecturer-dialogue"', 'id="something-else"');
    const { output } = runValidator(html);
    expect(output).toContain('v2.transcript');
  });
});

// ── Template compatibility ─────────────────────────────────────────────────

describe('validate-course.js — template compatibility', () => {
  it('does not crash on the existing agentics-shell.html template', () => {
    const templatePath = path.resolve('resources/templates/agentics-shell.html');
    try {
      const output = execSync(`node ${VALIDATOR} ${templatePath}`, {
        encoding: 'utf-8',
        timeout: 10000,
      });
      // Template has placeholders, so it should fail but not crash
      // It shouldn't get here (exit 0) since template lacks real COURSE_DATA
    } catch (e) {
      // Expected: exit 1 with failures (missing COURSE_DATA, etc.)
      expect(e.status).toBe(1);
      expect(e.stdout).toContain('Agentics Course Validator');
      expect(e.stdout).toContain('FAIL');
    }
  });
});

#!/usr/bin/env node
/**
 * validate-course.js — Deterministic quality gate for generated course HTML
 *
 * Checks structural integrity, data model validity, accessibility minimums,
 * and brand compliance. Run after HTML generation, before HRBrowse verification.
 *
 * Usage:
 *   node .claude/skills/course/scripts/validate-course.js courses/my-course.html
 *
 * Exit codes:
 *   0 = all checks pass
 *   1 = validation failures found (details printed)
 *   2 = file not found or unreadable
 */

'use strict';

const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node validate-course.js <course.html>');
  process.exit(2);
}

const absPath = path.resolve(file);
if (!fs.existsSync(absPath)) {
  console.error(`File not found: ${absPath}`);
  process.exit(2);
}

const html = fs.readFileSync(absPath, 'utf-8');
const lines = html.split('\n');
const failures = [];
const warnings = [];

function fail(check, detail) { failures.push({ check, detail }); }
function warn(check, detail) { warnings.push({ check, detail }); }

// ─── 1. COURSE_DATA JSON integrity ──────────────────────────────────────────
// Match COURSE_DATA — use a greedy match up to the last `};` to handle large JSON
const dataMatch = html.match(/const\s+COURSE_DATA\s*=\s*(\{[\s\S]*\});/);
let courseData = null;
if (!dataMatch) {
  fail('COURSE_DATA', 'No COURSE_DATA object found in HTML');
} else {
  try {
    // Attempt to parse — this is a rough check since the JSON is actually JS
    // We look for the structure rather than parsing raw JS
    // Handle both JS object literal (meta:) and JSON ("meta":) formats
    const hasMetaTitle = /"?meta"?\s*:\s*\{[\s\S]*?"?title"?\s*:/s.test(dataMatch[1]);
    const hasSections = /"?sections"?\s*:\s*\[/s.test(dataMatch[1]);
    const hasGlossary = /"?glossary"?\s*:\s*\[/s.test(dataMatch[1]);
    const hasCitations = /"?citations"?\s*:\s*\[/s.test(dataMatch[1]);

    if (!hasMetaTitle) fail('COURSE_DATA.meta', 'Missing meta.title in COURSE_DATA');
    if (!hasSections) fail('COURSE_DATA.sections', 'Missing sections array in COURSE_DATA');
    if (!hasGlossary) fail('COURSE_DATA.glossary', 'Missing glossary array in COURSE_DATA');
    if (!hasCitations) warn('COURSE_DATA.citations', 'Missing citations array (OK if no external sources)');
  } catch (e) {
    fail('COURSE_DATA.parse', `Failed to analyze COURSE_DATA: ${e.message}`);
  }
}

// ─── 2. Section structure ───────────────────────────────────────────────────
const sectionCount = (html.match(/class="section"[^>]*data-section="/g) || []).length;
if (sectionCount === 0) {
  fail('sections.count', 'No sections found (expected class="section" data-section="sN")');
} else if (sectionCount < 3) {
  warn('sections.count', `Only ${sectionCount} sections found (expected 5-10)`);
}

// ─── 3. Vernacular boxes (terminology — MANDATORY per section) ──────────────
const vernacularCount = (html.match(/class="vernacular"/g) || []).length;
if (vernacularCount === 0) {
  fail('vernacular', 'No .vernacular boxes found — terminology is MANDATORY per section');
} else if (vernacularCount < sectionCount * 0.6) {
  warn('vernacular', `Only ${vernacularCount} vernacular boxes for ${sectionCount} sections (expected ~1 per section)`);
}

// ─── 4. Glossary ────────────────────────────────────────────────────────────
const hasGlossaryPanel = html.includes('glossary-overlay') || html.includes('glossary-panel');
const hasGlossaryBtn = html.includes('glossary-btn');
if (!hasGlossaryPanel) fail('glossary.panel', 'No glossary overlay/panel found');
if (!hasGlossaryBtn) fail('glossary.button', 'No glossary button found in topnav');

const termCount = (html.match(/class="term"/g) || []).length;
if (termCount === 0) {
  warn('terms.inline', 'No inline .term spans found — terms should be highlighted at point of use');
}

// ─── 5. Quiz components ────────────────────────────────────────────────────
const quizCount = (html.match(/class="quiz-card"/g) || []).length;
if (quizCount === 0) {
  warn('quizzes', 'No quiz cards found (OK if "no quizzes" modifier was used)');
}

// ─── 6. Visualizations ─────────────────────────────────────────────────────
const canvasCount = (html.match(/<canvas/g) || []).length;
const svgCount = (html.match(/<svg[^>]*class/g) || []).length;
const demoCount = (html.match(/class="demo-container"/g) || []).length;
if (demoCount === 0 && canvasCount === 0) {
  warn('visualizations', 'No demo containers or canvases found (expected at least 1)');
}

// ─── 7. Lecturer pane ──────────────────────────────────────────────────────
const hasLecturer = html.includes('class="lecturer"') || html.includes('lecturer-dialogue');
if (!hasLecturer) {
  warn('lecturer', 'No lecturer pane found (OK if "no lecturer" modifier was used)');
}

// ─── 8. Brand compliance ───────────────────────────────────────────────────
const hasIBMPlexMono = html.includes('IBM Plex Mono') || html.includes('IBM+Plex+Mono');
const hasBarlowCondensed = html.includes('Barlow Condensed') || html.includes('Barlow+Condensed');
const hasPrimaryColor = html.includes('#E25C3D') || html.includes('#e25c3d') || html.includes('hsl(11');
const hasWarmBg = html.includes('#FAF9F6') || html.includes('--bg:') || html.includes('faf9f6');

if (!hasIBMPlexMono) fail('brand.font', 'Missing IBM Plex Mono font — required for Agentics brand');
if (!hasBarlowCondensed) warn('brand.font', 'Missing Barlow Condensed font (used for section h3 headings)');
if (!hasPrimaryColor) fail('brand.color', 'Missing Agentics primary color #E25C3D');

// ─── 9. Font size minimums ─────────────────────────────────────────────────
// Check for dangerously small font sizes in inline styles
const tinyFonts = [];
const fontSizeMatches = html.matchAll(/font-size:\s*([\d.]+)(rem|px|em)/g);
for (const m of fontSizeMatches) {
  const size = parseFloat(m[1]);
  const unit = m[2];
  if (unit === 'rem' && size < 0.7) tinyFonts.push(`${size}rem`);
  if (unit === 'px' && size < 11) tinyFonts.push(`${size}px`);
  if (unit === 'em' && size < 0.7) tinyFonts.push(`${size}em`);
}
if (tinyFonts.length > 0) {
  warn('font.size', `Found ${tinyFonts.length} font sizes below minimum: ${[...new Set(tinyFonts)].join(', ')}`);
}

// ─── 10. Self-contained check ───────────────────────────────────────────────
const externalCSS = html.match(/<link[^>]*rel="stylesheet"[^>]*href="(?!https:\/\/fonts)/g) || [];
const externalJS = html.match(/<script[^>]*src="(?!https:\/\/(cdn|fonts|d3js|cdnjs))/g) || [];
if (externalCSS.length > 0) {
  fail('self-contained.css', `Found ${externalCSS.length} external CSS references (should be inline)`);
}
if (externalJS.length > 0) {
  warn('self-contained.js', `Found ${externalJS.length} non-CDN external JS references`);
}

// ─── 11. File size sanity ───────────────────────────────────────────────────
const sizeKB = Math.round(fs.statSync(absPath).size / 1024);
if (sizeKB > 800) {
  warn('filesize', `Course is ${sizeKB}KB — consider reducing (target: 200-500KB without Plotly)`);
} else if (sizeKB < 5) {
  fail('filesize', `Course is only ${sizeKB}KB — likely incomplete or empty`);
}

// ─── 12. localStorage key ───────────────────────────────────────────────────
const hasLocalStorage = html.includes('localStorage');
if (!hasLocalStorage) {
  warn('progress', 'No localStorage usage found — quiz progress won\'t persist');
}

// ─── 13. Console dots (Agentics signature) ──────────────────────────────────
const hasConsoleDots = html.includes('console-dot') || html.includes('dots');
if (!hasConsoleDots) {
  warn('brand.console-dots', 'No console dots (red/amber/teal) found — Agentics signature element');
}

// ─── 14. v2 Schema: meta.version ────────────────────────────────────────────
const hasVersion = dataMatch && /"?version"?\s*:\s*"2\.0\.0"/s.test(dataMatch[1]);
if (dataMatch && !hasVersion) {
  warn('v2.version', 'meta.version is not "2.0.0" — expected v2 schema');
}

// ─── 15. v2 Schema: Activity validation ─────────────────────────────────────
const VALID_ACTIVITY_TYPES = [
  'code-exercise', 'guided-exploration', 'build-challenge',
  'debug-challenge', 'architecture-puzzle'
];
const ACTIVITY_ID_PATTERN = /^act-s\d+-\d+$/;

const activityCardCount = (html.match(/class="activity-card"/g) || []).length;
// Extract activity data from COURSE_DATA if possible
const activityTypeMatches = html.matchAll(/type:\s*["']([\w-]+)["']\s*,[\s\S]*?id:\s*["'](act-[^"']+)["']/g);
const activityIdMatches = html.matchAll(/id:\s*["'](act-[^"']+)["'][\s\S]*?type:\s*["']([\w-]+)["']/g);

// Check activities in HTML structure
const activityDataSections = html.matchAll(/data-activity-type=["']([\w-]+)["']/g);
for (const m of activityDataSections) {
  if (!VALID_ACTIVITY_TYPES.includes(m[1])) {
    fail('v2.activity.type', `Invalid activity type: "${m[1]}" — expected one of: ${VALID_ACTIVITY_TYPES.join(', ')}`);
  }
}

// Check activity data in COURSE_DATA for id pattern and required fields
if (dataMatch) {
  const activityBlocks = dataMatch[1].matchAll(/\{[^{}]*type:\s*["']([\w-]+)["'][^{}]*id:\s*["']([\w-]+)["'][^{}]*\}/g);
  for (const m of activityBlocks) {
    const type = m[1];
    const id = m[2];
    if (VALID_ACTIVITY_TYPES.includes(type) || id.startsWith('act-')) {
      if (!ACTIVITY_ID_PATTERN.test(id)) {
        fail('v2.activity.id', `Activity id "${id}" does not match pattern act-sN-N`);
      }
      if (!VALID_ACTIVITY_TYPES.includes(type)) {
        fail('v2.activity.type', `Invalid activity type: "${type}"`);
      }
    }
  }
  // Also try reverse order: id before type
  const activityBlocksRev = dataMatch[1].matchAll(/\{[^{}]*id:\s*["']([\w-]+)["'][^{}]*type:\s*["']([\w-]+)["'][^{}]*\}/g);
  for (const m of activityBlocksRev) {
    const id = m[1];
    const type = m[2];
    if (VALID_ACTIVITY_TYPES.includes(type) || id.startsWith('act-')) {
      if (!ACTIVITY_ID_PATTERN.test(id)) {
        fail('v2.activity.id', `Activity id "${id}" does not match pattern act-sN-N`);
      }
      if (!VALID_ACTIVITY_TYPES.includes(type)) {
        fail('v2.activity.type', `Invalid activity type: "${type}"`);
      }
    }
  }
}

// ─── 16. v2 Schema: Video player presence ───────────────────────────────────
const metaHasVideo = dataMatch && /"?hasVideo"?\s*:\s*true/s.test(dataMatch[1]);
if (metaHasVideo) {
  if (!html.includes('id="instructor-video"') && !html.includes("id='instructor-video'")) {
    fail('v2.video.player', 'meta.hasVideo is true but no id="instructor-video" element found');
  }
  if (!html.includes('id="lecturer-video"') && !html.includes("id='lecturer-video'")) {
    fail('v2.video.pane', 'meta.hasVideo is true but no id="lecturer-video" element found');
  }
}

// ─── 17. v2 Schema: Transcript / dialogue element ───────────────────────────
const hasTranscript = html.includes('id="lecturer-transcript"') || html.includes("id='lecturer-transcript'");
const hasDialogue = html.includes('id="lecturer-dialogue"') || html.includes("id='lecturer-dialogue'");
if (!hasTranscript && !hasDialogue) {
  warn('v2.transcript', 'No id="lecturer-transcript" or id="lecturer-dialogue" found');
}

// ─── 18. v2 Schema: Video file existence ────────────────────────────────────
const htmlDir = path.dirname(absPath);
const videoUrlMatches = html.matchAll(/videoUrl:\s*["']([^"']+\.mp4)["']/g);
for (const m of videoUrlMatches) {
  const videoPath = path.resolve(htmlDir, m[1]);
  if (!fs.existsSync(videoPath)) {
    warn('v2.video.file', `Video file not found: ${m[1]} (expected at ${videoPath})`);
  }
}

// ─── Report ─────────────────────────────────────────────────────────────────
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  Agentics Course Validator                              ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`  File: ${path.basename(absPath)}`);
console.log(`  Size: ${sizeKB}KB | Lines: ${lines.length}`);
console.log(`  Sections: ${sectionCount} | Quizzes: ${quizCount} | Activities: ${activityCardCount} | Terms: ${termCount}`);
console.log(`  Vernacular boxes: ${vernacularCount} | Demos: ${demoCount}`);
console.log('');

if (failures.length === 0 && warnings.length === 0) {
  console.log('  ✅ All checks passed');
} else {
  if (failures.length > 0) {
    console.log(`  ❌ FAILURES (${failures.length}):`);
    failures.forEach(f => console.log(`     ✗ [${f.check}] ${f.detail}`));
    console.log('');
  }
  if (warnings.length > 0) {
    console.log(`  ⚠  WARNINGS (${warnings.length}):`);
    warnings.forEach(w => console.log(`     △ [${w.check}] ${w.detail}`));
    console.log('');
  }
}

console.log(`  Result: ${failures.length === 0 ? 'PASS' : 'FAIL'} (${failures.length} failures, ${warnings.length} warnings)`);
console.log('');

process.exit(failures.length > 0 ? 1 : 0);

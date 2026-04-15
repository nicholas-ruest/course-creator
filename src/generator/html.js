/**
 * html.js — Orchestrate full HTML generation from a unified outline.
 *
 * Loads the agentics-shell template, builds COURSE_DATA, generates section
 * HTML, nav items, and citations, injects them into the template, and fills
 * placeholders.
 *
 * See: SPARC.md Section 2.5  (HTML Generation pseudocode)
 *      ADR-001              (Single-File HTML Output)
 */

import { loadTemplate, fillPlaceholders } from './template.js';
import { buildCourseData } from './course-data.js';
import {
  generateSectionHTML,
  generateCitationsHTML,
  generateNavHTML,
} from './sections.js';
import { generateActivityCSS, generateActivityJS } from './activities.js';
import {
  generateVideoPlayerHTML,
  generateTranscriptHTML,
  generateVideoPlayerCSS,
  generateVideoPlayerJS,
} from './video-player.js';

/**
 * Generate the complete course HTML from a unified outline.
 *
 * @param {object} unifiedOutline — synthesized output from educator agents
 * @param {object} options — parsed CLI options
 * @param {object} config — resolved configuration
 * @returns {Promise<{ html: string, courseData: object }>}
 */
export async function generateHTML(unifiedOutline, options, config) {
  // 1. Load the shell template
  let html = loadTemplate();

  // 2. Build COURSE_DATA
  const courseData = buildCourseData(unifiedOutline, options);

  // 3. Generate section HTML for all sections
  const sections = unifiedOutline.sections || [];
  const sectionsHTML = sections
    .map((section, i) =>
      generateSectionHTML(section, i, unifiedOutline.glossary || []),
    )
    .join('\n\n    ');

  // 4. Generate nav items
  const navHTML = generateNavHTML(sections);

  // 5. Generate citations HTML
  const citationsHTML = generateCitationsHTML(unifiedOutline.citations || []);

  // 6a. Inject activity CSS variables into :root and activity CSS before </style>
  const activityCSSVars = `
  /* ── Activity colors (DDD-006) ── */
  --activity-blue: rgb(59, 130, 246);
  --activity-blue-dim: rgba(59, 130, 246, 0.1);
  --activity-purple: #8b5cf6;
  --activity-purple-dim: rgba(139, 92, 246, 0.1);`;

  html = html.replace(
    /\/\* ── Borders & Shape ──/,
    activityCSSVars + '\n\n  /* ── Borders & Shape ──',
  );

  // Inject activity component CSS before closing </style>
  html = html.replace('</style>', generateActivityCSS() + '\n</style>');

  // 6b. Inject activity engine JS before closing </script>
  html = html.replace('</script>', generateActivityJS() + '\n</script>');

  // 6c. Video player injection (conditional on hasVideo)
  const hasVideo = !options.noVideo;

  if (hasVideo) {
    // Replace the avatar/name/role block with the video player
    html = html.replace(
      /    <div class="lecturer-avatar">.*?<\/div>\s*\n\s*<div class="lecturer-name">.*?<\/div>\s*\n\s*<div class="lecturer-role">.*?<\/div>/s,
      generateVideoPlayerHTML(),
    );

    // Replace the lecturer-dialogue block with the transcript
    html = html.replace(
      /    <div class="lecturer-dialogue" id="lecturer-dialogue">[\s\S]*?<\/div>\s*\n\s*<\/aside>/,
      generateTranscriptHTML() + '\n  </aside>',
    );

    // Inject video player CSS before </style>
    html = html.replace('</style>', generateVideoPlayerCSS() + '\n</style>');

    // Inject video player JS before </script>
    html = html.replace('</script>', generateVideoPlayerJS() + '\n</script>');

    // Hook loadSectionVideo into activateSection
    html = html.replace(
      /function activateSection\(sid\) \{/,
      'function activateSection(sid) {\n  loadSectionVideo(sid);',
    );

    // Remove the lecturer-dialogue update (element no longer exists in video mode)
    html = html.replace(
      /document\.getElementById\('lecturer-dialogue'\)\.innerHTML = section\.lectureScript;/,
      '// lecturer-dialogue replaced by video transcript (see loadSectionVideo)',
    );
  }

  // 6d. Course meta bar (DDD-006)
  const metaBarCSS = `
/* ═══ Course Meta Bar ═══ */
.course-meta-bar { display: flex; gap: 20px; padding: 8px 20px; background: var(--bg-console); border-bottom: 1px solid var(--border); font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-dim); position: fixed; top: 56px; left: 0; right: 0; z-index: 99; }
.meta-item { display: flex; align-items: center; gap: 4px; }
.meta-value { color: var(--text); font-weight: 500; }
`;
  html = html.replace('</style>', metaBarCSS + '\n</style>');

  // Adjust layout offset for meta bar (56px topnav + 32px meta bar = 88px)
  html = html.replace(
    /height: calc\(100vh - 56px\);\s*\n\s*margin-top: 56px;/,
    'height: calc(100vh - 88px);\n  margin-top: 88px;',
  );

  const metaBarHTML = `
<!-- Course Meta Bar -->
<div class="course-meta-bar">
  <span class="meta-item"><span class="meta-value">${courseData.meta.sectionCount} sections</span></span>
  ${courseData.meta.hasVideo ? `<span class="meta-item"><span class="meta-value">${Math.round(courseData.meta.totalVideoDuration / 60)} min video</span></span>` : ''}
  <span class="meta-item"><span class="meta-value">${courseData.meta.totalActivities} activities</span></span>
  <span class="meta-item"><span class="meta-value">${courseData.meta.totalQuestions} questions</span></span>
  <span class="meta-item"><span class="meta-value">~${courseData.meta.estimatedDuration} min</span></span>
</div>`;

  // Inject meta bar after topnav closing tag
  html = html.replace('</nav>\n', '</nav>\n' + metaBarHTML + '\n');

  // 6. Inject generated HTML into template at the correct insertion points

  // Inject sections before the citations section
  html = html.replace(
    /<!-- Generated sections go here\.[\s\S]*?-->/,
    sectionsHTML,
  );

  // Inject nav items into the lecturer nav list
  html = html.replace(
    /<!-- Generated: <li data-section[\s\S]*?-->/,
    navHTML,
  );

  // Inject citation list items (the <ol> already exists in the template)
  // The JS engine populates it at runtime from COURSE_DATA.citations,
  // but we also pre-render the <li> items for no-JS / print fallback.
  if (citationsHTML) {
    html = html.replace(
      /<ol id="citation-list"[^>]*><\/ol>/,
      `<ol id="citation-list" style="font-size:0.88rem;padding-left:20px;">\n${citationsHTML}\n    </ol>`,
    );
  }

  // 7. Fill placeholders
  html = fillPlaceholders(html, {
    title: unifiedOutline.title || 'Untitled Course',
    instructor: courseData.meta.instructor,
    courseData,
  });

  return { html, courseData };
}

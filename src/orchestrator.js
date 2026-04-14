/**
 * orchestrator.js — Top-level pipeline coordinator.
 *
 * Orchestrates Phases 1-9 of the course generation pipeline.
 * When run as a standalone CLI, Phases 2-4 (Brief, Educator Panel, Synthesis)
 * are handled by a built-in synthesizer that constructs a unified outline
 * from the ingested ContentBundle. When invoked inside a Claude agent context,
 * the agent prompt files in src/agents/ are used instead.
 *
 * See: SPARC.md Section 2.1  (Top-Level Orchestration)
 *      ADR-003              (Asynchronous HeyGen Video Pipeline)
 *      ADR-005              (Two-Gate Content Verification)
 */

import fs from 'node:fs';
import path from 'node:path';
import { ingest } from './ingestion/index.js';
import { generateHTML } from './generator/html.js';
import { writeCourseToDisk } from './generator/index.js';
import { HeyGenClient } from './video/heygen.js';
import { VideoCache } from './video/cache.js';
import { awaitAllVideos } from './video/poller.js';

/**
 * Generate a complete course from a source identifier.
 *
 * @param {string} source — GitHub slug, URL, npm/pypi ref, or local path
 * @param {object} options — Parsed CLI options
 * @param {object} config — Resolved configuration from loadConfig()
 * @returns {Promise<object>} result with htmlPath, manifestPath, courseDir
 */
export async function generateCourse(source, options, config) {
  // ── Phase 1: Ingestion ────────────────────────────────────────────────
  console.log('Phase 1: Ingesting source...');
  const content = await ingest(source, config);

  // ── Phase 2: Brief Assembly ───────────────────────────────────────────
  console.log('Phase 2: Assembling brief...');
  const brief = assembleBrief(content, options);

  // ── Phases 3-4: Synthesis ─────────────────────────────────────────────
  // In standalone CLI mode, we synthesize directly from the ContentBundle.
  // In agent mode, the 7 agent prompts in src/agents/ would be used.
  console.log('Phases 3-4: Synthesizing course outline...');
  const outline = synthesizeOutline(content, brief, options, config);

  // ── Determine video mode ──────────────────────────────────────────────
  let useVideo = !options.noVideo;
  if (useVideo && !config.heygen_api_key) {
    console.warn('Warning: HEYGEN_API_KEY not set. Falling back to text-only lecturer.');
    useVideo = false;
    options.noVideo = true;
  }

  // ── Phase 5: HeyGen Video Submission ──────────────────────────────────
  let videoJobs = [];
  if (useVideo) {
    console.log('Phase 5: Submitting HeyGen video jobs...');
    const cache = new VideoCache();
    const client = new HeyGenClient(config.heygen_api_key, config.heygen, cache);
    videoJobs = await Promise.all(
      outline.sections.map(s =>
        client.submitVideo(s.lectureScript || '', s.id, { avatar: options.avatar, voice: options.voice }),
      ),
    );
    const submitted = videoJobs.filter(j => j.status === 'processing').length;
    const cached = videoJobs.filter(j => j.cached).length;
    console.log(`  ${submitted} submitted, ${cached} cached`);
  }

  // ── Phase 6: HTML Generation ──────────────────────────────────────────
  console.log('Phase 6: Generating HTML...');
  const { html: rawHtml, courseData } = await generateHTML(outline, options, config);

  // ── Phase 7: Validation (best-effort in standalone mode) ──────────────
  // The validator runs as a separate CJS script; we skip it here and
  // recommend running it manually: node src/validation/validate-course.cjs

  // ── Phase 8: Video Collection ─────────────────────────────────────────
  let videoManifest = null;
  let finalHtml = rawHtml;

  if (useVideo && videoJobs.some(j => j.status === 'processing')) {
    console.log('Phase 8: Waiting for HeyGen videos...');
    const outputDir = path.resolve(config.output.dir, outline.slug, 'videos');
    const cache = new VideoCache();
    const client = new HeyGenClient(config.heygen_api_key, config.heygen, cache);
    videoJobs = await awaitAllVideos(videoJobs, client, config, outputDir);

    videoManifest = {
      avatar_id: config.heygen.avatar_id,
      voice_id: config.heygen.voice_id,
      generated_at: new Date().toISOString(),
      sections: videoJobs.map(j => ({
        section_id: j.section_id,
        video_id: j.video_id,
        status: j.status,
        local_path: j.local_path || null,
        duration: j.duration || null,
        script_hash: j.script_hash,
      })),
    };

    for (const job of videoJobs) {
      if (job.status === 'completed' && job.local_path) {
        const videoRelPath = `videos/${job.section_id}.mp4`;
        finalHtml = finalHtml.replace(
          new RegExp(`("id":\\s*"${job.section_id}"[^}]*"videoUrl":\\s*)null`, 's'),
          `$1"${videoRelPath}"`,
        );
      }
    }
  }

  // ── Phase 9: Output ───────────────────────────────────────────────────
  console.log('Phase 9: Writing output...');
  const result = await writeCourseToDisk(
    finalHtml, outline.slug, courseData, videoManifest, config,
  );

  const fileSizeKb = Math.round(fs.statSync(result.htmlPath).size / 1024);
  const completedVideos = videoJobs.filter(j => j.status === 'completed').length;
  const failedVideos = videoJobs.filter(j => j.status === 'failed' || j.status === 'timeout').length;

  console.log('');
  console.log(`Course generated: ${result.htmlPath}`);
  console.log(`  Sections: ${courseData.meta.sectionCount}`);
  console.log(`  Quizzes: ${courseData.meta.totalQuestions} questions`);
  console.log(`  Activities: ${courseData.meta.totalActivities}`);
  console.log(`  Glossary: ${courseData.glossary.length} terms`);
  console.log(`  File size: ${fileSizeKb}KB`);
  if (useVideo) {
    console.log(`  Videos: ${completedVideos} completed, ${failedVideos} failed`);
  }
  console.log('');

  return result;
}

// ── Phase 2: Brief Assembly ─────────────────────────────────────────────────

function assembleBrief(content, options) {
  const name = content.package_json?.name || content.source_ref || 'the project';
  const desc = content.package_json?.description || '';
  const langs = content.languages.map(l => l.lang).join(', ') || 'unknown';
  const fileCount = content.key_files.length;
  const entryPoints = content.entry_points.join(', ') || 'none detected';

  const audience = options.audience || 'intermediate';
  const topicType = content.workspace_path ? 'codebase walkthrough' : 'conceptual topic';

  const brief = [
    `This course teaches ${name}${desc ? ': ' + desc : ''}.`,
    `The source is a ${topicType} written primarily in ${langs}.`,
    `${fileCount} key source files were analyzed with entry points at ${entryPoints}.`,
    `The target audience is ${audience}-level developers.`,
    `The course should progress from foundational concepts to practical application.`,
    `Each section should include real code examples from the source material.`,
  ].join(' ');

  return { text: brief, audience, topicType, name, description: desc };
}

// ── Phases 3-4: Synthesis ───────────────────────────────────────────────────

function synthesizeOutline(content, brief, options, config) {
  const slug = slugify(brief.name);
  const maxSections = options.deep ? 12 : options.quick ? 5 : config.course.max_sections;
  const minSections = options.quick ? 3 : config.course.min_sections;

  // Build sections from key files
  const keyFiles = content.key_files.filter(f =>
    !f.path.endsWith('.json') && !f.path.endsWith('.toml') && !f.path.endsWith('.yaml') && !f.path.endsWith('.yml'),
  );

  // Group files into logical sections
  const sectionGroups = groupFilesIntoSections(keyFiles, minSections, maxSections);
  const bloomLevels = ['remember', 'understand', 'apply', 'apply', 'analyze', 'analyze', 'evaluate', 'evaluate', 'create', 'create', 'create', 'create'];

  const sections = sectionGroups.map((group, i) => {
    const id = `s${i + 1}`;
    const title = deriveSectionTitle(group, i);
    const bloom = bloomLevels[Math.min(i, bloomLevels.length - 1)];

    // Build content from file contents
    const contentParagraphs = group.map(f =>
      `<p>The file <code>${f.path}</code> contains key functionality for this section.</p>`,
    ).join('\n');

    // Extract terms from file content
    const terms = extractTerms(group, id);

    // Build code blocks
    const codeBlocks = group.slice(0, 2).map(f => ({
      language: f.language || 'javascript',
      code: truncateCode(f.content, 20),
      filePath: f.path,
    }));

    // Build assessments (unless --no-quizzes)
    const assessments = options.noQuizzes ? [] : buildAssessments(group, bloom, i);

    // Build activities
    const activities = buildActivities(group, bloom, id, i);

    return {
      id,
      title,
      bloomLevel: bloom,
      learningObjectives: [`Understand the role of ${group.map(f => f.path).join(', ')}`],
      estimatedMinutes: Math.max(3, Math.min(8, group.length * 2)),
      prerequisites: i > 0 ? [`s${i}`] : [],
      lectureScript: `<p>In this section, we explore ${title.toLowerCase()}.</p><p>This is a key part of the ${brief.name} architecture.</p>`,
      content: contentParagraphs,
      contentHtml: contentParagraphs,
      analogy: i === 0 ? `Think of ${brief.name} as a well-organized toolbox where each module has a specific purpose.` : null,
      codeBlocks,
      visualization: i % 3 === 0 ? { title: `${title} Overview`, description: `Visual overview of ${title.toLowerCase()}` } : null,
      keyInsight: `Understanding ${title.toLowerCase()} is essential for working with ${brief.name}.`,
      terms,
      assessments,
      activities,
      videoUrl: null,
      videoPoster: null,
      videoDuration: null,
      videoTimestamps: null,
      termCount: terms.length,
      hasVisualization: i % 3 === 0,
      hasCodeBlock: codeBlocks.length > 0,
    };
  });

  // Build glossary from all section terms
  const glossary = [];
  const seenTerms = new Set();
  for (const section of sections) {
    for (const term of section.terms) {
      if (!seenTerms.has(term.term.toLowerCase())) {
        seenTerms.add(term.term.toLowerCase());
        glossary.push({
          ...term,
          firstIntroduced: section.id,
          related: [],
        });
      }
    }
  }

  return {
    title: `Understanding ${brief.name}`,
    slug,
    source: content.source_ref,
    sourceType: content.source_type,
    audience: brief.audience,
    instructor: {
      name: 'Dr. Ada',
      emoji: '🤖',
      role: 'Course Instructor',
      avatarId: null,
      voiceId: null,
    },
    sections,
    glossary,
    citations: [],
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text) {
  return (text || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function groupFilesIntoSections(files, minSections, maxSections) {
  if (files.length === 0) {
    return [[]]; // At least one empty section
  }

  // Group by directory
  const dirGroups = {};
  for (const f of files) {
    const dir = path.dirname(f.path);
    (dirGroups[dir] = dirGroups[dir] || []).push(f);
  }

  let groups = Object.values(dirGroups);

  // Merge tiny groups
  while (groups.length > maxSections) {
    const smallest = groups.reduce((min, g, i) => g.length < groups[min].length ? i : min, 0);
    const target = smallest > 0 ? smallest - 1 : 1;
    if (groups[target]) {
      groups[target] = groups[target].concat(groups[smallest]);
    }
    groups.splice(smallest, 1);
  }

  // Split large groups if we're under minSections
  while (groups.length < minSections && groups.some(g => g.length > 2)) {
    const largest = groups.reduce((max, g, i) => g.length > groups[max].length ? i : max, 0);
    const half = Math.ceil(groups[largest].length / 2);
    const split = groups[largest].splice(half);
    groups.splice(largest + 1, 0, split);
  }

  // Ensure at least minSections
  while (groups.length < minSections) {
    groups.push([]);
  }

  return groups.slice(0, maxSections);
}

function deriveSectionTitle(group, index) {
  if (group.length === 0) return `Section ${index + 1}`;

  // Use the directory name or first file name
  const firstPath = group[0].path;
  const dir = path.dirname(firstPath);

  if (dir !== '.') {
    return dir.split('/').pop()
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  const name = path.basename(firstPath, path.extname(firstPath));
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function extractTerms(files, sectionId) {
  const terms = [];
  const seen = new Set();

  for (const f of files) {
    // Extract exported names as terms
    const exports = f.content.match(/export\s+(?:function|class|const|let|var|default\s+function)\s+(\w+)/g) || [];
    for (const exp of exports) {
      const name = exp.match(/(\w+)$/)?.[1];
      if (name && name.length > 2 && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        terms.push({
          term: name,
          definition: `Exported from ${f.path}`,
          category: exp.includes('class') ? 'architecture' : exp.includes('function') ? 'api' : 'concept',
        });
      }
    }
  }

  return terms.slice(0, 5); // Cap at 5 terms per section
}

function truncateCode(content, maxLines) {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join('\n') + '\n// ... (truncated)';
}

function buildAssessments(files, bloom, sectionIndex) {
  if (files.length === 0) return [];

  const firstFile = files[0];
  const fileName = path.basename(firstFile.path);

  return [{
    type: 'multiple-choice',
    bloom,
    difficulty: Math.min(5, sectionIndex + 1),
    question: `What is the primary purpose of ${fileName}?`,
    options: [
      `It handles core logic for this module`,
      `It provides utility functions only`,
      `It defines the database schema`,
      `It manages external API connections`,
    ],
    correct: 0,
    explanation: `${fileName} contains the primary logic for this part of the codebase.`,
    distractorNotes: ['', 'This file does more than utilities', 'No database schema here', 'Not an API connector'],
  }];
}

function buildActivities(files, bloom, sectionId, sectionIndex) {
  if (files.length === 0) return [];

  const firstFile = files[0];
  const actId = `act-${sectionId}-1`;

  if (bloom === 'remember' || bloom === 'understand') {
    return [{
      id: actId,
      type: 'guided-exploration',
      title: `Explore ${path.basename(firstFile.path)}`,
      description: `Navigate the structure of ${firstFile.path} and identify key exports.`,
      estimatedMinutes: 3,
      bloomLevel: bloom,
      fileTree: [{
        name: path.dirname(firstFile.path) === '.' ? firstFile.path : path.dirname(firstFile.path).split('/')[0],
        type: 'directory',
        children: files.slice(0, 3).map(f => ({
          name: path.basename(f.path),
          type: 'file',
          path: f.path,
          isTarget: f === firstFile,
        })),
      }],
      fileContents: Object.fromEntries(files.slice(0, 3).map(f => [f.path, truncateCode(f.content, 15)])),
      steps: [
        { instruction: `Open ${firstFile.path} and find the main export` },
        { instruction: 'Identify the key function or class defined here' },
      ],
      hints: ['Click on the highlighted file', 'Look for export statements'],
    }];
  }

  return [{
    id: actId,
    type: 'code-exercise',
    title: `Practice with ${path.basename(firstFile.path)}`,
    description: `Write code that uses the patterns from ${firstFile.path}.`,
    estimatedMinutes: 5,
    bloomLevel: bloom,
    language: firstFile.language || 'javascript',
    starterCode: '// Your code here\n',
    solution: truncateCode(firstFile.content, 10),
    expectedPatterns: [
      { type: 'not_contains', value: '// Your code here', hint: 'Replace the placeholder with your implementation' },
    ],
    hints: [`Look at ${firstFile.path} for reference`, 'Start by defining the main function'],
  }];
}

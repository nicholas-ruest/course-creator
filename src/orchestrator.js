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
  let outline;

  // ── Fast path: import pre-generated outline ───────────────────────────
  if (options.fromOutline) {
    console.log(`Importing outline from ${options.fromOutline}...`);
    const raw = fs.readFileSync(path.resolve(options.fromOutline), 'utf-8');
    outline = JSON.parse(raw);
    console.log(`  Loaded: ${outline.title} (${outline.sections.length} sections)`);
  } else {
    // ── Phase 1: Ingestion ──────────────────────────────────────────────
    console.log('Phase 1: Ingesting source...');
    const content = await ingest(source, config);

    // ── Export bundle if requested ──────────────────────────────────────
    if (options.exportBundle) {
      const bundlePath = path.resolve(options.exportBundle);
      fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
      fs.writeFileSync(bundlePath, JSON.stringify(content, null, 2));
      console.log(`\nContentBundle exported to: ${bundlePath}`);
      console.log('Use this with Claude Code agents to generate a real course outline,');
      console.log('then run again with --from-outline <outline.json> to build the course.');
      return { bundlePath };
    }

    // ── Phase 2: Brief Assembly ─────────────────────────────────────────
    console.log('Phase 2: Assembling brief...');
    const brief = assembleBrief(content, options);

    // ── Phases 3-4: Synthesis ───────────────────────────────────────────
    console.log('Phases 3-4: Synthesizing course outline...');
    outline = synthesizeOutline(content, brief, options, config);
  }

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

  // ── Phase 8: Video Collection & Embedding ─────────────────────────────
  let videoManifest = null;
  let finalHtml = rawHtml;

  if (useVideo && videoJobs.length > 0) {
    // Poll for any still-processing jobs
    if (videoJobs.some(j => j.status === 'processing')) {
      console.log('Phase 8: Waiting for HeyGen videos...');
      const outputDir = path.resolve(config.output.dir, outline.slug, 'videos');
      const cache = new VideoCache();
      const client = new HeyGenClient(config.heygen_api_key, config.heygen, cache);
      videoJobs = await awaitAllVideos(videoJobs, client, config, outputDir);
    }

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

    // Embed completed videos as base64 data URIs directly into COURSE_DATA
    console.log('Phase 8b: Embedding videos into HTML...');

    // Extract COURSE_DATA JSON from the HTML, update it, and re-inject
    const cdMatch = finalHtml.match(/const COURSE_DATA = ({[\s\S]*?});\n/);
    if (cdMatch) {
      const courseDataObj = JSON.parse(cdMatch[1]);

      for (const job of videoJobs) {
        if (job.status === 'completed' && job.local_path && fs.existsSync(job.local_path)) {
          const videoBytes = fs.readFileSync(job.local_path);
          const base64 = videoBytes.toString('base64');
          const dataUri = `data:video/mp4;base64,${base64}`;

          const section = courseDataObj.sections.find(s => s.id === job.section_id);
          if (section) {
            section.videoUrl = dataUri;
            if (job.duration) section.videoDuration = job.duration;
          }
          console.log(`  Embedded video for ${job.section_id} (${Math.round(videoBytes.length / 1024)}KB)`);
        }
      }

      // Update hasVideo and totalVideoDuration
      const completedCount = courseDataObj.sections.filter(s => s.videoUrl).length;
      if (completedCount > 0) {
        courseDataObj.meta.hasVideo = true;
        courseDataObj.meta.totalVideoDuration = courseDataObj.sections.reduce(
          (sum, s) => sum + (s.videoDuration || 0), 0,
        );
      }

      finalHtml = finalHtml.replace(cdMatch[0], `const COURSE_DATA = ${JSON.stringify(courseDataObj, null, 2)};\n`);
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

  const audience = options.audience || 'beginner';
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

  // Analyze the codebase to build a conceptual model
  const analysis = analyzeCodebase(content);

  // Build a pedagogically ordered set of topics (not directory-based)
  const topics = buildTopics(analysis, content, brief, minSections, maxSections);
  const bloomLevels = ['remember', 'understand', 'apply', 'apply', 'analyze', 'analyze', 'evaluate', 'evaluate', 'create', 'create', 'create', 'create'];
  const totalSections = topics.length;

  const sections = topics.map((topic, i) => {
    const id = `s${i + 1}`;
    const bloom = bloomLevels[Math.min(i, bloomLevels.length - 1)];

    // Generate narrative content from the actual code
    const narrative = buildNarrative(topic, brief, i, totalSections);

    // Extract real terms with real definitions
    const terms = extractTermsFromTopic(topic);

    // Select the most illustrative code snippets
    const codeBlocks = selectCodeBlocks(topic);

    // Build contextual assessments
    const assessments = options.noQuizzes ? [] : buildAssessments(topic, bloom, i, brief);

    // Build pedagogically aligned activities
    const activities = buildActivities(topic, bloom, id, i, brief);

    // Generate a substantial lecture script for HeyGen (150-300 words)
    const lectureScript = buildLectureScript(topic, brief, i, totalSections);

    // Generate a real analogy
    const analogy = buildAnalogy(topic, brief, i);

    return {
      id,
      title: topic.title,
      bloomLevel: bloom,
      learningObjectives: topic.objectives,
      estimatedMinutes: Math.max(3, Math.min(8, Math.ceil(narrative.length / 500) + 2)),
      prerequisites: i > 0 ? [`s${i}`] : [],
      lectureScript,
      content: narrative,
      contentHtml: narrative,
      analogy,
      codeBlocks,
      visualization: topic.visualizable ? { title: `${topic.title} Overview`, description: topic.vizDescription || `How ${topic.title.toLowerCase()} works` } : null,
      keyInsight: topic.keyInsight,
      terms,
      assessments,
      activities,
      videoUrl: null,
      videoPoster: null,
      videoDuration: null,
      videoTimestamps: null,
      termCount: terms.length,
      hasVisualization: !!topic.visualizable,
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

  // Link related terms
  for (const entry of glossary) {
    entry.related = glossary
      .filter(g => g.term !== entry.term && g.category === entry.category)
      .slice(0, 3)
      .map(g => g.term);
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

// ── Codebase Analysis ──────────────────────────────────────────────────────

/**
 * Analyze the codebase to extract a semantic model: dependency graph,
 * exported APIs, documentation, patterns, and conceptual clusters.
 */
function analyzeCodebase(content) {
  const keyFiles = content.key_files.filter(f =>
    !f.path.endsWith('.json') && !f.path.endsWith('.toml') &&
    !f.path.endsWith('.yaml') && !f.path.endsWith('.yml'),
  );

  // Build import/dependency graph
  const deps = {};
  const reverseDeps = {};
  for (const f of keyFiles) {
    deps[f.path] = [];
    const imports = f.content.match(/(?:import|require)\s*\(?['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]\)?/g) || [];
    for (const imp of imports) {
      const target = imp.match(/['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/)?.[1];
      if (target) {
        const resolved = resolveImport(f.path, target, keyFiles);
        if (resolved) {
          deps[f.path].push(resolved);
          (reverseDeps[resolved] = reverseDeps[resolved] || []).push(f.path);
        }
      }
    }
  }

  // Extract exported symbols with documentation
  const symbols = {};
  for (const f of keyFiles) {
    symbols[f.path] = extractSymbols(f);
  }

  // Find entry points (files with no reverse deps, or explicitly marked)
  const entryPoints = content.entry_points?.length
    ? content.entry_points
    : keyFiles.filter(f => !reverseDeps[f.path] || reverseDeps[f.path].length === 0).map(f => f.path);

  // Extract documentation from docs, README, and inline comments
  const docs = extractDocumentation(content);

  return { keyFiles, deps, reverseDeps, symbols, entryPoints, docs };
}

function resolveImport(fromPath, importPath, keyFiles) {
  const dir = path.dirname(fromPath);
  let resolved = path.posix.normalize(path.posix.join(dir, importPath));
  // Try exact match, then with extensions
  const extensions = ['', '.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (keyFiles.some(f => f.path === candidate)) return candidate;
  }
  return null;
}

function extractSymbols(file) {
  const symbols = [];
  const lines = file.content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const exportMatch = line.match(/export\s+(?:(default)\s+)?(?:function|class|const|let|var)\s+(\w+)/);
    if (exportMatch) {
      const name = exportMatch[2];
      const isDefault = !!exportMatch[1];

      // Look backwards for JSDoc or comments
      let doc = '';
      let j = i - 1;
      const commentLines = [];
      while (j >= 0 && (lines[j].trim().startsWith('*') || lines[j].trim().startsWith('//') || lines[j].trim().startsWith('/**'))) {
        commentLines.unshift(lines[j]);
        if (lines[j].trim().startsWith('/**')) break;
        j--;
      }
      if (commentLines.length > 0) {
        doc = commentLines.join('\n')
          .replace(/\/\*\*|\*\/|\*\s?|\/\/\s?/g, '')
          .replace(/@\w+\s+\{[^}]*\}\s*/g, '')
          .replace(/@\w+\s+/g, '')
          .trim();
      }

      // Detect the kind of symbol from content
      const kind = line.includes('class ') ? 'class' :
        line.includes('function ') ? 'function' : 'const';

      // Extract parameters for functions
      let params = '';
      if (kind === 'function') {
        const paramMatch = file.content.slice(file.content.indexOf(line)).match(/\(([^)]*)\)/);
        if (paramMatch) params = paramMatch[1].trim();
      }

      symbols.push({ name, kind, isDefault, doc, params, line: i + 1 });
    }
  }
  return symbols;
}

function extractDocumentation(content) {
  const docs = {};

  // From README and docs files
  const docFiles = (content.docs || []).concat(
    content.key_files.filter(f =>
      f.path.toLowerCase().includes('readme') || f.path.startsWith('docs/'),
    ),
  );
  for (const f of docFiles) {
    if (f.content) {
      docs[f.path] = f.content;
    }
  }

  // Package description
  if (content.package_json?.description) {
    docs._description = content.package_json.description;
  }

  return docs;
}

// ── Topic Building (Pedagogical Structure) ─────────────────────────────────

/**
 * Build pedagogically ordered topics from the codebase analysis.
 * Topics are organized by conceptual clusters, not directories.
 * Order follows dependency graph: teach foundations first.
 */
function buildTopics(analysis, content, brief, minSections, maxSections) {
  const { keyFiles, deps, reverseDeps, symbols, entryPoints, docs } = analysis;

  if (keyFiles.length === 0) {
    return [createPlaceholderTopic(brief, 0)];
  }

  // Step 1: Cluster files by conceptual role
  const clusters = clusterByRole(keyFiles, deps, reverseDeps, symbols);

  // Step 2: Order clusters by dependency depth (foundations first)
  const ordered = orderByDependencyDepth(clusters, deps);

  // Step 3: Ensure we have an opening hook topic first
  const topics = [];

  // Opening hook: "Why this project exists and what problem it solves"
  topics.push(buildOpeningHook(brief, content, docs, entryPoints, keyFiles));

  // Core topics from clusters
  for (const cluster of ordered) {
    if (topics.length >= maxSections) break;
    topics.push(buildTopicFromCluster(cluster, brief, topics.length, symbols, deps));
  }

  // Closing topic: "Putting it all together"
  if (topics.length < maxSections && topics.length >= 2) {
    topics.push(buildClosingTopic(brief, keyFiles, entryPoints, topics.length));
  }

  // Ensure minimum
  while (topics.length < minSections) {
    topics.push(createPlaceholderTopic(brief, topics.length));
  }

  return topics.slice(0, maxSections);
}

function clusterByRole(files, deps, reverseDeps, symbols) {
  // Identify conceptual roles: utilities, core logic, entry points, config, types, tests
  const roles = {
    entry: [],
    core: [],
    utilities: [],
    types: [],
    config: [],
    other: [],
  };

  for (const f of files) {
    const p = f.path.toLowerCase();
    const symCount = (symbols[f.path] || []).length;
    const depCount = (deps[f.path] || []).length;
    const revDepCount = (reverseDeps[f.path] || []).length;

    if (p.includes('index.') || p.includes('main.') || p.includes('cli.') || p.includes('app.')) {
      roles.entry.push(f);
    } else if (p.includes('util') || p.includes('helper') || p.includes('lib/')) {
      roles.utilities.push(f);
    } else if (p.includes('type') || p.endsWith('.d.ts')) {
      roles.types.push(f);
    } else if (p.includes('config') || p.includes('settings')) {
      roles.config.push(f);
    } else if (revDepCount >= 2 || symCount >= 3) {
      roles.core.push(f);
    } else {
      roles.other.push(f);
    }
  }

  // Build clusters — combine tiny groups with their nearest neighbor
  const clusters = [];
  const minClusterSize = 1;

  // Order: types/config first (foundations), then utilities, then core, then entry, then other
  const orderedRoles = [
    { name: 'Foundation & Configuration', files: [...roles.types, ...roles.config] },
    { name: 'Utility Functions', files: roles.utilities },
    { name: 'Core Modules', files: roles.core },
    { name: 'Entry Points & API', files: roles.entry },
    { name: 'Additional Modules', files: roles.other },
  ];

  for (const role of orderedRoles) {
    if (role.files.length >= minClusterSize) {
      // Sub-cluster large groups by directory
      if (role.files.length > 4) {
        const subGroups = {};
        for (const f of role.files) {
          const dir = path.dirname(f.path);
          (subGroups[dir] = subGroups[dir] || []).push(f);
        }
        for (const [dir, groupFiles] of Object.entries(subGroups)) {
          clusters.push({ role: role.name, dir, files: groupFiles });
        }
      } else {
        clusters.push({ role: role.name, dir: null, files: role.files });
      }
    }
  }

  return clusters;
}

function orderByDependencyDepth(clusters, deps) {
  // Score each cluster by how many of its files are depended on by others
  return clusters.sort((a, b) => {
    const aDepth = a.files.reduce((sum, f) => sum + (deps[f.path] || []).length, 0);
    const bDepth = b.files.reduce((sum, f) => sum + (deps[f.path] || []).length, 0);
    // Files with fewer deps (leaf dependencies) come first — they're foundations
    return aDepth - bDepth;
  });
}

function buildOpeningHook(brief, content, docs, entryPoints, keyFiles) {
  // Analyze what the project does from README, package.json, and entry points
  const readmeContent = Object.values(docs).join('\n').slice(0, 2000);
  const projectPurpose = brief.description || readmeContent.split('\n').slice(0, 5).join(' ').trim();

  // Find the main entry point for a representative code snippet
  const mainEntry = keyFiles.find(f =>
    entryPoints.some(e => f.path.includes(e)),
  ) || keyFiles[0];

  const hookFiles = mainEntry ? [mainEntry] : [];

  return {
    title: `What is ${brief.name}?`,
    files: hookFiles,
    objectives: [
      `Explain what ${brief.name} does and the problem it solves`,
      `Identify the main components of the ${brief.name} architecture`,
    ],
    keyInsight: projectPurpose
      ? `${brief.name} ${projectPurpose.charAt(0).toLowerCase()}${projectPurpose.slice(1).split('.')[0]}.`
      : `${brief.name} provides a focused solution by composing small, well-defined modules.`,
    visualizable: true,
    vizDescription: `High-level architecture showing how ${brief.name}'s main components connect`,
    isHook: true,
    summary: projectPurpose || `${brief.name} is a ${brief.topicType} for ${brief.audience}-level developers.`,
  };
}

function buildTopicFromCluster(cluster, brief, index, symbols, deps) {
  const fileNames = cluster.files.map(f => path.basename(f.path, path.extname(f.path)));
  const primaryFile = cluster.files[0];
  const syms = cluster.files.flatMap(f => (symbols[f.path] || []).map(s => ({ ...s, file: f.path })));

  // Derive a meaningful title from the cluster's content
  let title;
  if (cluster.files.length === 1) {
    title = deriveMeaningfulTitle(primaryFile, syms);
  } else if (cluster.dir && cluster.dir !== '.') {
    title = humanize(cluster.dir.split('/').pop());
  } else {
    title = humanize(fileNames[0]) || cluster.role;
  }

  // Build learning objectives — beginner-friendly, focused on USING not WRITING
  const objectives = [];
  const mainSymbols = syms.slice(0, 3);
  if (mainSymbols.length > 0) {
    objectives.push(`Understand what ${mainSymbols.map(s => s.name).join(', ')} ${mainSymbols.length > 1 ? 'do' : 'does'} and when to use ${mainSymbols.length > 1 ? 'them' : 'it'}`);
  }
  objectives.push(`Know how to integrate ${title.toLowerCase()} into your own projects using Claude Code or Ruflo`);

  // Determine if this cluster represents something visualizable (data flows, class hierarchies)
  const hasMultipleDeps = cluster.files.some(f => (deps[f.path] || []).length >= 2);
  const hasClasses = syms.some(s => s.kind === 'class');

  return {
    title,
    files: cluster.files,
    objectives,
    keyInsight: buildKeyInsight(cluster, syms, brief),
    visualizable: hasMultipleDeps || hasClasses || index % 3 === 0,
    vizDescription: hasClasses
      ? `Class hierarchy and relationships in the ${title.toLowerCase()} module`
      : `Data flow through ${title.toLowerCase()}`,
    isHook: false,
    summary: buildClusterSummary(cluster, syms),
  };
}

function buildClosingTopic(brief, keyFiles, entryPoints, index) {
  const entryFile = keyFiles.find(f =>
    entryPoints.some(e => f.path.includes(e)),
  ) || keyFiles[0];

  return {
    title: 'Putting It All Together',
    files: entryFile ? [entryFile] : [],
    objectives: [
      `Trace a complete request through ${brief.name} from start to finish`,
      `Identify how ${brief.name}'s modules collaborate to deliver functionality`,
    ],
    keyInsight: `${brief.name}'s power comes from how its modules compose together, not from any single component in isolation.`,
    visualizable: true,
    vizDescription: `End-to-end flow showing how all ${brief.name} modules interact`,
    isHook: false,
    summary: `Understand how all parts of ${brief.name} work together as a complete system.`,
  };
}

function createPlaceholderTopic(brief, index) {
  return {
    title: `Section ${index + 1}`,
    files: [],
    objectives: [`Explore additional aspects of ${brief.name}`],
    keyInsight: `${brief.name} is designed with modularity in mind.`,
    visualizable: false,
    vizDescription: null,
    isHook: false,
    summary: `Additional exploration of ${brief.name}.`,
  };
}

// ── Narrative Content Generation ───────────────────────────────────────────

/**
 * Build rich narrative HTML content for a section from topic data.
 * Written for beginners — plain language, no assumed jargon.
 * Focus on what things DO, not just what they ARE.
 */
function buildNarrative(topic, brief, index, totalSections) {
  const parts = [];

  // Opening: transition from previous section or hook
  if (index === 0 && topic.isHook) {
    parts.push(`<p>Let's start by understanding what ${brief.name} is and why someone built it. ${topic.summary}</p>`);
    parts.push(`<p>This course walks through ${brief.name} step by step. We'll start with the basics and build up to the full picture. The goal isn't to memorize code — it's to understand what this project can do for you and how to use it effectively with tools like Claude Code and Ruflo.</p>`);
  } else if (index === totalSections - 1 && topic.title === 'Putting It All Together') {
    parts.push(`<p>Now that we've looked at each part individually, let's see how they all work together. This is the "aha" moment where the individual pieces start making sense as a complete system.</p>`);
    parts.push(`<p>When you want to use ${brief.name} in your own project, you don't need to understand every line of code. You need to understand <em>what it can do</em> and <em>which parts to use</em>. That's exactly what this section is about.</p>`);
  } else {
    const transition = index > 0
      ? `<p>Now let's look at ${topic.title.toLowerCase()} — another important part of ${brief.name}.</p>`
      : '';
    if (transition) parts.push(transition);
  }

  // For each file in the topic, explain what it does using actual content analysis
  for (const file of topic.files.slice(0, 3)) {
    const explanation = explainFile(file, brief);
    parts.push(explanation);
  }

  // If we have files, explain how they relate in simple terms
  if (topic.files.length > 1) {
    const fileNames = topic.files.map(f => `<code>${path.basename(f.path)}</code>`);
    parts.push(`<p>${fileNames.join(' and ')} work together as a team. Think of them like different workers on an assembly line — each one does its specific job, and together they produce the final result.</p>`);
  }

  // Add practical usage guidance
  parts.push(`<p><strong>How to use this:</strong> When you're ready to integrate this into your own project, you can use Claude Code or Ruflo. Just describe what you want to accomplish, point it at this project, and the AI will help you use the right parts correctly. No need to copy-paste code manually.</p>`);

  return parts.join('\n');
}

/**
 * Generate a beginner-friendly explanation of a single file based on its actual content.
 */
function explainFile(file, brief) {
  const fileName = path.basename(file.path);
  const lines = file.content.split('\n');
  const lineCount = lines.length;

  // Extract the file's purpose from its first comment block or JSDoc
  const purpose = extractPurpose(file);

  // Count and describe exports
  const exportMatches = file.content.match(/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+\w+/g) || [];
  const exportNames = exportMatches.map(e => e.match(/(\w+)$/)?.[1]).filter(Boolean);

  // Detect patterns
  const hasAsync = file.content.includes('async ');
  const hasClasses = file.content.includes('class ');
  const importCount = (file.content.match(/^import\s/gm) || []).length;

  const parts = [];

  // Opening explanation — plain language
  if (purpose) {
    parts.push(`<p><strong><code>${file.path}</code></strong> — ${purpose}</p>`);
  } else if (exportNames.length > 0) {
    const namesList = exportNames.map(n => `<code>${n}</code>`).join(', ');
    parts.push(`<p><strong><code>${file.path}</code></strong> provides ${exportNames.length} key feature${exportNames.length > 1 ? 's' : ''}: ${namesList}. ${lineCount < 50 ? 'It\'s small and focused — it does one job and does it well.' : `It's a larger file with ${lineCount} lines, handling a big chunk of what ${brief.name} does.`}</p>`);
  } else {
    parts.push(`<p><strong><code>${file.path}</code></strong> is a ${lineCount}-line file in the ${brief.name} project.${importCount > 0 ? ` It pulls in ${importCount} other part${importCount > 1 ? 's' : ''} of the project to do its work.` : ''}</p>`);
  }

  // Describe what it does in beginner-friendly terms
  const traits = [];
  if (hasAsync) traits.push('handles tasks that take time (like loading data or talking to servers)');
  if (hasClasses) traits.push('organizes related functionality into reusable blueprints');
  if (importCount >= 3) traits.push(`connects to ${importCount} other parts of the project, acting as a coordinator`);
  if (traits.length > 0) {
    parts.push(`<p>What's interesting about this file: it ${traits.join(', and ')}.</p>`);
  }

  return parts.join('\n');
}

/**
 * Extract a purpose description from a file's leading comments or JSDoc.
 */
function extractPurpose(file) {
  const lines = file.content.split('\n');

  // Look for JSDoc or block comment at the top of the file
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i].trim();
    // Skip shebang, 'use strict', empty lines
    if (line === '' || line.startsWith('#!') || line.includes('use strict')) continue;
    // Skip import/require
    if (line.startsWith('import ') || line.startsWith('const ') || line.startsWith('require(')) break;

    // Match JSDoc description line: /** ... */ or * description
    if (line.startsWith('/**') || line.startsWith('*') || line.startsWith('//')) {
      const clean = line
        .replace(/^\/\*\*\s*/, '')
        .replace(/^\*\s*/, '')
        .replace(/^\*\/\s*/, '')
        .replace(/^\/\/\s*/, '')
        .trim();

      // Skip @tags and empty comment lines
      if (clean && !clean.startsWith('@') && !clean.startsWith('*') && clean.length > 10) {
        return clean.endsWith('.') ? clean : clean + '.';
      }
    }
  }
  return null;
}

// ── Lecture Script Generation ──────────────────────────────────────────────

/**
 * Build a substantial lecture script (250-400 words) for HeyGen TTS.
 * Written for beginners — no assumed jargon, focus on practical outcomes.
 * Teaches how to USE the project with tools like Claude Code and Ruflo.
 */
function buildLectureScript(topic, brief, index, totalSections) {
  const parts = [];
  const projectName = brief.name;

  if (index === 0 && topic.isHook) {
    // Opening lecture — welcome, motivation, and overview
    parts.push(`<p>Welcome! In this course, we're going to learn about ${projectName}. Don't worry if you're new to this — we'll take it step by step, and by the end you'll know exactly how to use this project in your own work.</p>`);
    parts.push(`<p>${topic.summary || `${projectName} is a project that solves a real-world problem, and the great news is you don't need to be an expert to start using it.`}</p>`);
    parts.push(`<p>So what exactly is ${projectName}? At its core, it's a collection of files that work together to accomplish a specific goal. Think of it like a recipe — each ingredient has a role, and together they create something useful. We're going to learn what each part does so you can confidently use it in your own projects.</p>`);
    parts.push(`<p>Here's the best part — you don't need to write all this code yourself. Using tools like Claude Code and Ruflo, you can integrate ${projectName} into your workflow by describing what you want in plain language. These AI tools read the code for you and help you use it correctly.</p>`);
    parts.push(`<p>In this first section, we'll get the big picture — what the project does, why it exists, and how the pieces fit together. This mental map will make everything else in the course click into place.</p>`);
    parts.push(`<p>Each section builds on the last, so by the time we reach the end, you'll have a complete understanding of ${projectName} and know exactly how to put it to work. Let's dive in.</p>`);
  } else if (index === totalSections - 1 && topic.title === 'Putting It All Together') {
    // Closing lecture — synthesis and practical next steps
    parts.push(`<p>We've made it to the final section. Let's step back and see how everything we've learned connects together. This is where it all clicks.</p>`);
    parts.push(`<p>Throughout this course, we've looked at the individual parts of ${projectName} — each module, each function, each design choice. But the real power of any project isn't in its individual pieces. It's in how those pieces work together as a system.</p>`);
    parts.push(`<p>Think of it this way. You now understand the ingredients, and you understand the recipe. The next step is actually cooking. And that's easier than you might think.</p>`);
    parts.push(`<p>To start using ${projectName} in your own work, you can use Claude Code or Ruflo to help you integrate it. Just describe what you're trying to build, reference this project, and the AI will help you wire things together correctly. You don't need to memorize every function name — you just need to understand what the project can do, which you now do.</p>`);
    parts.push(`<p>If you run into something unexpected, come back to the relevant section of this course as a reference. The code examples and explanations are designed to be a guide you can return to.</p>`);
    parts.push(`<p>Thank you for completing this course. You now have a solid understanding of ${projectName}. Go build something great with it.</p>`);
  } else {
    // Mid-course lecture — explain the topic accessibly
    const fileNames = topic.files.slice(0, 3).map(f => path.basename(f.path, path.extname(f.path)));
    const fileList = fileNames.length > 0 ? fileNames.join(' and ') : 'this part of the project';

    parts.push(`<p>Alright, let's talk about ${topic.title.toLowerCase()}. ${index <= 2 ? 'This is one of the building blocks' : 'This is an important piece'} of ${projectName}, and understanding it will help everything else make more sense.</p>`);

    if (topic.summary) {
      parts.push(`<p>Here's what this is about in simple terms: ${topic.summary.charAt(0).toLowerCase()}${topic.summary.slice(1)}</p>`);
    }

    if (topic.files.length > 0) {
      parts.push(`<p>We'll be looking at ${fileList}. ${topic.files.length === 1 ? 'This file has a specific job' : 'These files work as a team'} inside the project. Don't worry about memorizing every line — focus on understanding what ${topic.files.length === 1 ? 'it does' : 'they do'} and why ${topic.files.length === 1 ? 'it exists' : 'they exist'}.</p>`);
    }

    // Explain what they'll learn in practical terms
    if (topic.objectives.length > 0) {
      parts.push(`<p>By the end of this section, you'll be able to ${topic.objectives[0].charAt(0).toLowerCase()}${topic.objectives[0].slice(1)}. ${topic.objectives.length > 1 ? `You'll also learn to ${topic.objectives[1].charAt(0).toLowerCase()}${topic.objectives[1].slice(1)}.` : ''} These aren't abstract goals — this is practical knowledge you can use right away.</p>`);
    }

    // Connect to bigger picture and tool usage
    if (index > 0) {
      parts.push(`<p>Remember how we talked about the previous section? This builds directly on that. Each part of ${projectName} is connected, and as you learn more pieces, the whole picture gets clearer.</p>`);
    }

    parts.push(`<p>When you want to use this in your own project, tools like Claude Code and Ruflo can help. You can describe what you need, reference ${projectName}, and the AI will help you integrate it correctly. The knowledge from this section gives you the vocabulary to ask the right questions.</p>`);

    parts.push(`<p>Let's look at how this works in practice.</p>`);
  }

  return parts.join('');
}

// ── Analogy Generation ─────────────────────────────────────────────────────

function buildAnalogy(topic, brief, index) {
  // Generate contextual analogies based on the topic's role
  const title = topic.title.toLowerCase();

  if (topic.isHook) {
    return `Think of ${brief.name} like a factory with specialized workstations. Each module handles one step in the process, and the pieces move along a well-defined path from start to finish.`;
  }

  if (title.includes('util') || title.includes('helper') || title.includes('lib')) {
    return `Utility modules are like a toolbox in a workshop. You don't build the final product with just the toolbox, but every workstation reaches for it when they need a common operation done reliably.`;
  }

  if (title.includes('config') || title.includes('setting')) {
    return `Configuration is like the control panel of a machine. It doesn't do the work itself, but it determines how every other part behaves. Change one dial, and the entire system responds differently.`;
  }

  if (title.includes('type') || title.includes('interface') || title.includes('schema')) {
    return `Type definitions are like a blueprint. They don't build anything on their own, but every module in the codebase references them to ensure the pieces fit together correctly.`;
  }

  if (title.includes('test')) {
    return `Tests are like quality inspectors on a production line. They verify that each module does what it promises, and catch problems before they reach the end user.`;
  }

  if (title === 'putting it all together') {
    return `Understanding the full system is like learning to conduct an orchestra. Each musician (module) is skilled on their own, but the magic happens when you understand how the timing, flow, and interaction between all parts creates the final performance.`;
  }

  // Generic but still useful analogies based on section position
  const analogies = [
    `Think of this module as a translator. It takes input in one form and converts it into something the rest of the system can work with.`,
    `This part of the codebase acts like a traffic controller, directing data to the right destination based on clearly defined rules.`,
    `Consider this module like a postal sorting facility. Items come in, get classified, and are routed to the correct department for processing.`,
    `This is like the nervous system of the application. It carries signals between components, making sure each part knows what the others are doing.`,
  ];

  return analogies[index % analogies.length];
}

// ── Term Extraction ────────────────────────────────────────────────────────

function extractTermsFromTopic(topic) {
  const terms = [];
  const seen = new Set();

  for (const file of topic.files) {
    const syms = extractSymbols(file);
    for (const sym of syms) {
      if (sym.name.length <= 2 || seen.has(sym.name.toLowerCase())) continue;
      seen.add(sym.name.toLowerCase());

      // Build a real definition from JSDoc or infer from name/kind
      let definition;
      if (sym.doc) {
        definition = sym.doc.split('\n')[0].slice(0, 120);
      } else if (sym.kind === 'function') {
        definition = `A function${sym.params ? ` that takes ${describeParams(sym.params)}` : ''} defined in ${file.path}.`;
      } else if (sym.kind === 'class') {
        definition = `A class that encapsulates ${humanize(sym.name).toLowerCase()} behavior.`;
      } else {
        definition = `A ${sym.kind} that provides ${humanize(sym.name).toLowerCase()} functionality.`;
      }

      terms.push({
        term: sym.name,
        definition,
        category: sym.kind === 'class' ? 'architecture' : sym.kind === 'function' ? 'api' : 'concept',
      });
    }
  }

  return terms.slice(0, 5);
}

function describeParams(params) {
  const names = params.split(',').map(p => p.trim().split(/[=:]/)[0].trim()).filter(Boolean);
  if (names.length === 0) return 'no arguments';
  if (names.length === 1) return `a ${names[0]} parameter`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

// ── Code Block Selection ───────────────────────────────────────────────────

function selectCodeBlocks(topic) {
  const blocks = [];

  for (const file of topic.files.slice(0, 2)) {
    // Find the most interesting code to show: the main export or first function
    const snippet = selectBestSnippet(file);
    blocks.push({
      language: file.language || 'javascript',
      code: snippet,
      filePath: file.path,
    });
  }

  return blocks;
}

/**
 * Select the most illustrative code snippet from a file.
 * Prefers: main exported function > first class > first function > first 20 lines.
 */
function selectBestSnippet(file) {
  const lines = file.content.split('\n');

  // Find the first exported function/class and show it in context
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/export\s+(?:default\s+)?(?:function|class)\s+\w+/)) {
      // Find the end of this block (simple brace counting)
      let braceCount = 0;
      let started = false;
      let end = i;
      for (let j = i; j < Math.min(lines.length, i + 30); j++) {
        for (const ch of lines[j]) {
          if (ch === '{') { braceCount++; started = true; }
          if (ch === '}') braceCount--;
        }
        end = j;
        if (started && braceCount <= 0) break;
      }
      const snippet = lines.slice(i, end + 1).join('\n');
      if (snippet.length > 20) return snippet;
    }
  }

  // Fallback: skip imports and show the first meaningful block
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].match(/^(import|const\s.*=\s*require|\/\/|\/\*|\s*\*|\s*$)/)) {
      startLine = i;
      break;
    }
  }

  return lines.slice(startLine, startLine + 20).join('\n') + (lines.length > startLine + 20 ? '\n// ...' : '');
}

// ── Assessment Generation ──────────────────────────────────────────────────

function buildAssessments(topic, bloom, sectionIndex, brief) {
  if (topic.files.length === 0) return [];

  const primaryFile = topic.files[0];
  const fileName = path.basename(primaryFile.path);
  const syms = extractSymbols(primaryFile);
  const mainSymbol = syms[0];

  // Build beginner-friendly questions that test understanding, not memorization
  const assessments = [];

  if (sectionIndex === 0 && topic.isHook) {
    // Intro section: test high-level understanding
    assessments.push({
      type: 'multiple-choice',
      bloom: 'understand',
      difficulty: 1,
      question: `In your own words, what is ${brief.name} designed to do?`,
      options: [
        topic.summary ? topic.summary.split('.')[0] : `It provides ${topic.title.toLowerCase()} functionality`,
        `It is only a collection of test files for other projects`,
        `It is a documentation template with no actual functionality`,
        `It is a configuration file that other projects copy`,
      ],
      correct: 0,
      explanation: `${brief.name} ${brief.description ? brief.description.split('.')[0].toLowerCase() : 'is a project with specific functionality'}. Understanding this big picture helps you know when and how to use it.`,
      distractorNotes: ['', 'It does more than testing', 'It has real functionality', 'It is a standalone project'],
    });
  } else if (mainSymbol) {
    // Questions about specific functionality — beginner-friendly wording
    assessments.push({
      type: 'multiple-choice',
      bloom,
      difficulty: Math.min(3, sectionIndex + 1),
      question: `What does the ${topic.title.toLowerCase()} part of ${brief.name} help you do?`,
      options: buildContextualOptions(mainSymbol, primaryFile, brief),
      correct: 0,
      explanation: mainSymbol.doc
        ? `${mainSymbol.name} ${mainSymbol.doc.split('.')[0].toLowerCase()}. Knowing this helps you decide when to use this part of the project.`
        : `The ${topic.title.toLowerCase()} module handles a specific job in ${brief.name}. When you need this functionality, this is where to look.`,
      distractorNotes: [
        '',
        'This describes a different part of the project',
        'This is a common mix-up',
        'This would be handled elsewhere',
      ],
    });
  } else {
    // Fallback: conceptual understanding question
    assessments.push({
      type: 'multiple-choice',
      bloom,
      difficulty: Math.min(3, sectionIndex + 1),
      question: `Why is the ${topic.title.toLowerCase()} part of ${brief.name} useful?`,
      options: [
        topic.summary ? topic.summary.split('.')[0] : `It handles ${topic.title.toLowerCase()} tasks so you don't have to build them yourself`,
        `It is only used for internal testing and has no external use`,
        `It stores project settings and nothing else`,
        `It is deprecated and should not be used in new projects`,
      ],
      correct: 0,
      explanation: `The ${topic.title.toLowerCase()} module provides useful functionality that you can integrate into your own projects using tools like Claude Code.`,
      distractorNotes: ['', 'It has external uses', 'It does more than settings', 'It is actively maintained'],
    });
  }

  return assessments;
}

function buildContextualOptions(symbol, file, brief) {
  const correctOption = symbol.doc
    ? symbol.doc.split('.')[0]
    : `It ${symbol.kind === 'function' ? 'provides' : 'manages'} ${humanize(symbol.name).toLowerCase()} functionality for your projects`;

  return [
    correctOption,
    `It only works as a logging and debugging tool`,
    `It is used exclusively for storing data in databases`,
    `It handles user login and account management`,
  ];
}

// ── Activity Generation ────────────────────────────────────────────────────
// Activities focus on USING the project via tools like Claude Code and Ruflo,
// NOT on writing code from scratch. Targeted at beginners.

function buildActivities(topic, bloom, sectionId, sectionIndex, brief) {
  if (topic.files.length === 0) return [];

  const primaryFile = topic.files[0];
  const actId = `act-${sectionId}-1`;

  if (bloom === 'remember' || bloom === 'understand') {
    // Guided exploration — navigate the project to understand it
    const steps = [
      { instruction: `Browse to ${primaryFile.path} and read the comments at the top. What does this file do in plain English?` },
      { instruction: `Look at the main features this file provides. You don't need to understand every line — just identify the "big picture" of what it handles.` },
    ];
    if (topic.files.length > 1) {
      steps.push({ instruction: `Now look at ${path.basename(topic.files[1].path)}. How does it relate to the first file? Think of them as teammates — what role does each one play?` });
    } else {
      steps.push({ instruction: `Think about when you'd want to use this in your own project. What problem does it solve for you?` });
    }

    return [{
      id: actId,
      type: 'guided-exploration',
      title: `Understand ${topic.title}`,
      description: `Explore the ${topic.title.toLowerCase()} part of ${brief.name} to understand what it does and when you'd use it in your own projects.`,
      estimatedMinutes: 4,
      bloomLevel: bloom,
      fileTree: [{
        name: path.dirname(primaryFile.path) === '.' ? '.' : path.dirname(primaryFile.path).split('/')[0],
        type: 'directory',
        children: topic.files.slice(0, 4).map((f, i) => ({
          name: path.basename(f.path),
          type: 'file',
          path: f.path,
          isTarget: i === 0,
        })),
      }],
      fileContents: Object.fromEntries(
        topic.files.slice(0, 3).map(f => [f.path, truncateCode(f.content, 25)]),
      ),
      steps,
      hints: [
        'Focus on the comments and names, not every line of code',
        'Ask yourself: "What problem does this solve?"',
        'Think about how you would describe this to a friend',
      ],
    }];
  }

  // For all other Bloom levels — practical integration activity
  const syms = extractSymbols(primaryFile);
  const mainSym = syms.find(s => s.kind === 'function') || syms[0];
  const symName = mainSym ? mainSym.name : topic.title.toLowerCase();

  return [{
    id: actId,
    type: 'guided-exploration',
    title: `Use ${topic.title} in Your Project`,
    description: `Learn how to integrate the ${topic.title.toLowerCase()} functionality from ${brief.name} into your own project using Claude Code or Ruflo.`,
    estimatedMinutes: 5,
    bloomLevel: bloom,
    fileTree: [{
      name: path.dirname(primaryFile.path) === '.' ? '.' : path.dirname(primaryFile.path).split('/')[0],
      type: 'directory',
      children: topic.files.slice(0, 4).map((f, i) => ({
        name: path.basename(f.path),
        type: 'file',
        path: f.path,
        isTarget: i === 0,
      })),
    }],
    fileContents: Object.fromEntries(
      topic.files.slice(0, 3).map(f => [f.path, truncateCode(f.content, 25)]),
    ),
    steps: [
      { instruction: `Review ${primaryFile.path} to understand what ${symName} does. Focus on the inputs it expects and the outputs it produces.` },
      { instruction: `Think of a use case in your own project where you'd need this functionality. For example: "I need to ${mainSym?.doc?.split('.')[0]?.toLowerCase() || 'use ' + topic.title.toLowerCase() + ' features'}."` },
      { instruction: `Using Claude Code or Ruflo, describe your use case and ask it to help you integrate ${brief.name}'s ${topic.title.toLowerCase()} into your project. Reference the file paths you've learned about.` },
    ],
    hints: [
      `You don't need to write the code yourself — that's what Claude Code and Ruflo are for`,
      `The key is knowing WHAT to ask for: "Help me use ${symName} from ${brief.name} to..."`,
      `Reference specific files like ${primaryFile.path} when asking for help — it gives the AI better context`,
    ],
  }];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text) {
  return (text || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function humanize(text) {
  return (text || '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function deriveMeaningfulTitle(file, symbols) {
  // Try to get a title from the file's purpose comment
  const purpose = extractPurpose(file);
  if (purpose && purpose.length < 60) {
    return purpose.replace(/\.$/, '');
  }

  // Use the main symbol name
  if (symbols.length > 0) {
    const main = symbols.find(s => s.isDefault) || symbols[0];
    return humanize(main.name);
  }

  // Fallback to file name
  return humanize(path.basename(file.path, path.extname(file.path)));
}

function buildKeyInsight(cluster, symbols, brief) {
  if (symbols.length > 0) {
    const main = symbols[0];
    if (main.doc) {
      return `${main.name}: ${main.doc.split('.')[0]}.`;
    }
    return `The ${main.name} ${main.kind} is central to how ${brief.name} handles ${humanize(cluster.role).toLowerCase()}.`;
  }
  return `Understanding ${cluster.role.toLowerCase()} is key to working effectively with ${brief.name}.`;
}

function buildClusterSummary(cluster, symbols) {
  const symNames = symbols.slice(0, 3).map(s => s.name);
  if (symNames.length > 0) {
    return `This module exports ${symNames.join(', ')}, which handle ${cluster.role.toLowerCase()} operations.`;
  }
  return `This module provides ${cluster.role.toLowerCase()} functionality.`;
}

function truncateCode(content, maxLines) {
  const lines = content.split('\n');
  if (lines.length <= maxLines) return content;
  return lines.slice(0, maxLines).join('\n') + '\n// ...';
}

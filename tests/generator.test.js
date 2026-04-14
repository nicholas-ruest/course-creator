import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generateHTML } from '../src/generator/html.js';
import { writeCourseToDisk } from '../src/generator/index.js';
import { DEFAULTS } from '../src/config.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const outline = {
  title: 'Understanding Hooks',
  slug: 'understanding-hooks',
  source: 'anthropics/claude-code',
  sourceType: 'github_slug',
  audience: 'intermediate',
  instructor: {
    name: 'Dr. Ada',
    emoji: '🤖',
    role: 'Course Instructor',
    avatarId: null,
    voiceId: null,
  },
  sections: [
    {
      id: 's1',
      title: 'What Are Hooks?',
      bloomLevel: 'understand',
      learningObjectives: ['Explain what hooks are'],
      estimatedMinutes: 5,
      prerequisites: [],
      lectureScript: '<p>Welcome to the hooks section.</p>',
      content: '<p>Hooks let you use state in function components. A Hook is a special function that lets you "hook into" React features.</p>',
      analogy: 'Think of hooks like power outlets — they let you plug into features.',
      codeBlocks: [
        { language: 'javascript', code: 'const [count, setCount] = useState(0);', filePath: 'src/App.js' },
      ],
      visualization: null,
      keyInsight: 'Hooks replace class component lifecycle methods.',
      terms: [
        { term: 'Hook', definition: 'A function that lets you use React features in function components' },
        { term: 'State', definition: 'Data that changes over time and triggers re-renders' },
      ],
      assessments: [{ type: 'multiple-choice', question: 'What is a hook?', options: ['A', 'B', 'C', 'D'], correct: 0, explanation: 'A' }],
      activities: [],
      termCount: 2,
      hasVisualization: false,
      hasCodeBlock: true,
    },
    {
      id: 's2',
      title: 'useEffect Deep Dive',
      bloomLevel: 'apply',
      learningObjectives: ['Use useEffect for side effects'],
      estimatedMinutes: 8,
      prerequisites: ['s1'],
      lectureScript: '<p>Now let us explore useEffect.</p>',
      content: '<p>The useEffect hook handles side effects in your components. Effects run after render.</p>',
      analogy: null,
      codeBlocks: [],
      visualization: {
        title: 'Effect Lifecycle',
        description: 'Shows when effects run relative to renders',
      },
      keyInsight: null,
      terms: [
        { term: 'Effect', definition: 'A side effect like data fetching or DOM manipulation' },
      ],
      assessments: [{ type: 'code-completion', prompt: 'Complete useEffect', starterCode: '// TODO', solution: 'useEffect(() => {}, [])', hints: ['Add deps'] }],
      activities: [],
      termCount: 1,
      hasVisualization: true,
      hasCodeBlock: false,
    },
  ],
  glossary: [
    { term: 'Hook', definition: 'A function that lets you use React features', category: 'concept', firstIntroduced: 's1', related: ['State'] },
    { term: 'State', definition: 'Data that triggers re-renders', category: 'concept', firstIntroduced: 's1', related: ['Hook'] },
    { term: 'Effect', definition: 'A side effect in a component', category: 'concept', firstIntroduced: 's2', related: [] },
  ],
  citations: [
    { id: 'c1', title: 'React Docs: Hooks', url: 'https://react.dev/reference/react', accessed: '2026-04-14', relevance: 'Official hooks reference', sections: ['s1', 's2'] },
  ],
};

const options = {};
const config = { ...DEFAULTS, output: { ...DEFAULTS.output, dir: path.join(os.tmpdir(), `course-gen-test-${Date.now()}`) } };

// Clean up after tests
afterAll(() => {
  try { fs.rmSync(config.output.dir, { recursive: true, force: true }); } catch {}
});

// ── generateHTML ───────────────────────────────────────────────────────────

describe('generateHTML', () => {
  let result;

  it('generates HTML and courseData', async () => {
    result = await generateHTML(outline, options, config);
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('courseData');
    expect(typeof result.html).toBe('string');
  });

  it('output is valid HTML (DOCTYPE and closing tag)', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('</html>');
  });

  it('COURSE_DATA is embedded in the HTML', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('const COURSE_DATA =');
    expect(result.html).toContain('"version": "2.0.0"');
    expect(result.html).toContain('"Understanding Hooks"');
  });

  it('both sections appear with correct data-section attributes', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('data-section="s1"');
    expect(result.html).toContain('data-section="s2"');
  });

  it('section labels show padded index and title', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('01 — What Are Hooks?');
    expect(result.html).toContain('02 — useEffect Deep Dive');
  });

  it('glossary terms are wrapped with .term spans', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('class="term"');
    expect(result.html).toContain('data-term="Hook"');
    expect(result.html).toContain('class="term-tooltip"');
  });

  it('vernacular boxes are present in each section', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    // Count vernacular boxes — should be at least 2 (one per section)
    const matches = result.html.match(/class="vernacular"/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('nav list has correct li items', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('data-section="s1"');
    expect(result.html).toContain('1. What Are Hooks?');
    expect(result.html).toContain('2. useEffect Deep Dive');
  });

  it('citations section is populated', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('cite-c1');
    expect(result.html).toContain('React Docs: Hooks');
    expect(result.html).toContain('https://react.dev/reference/react');
  });

  it('course title is in the page title', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('<title>Understanding Hooks | Agentics Foundation</title>');
  });

  it('instructor name and emoji are injected', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('Dr. Ada');
    expect(result.html).toContain('🤖');
  });

  it('analogy box is rendered for section 1', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('class="analogy"');
    expect(result.html).toContain('power outlets');
  });

  it('code block is rendered with language tag', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('class="code-block"');
    expect(result.html).toContain('class="lang-tag"');
    expect(result.html).toContain('useState');
  });

  it('demo container is rendered for section 2', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('class="demo-container"');
    expect(result.html).toContain('Effect Lifecycle');
    expect(result.html).toContain('viz-s2');
  });

  it('key insight is rendered for section 1', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('class="key-insight"');
    expect(result.html).toContain('Hooks replace class component lifecycle methods');
  });

  it('brand elements are present', async () => {
    if (!result) result = await generateHTML(outline, options, config);
    expect(result.html).toContain('#E25C3D');
    expect(result.html).toContain('IBM Plex Mono');
    expect(result.html).toContain('glossary-btn');
    expect(result.html).toContain('glossary-overlay');
  });
});

// ── writeCourseToDisk ──────────────────────────────────────────────────────

describe('writeCourseToDisk', () => {
  it('writes a single HTML file when no video manifest', async () => {
    const { html, courseData } = await generateHTML(outline, options, config);
    const result = await writeCourseToDisk(html, 'understanding-hooks', courseData, null, config);

    expect(result.htmlPath).toContain('understanding-hooks.html');
    expect(result.manifestPath).toBeNull();
    expect(fs.existsSync(result.htmlPath)).toBe(true);

    const content = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
  });

  it('creates directory structure when video manifest provided', async () => {
    const { html, courseData } = await generateHTML(outline, options, config);
    const videoManifest = { avatar_id: 'test', generated_at: '2026-04-14', sections: [] };
    const result = await writeCourseToDisk(html, 'hooks-with-video', courseData, videoManifest, config);

    expect(result.htmlPath).toContain(path.join('hooks-with-video', 'index.html'));
    expect(result.manifestPath).toContain('manifest.json');
    expect(fs.existsSync(result.htmlPath)).toBe(true);
    expect(fs.existsSync(result.manifestPath)).toBe(true);

    // Videos directory exists
    const videosDir = path.join(path.dirname(result.htmlPath), config.output.video_dir);
    expect(fs.existsSync(videosDir)).toBe(true);

    // Manifest has correct structure
    const manifest = JSON.parse(fs.readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.title).toBe('Understanding Hooks');
    expect(manifest.slug).toBe('understanding-hooks');
    expect(manifest.section_count).toBe(2);
    expect(manifest.file_size_kb).toBeGreaterThan(0);
    expect(manifest.heygen).toEqual(videoManifest);
  });
});

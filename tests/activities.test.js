import { describe, it, expect } from 'vitest';
import {
  generateActivityHTML,
  generateActivityCSS,
  generateActivityJS,
} from '../src/generator/activities.js';
import { generateSectionHTML } from '../src/generator/sections.js';

// ── Fixtures ───────────────────────────────────────────────────────────────

const codeExercise = {
  id: 'act-s1-1',
  type: 'code-exercise',
  title: 'Write a Greeting',
  description: 'Create a function that returns a greeting.',
  estimatedMinutes: 5,
  bloomLevel: 'apply',
  language: 'javascript',
  starterCode: 'function greet(name) {\n  // TODO\n}',
  solution: 'function greet(name) {\n  return "Hello, " + name;\n}',
  expectedPatterns: [
    { type: 'contains', value: 'return', hint: 'Must return a value' },
    { type: 'regex', value: 'Hello', hint: 'Should include Hello' },
  ],
  hints: ['Think about string concatenation', 'Use return keyword', 'return "Hello, " + name'],
};

const guidedExploration = {
  id: 'act-s2-1',
  type: 'guided-exploration',
  title: 'Explore the Router',
  description: 'Navigate the routing module structure.',
  estimatedMinutes: 4,
  bloomLevel: 'understand',
  fileTree: [
    {
      name: 'src', type: 'directory', children: [
        {
          name: 'router', type: 'directory', children: [
            { name: 'index.js', type: 'file', isTarget: true, path: 'src/router/index.js' },
            { name: 'routes.js', type: 'file', path: 'src/router/routes.js' },
          ],
        },
      ],
    },
  ],
  fileContents: { 'src/router/index.js': 'export default function router() {}' },
  steps: [
    { instruction: 'Open src/router/index.js' },
    { instruction: 'Find the main export' },
  ],
  hints: ['Click on index.js', 'Look for export default'],
};

const buildChallenge = {
  id: 'act-s3-1',
  type: 'build-challenge',
  title: 'Build a Validator',
  description: 'Create a validation middleware in 2 steps.',
  estimatedMinutes: 8,
  bloomLevel: 'create',
  language: 'javascript',
  scaffoldCode: '// Step 1: Schema\n// Step 2: Middleware',
  solution: 'const schema = z.object({});\nfunction validate() {}',
  steps: [
    { title: 'Define schema', description: 'Use z.object()', patterns: [{ type: 'regex', value: 'z\\.object' }], fail_msg: 'No schema' },
    { title: 'Add middleware', description: 'Write validate()', patterns: [{ type: 'contains', value: 'function validate' }], fail_msg: 'No middleware' },
  ],
  hints: ['Import zod', 'function validate(req, res, next)'],
};

const debugChallenge = {
  id: 'act-s4-1',
  type: 'debug-challenge',
  title: 'Fix the Fetch Bug',
  description: 'Find and fix 2 bugs in this code.',
  estimatedMinutes: 5,
  bloomLevel: 'analyze',
  language: 'javascript',
  buggyCode: 'const r = await fetch("/api/" + id);\nconst d = r.json();',
  fixedCode: 'const r = await fetch("/api/" + userId);\nconst d = await r.json();',
  bugs: [
    { test_name: 'Variable name', description: 'id -> userId', buggy_pattern: '\\+ id\\b', fixed_pattern: '\\+ userId', hint: 'Check variable names' },
    { test_name: 'Missing await', description: 'r.json() needs await', buggy_pattern: '= r\\.json', fixed_pattern: 'await r\\.json', hint: 'json() is async' },
  ],
  hints: ['Compare variable names', 'Check for missing await'],
};

const architecturePuzzle = {
  id: 'act-s5-1',
  type: 'architecture-puzzle',
  title: 'Request Pipeline Order',
  description: 'Arrange the components in order.',
  estimatedMinutes: 3,
  bloomLevel: 'analyze',
  pieces: ['Router', 'Middleware', 'Handler', 'Ingress'],
  correctOrder: ['Ingress', 'Middleware', 'Router', 'Handler'],
  hints: ['What comes first?', 'Middleware runs before routing'],
};

// ── generateActivityHTML ───────────────────────────────────────────────────

describe('generateActivityHTML — Code Exercise', () => {
  it('renders a code exercise card', () => {
    const html = generateActivityHTML(codeExercise);
    expect(html).toContain('data-activity-type="code-exercise"');
    expect(html).toContain('data-activity-id="act-s1-1"');
    expect(html).toContain('activity-badge--code');
    expect(html).toContain('Code Exercise');
    expect(html).toContain('Write a Greeting');
    expect(html).toContain('~5 min');
  });

  it('has a textarea editor with starter code', () => {
    const html = generateActivityHTML(codeExercise);
    expect(html).toContain('id="editor-act-s1-1"');
    expect(html).toContain('function greet(name)');
    expect(html).toContain('// TODO');
  });

  it('has Check Solution, Hint, and Show Solution buttons', () => {
    const html = generateActivityHTML(codeExercise);
    expect(html).toContain("checkActivity('act-s1-1')");
    expect(html).toContain("showNextHint('act-s1-1')");
    expect(html).toContain("showSolution('act-s1-1')");
  });

  it('has Reset button', () => {
    const html = generateActivityHTML(codeExercise);
    expect(html).toContain("resetActivity('act-s1-1')");
  });

  it('has hints and feedback containers', () => {
    const html = generateActivityHTML(codeExercise);
    expect(html).toContain('id="hints-act-s1-1"');
    expect(html).toContain('id="feedback-act-s1-1"');
  });
});

describe('generateActivityHTML — Guided Exploration', () => {
  it('renders an exploration card', () => {
    const html = generateActivityHTML(guidedExploration);
    expect(html).toContain('data-activity-type="guided-exploration"');
    expect(html).toContain('activity-badge--explore');
    expect(html).toContain('Guided Exploration');
  });

  it('has a file tree with directories and files', () => {
    const html = generateActivityHTML(guidedExploration);
    expect(html).toContain('file-tree-dir');
    expect(html).toContain('src/');
    expect(html).toContain('index.js');
    expect(html).toContain('routes.js');
  });

  it('marks target files', () => {
    const html = generateActivityHTML(guidedExploration);
    expect(html).toContain('file-tree-target');
    expect(html).toContain('file-explore-badge');
  });

  it('has exploration step checkboxes', () => {
    const html = generateActivityHTML(guidedExploration);
    expect(html).toContain('exploration-step');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('Open src/router/index.js');
    expect(html).toContain("checkExplorationProgress('act-s2-1')");
  });

  it('has file preview area', () => {
    const html = generateActivityHTML(guidedExploration);
    expect(html).toContain('id="preview-act-s2-1"');
    expect(html).toContain('file-preview-content');
  });
});

describe('generateActivityHTML — Build Challenge', () => {
  it('renders a build challenge card', () => {
    const html = generateActivityHTML(buildChallenge);
    expect(html).toContain('data-activity-type="build-challenge"');
    expect(html).toContain('activity-badge--build');
    expect(html).toContain('Build Challenge');
  });

  it('has numbered step indicators', () => {
    const html = generateActivityHTML(buildChallenge);
    expect(html).toContain('challenge-step-status');
    expect(html).toContain('step-status-act-s3-1-1');
    expect(html).toContain('step-status-act-s3-1-2');
    expect(html).toContain('Define schema');
    expect(html).toContain('Add middleware');
  });

  it('has Check Current Step button', () => {
    const html = generateActivityHTML(buildChallenge);
    expect(html).toContain("checkBuildStep('act-s3-1')");
  });

  it('has editor with scaffold code', () => {
    const html = generateActivityHTML(buildChallenge);
    expect(html).toContain('id="editor-act-s3-1"');
    expect(html).toContain('Step 1: Schema');
  });
});

describe('generateActivityHTML — Debug Challenge', () => {
  it('renders a debug challenge card', () => {
    const html = generateActivityHTML(debugChallenge);
    expect(html).toContain('data-activity-type="debug-challenge"');
    expect(html).toContain('activity-badge--debug');
    expect(html).toContain('Debug Challenge');
  });

  it('shows bug count badge', () => {
    const html = generateActivityHTML(debugChallenge);
    expect(html).toContain('debug-badge');
    expect(html).toContain('2 bugs to find');
  });

  it('has editor pre-filled with buggy code', () => {
    const html = generateActivityHTML(debugChallenge);
    expect(html).toContain('id="editor-act-s4-1"');
    expect(html).toContain('await fetch');
  });

  it('has Run Tests button', () => {
    const html = generateActivityHTML(debugChallenge);
    expect(html).toContain("checkDebug('act-s4-1')");
  });

  it('has test results container', () => {
    const html = generateActivityHTML(debugChallenge);
    expect(html).toContain('id="tests-act-s4-1"');
  });
});

describe('generateActivityHTML — Architecture Puzzle', () => {
  it('renders a puzzle card', () => {
    const html = generateActivityHTML(architecturePuzzle);
    expect(html).toContain('data-activity-type="architecture-puzzle"');
    expect(html).toContain('activity-badge--puzzle');
    expect(html).toContain('Architecture Puzzle');
  });

  it('has draggable pieces', () => {
    const html = generateActivityHTML(architecturePuzzle);
    expect(html).toContain('puzzle-piece');
    expect(html).toContain('draggable="true"');
    expect(html).toContain('data-piece="Router"');
    expect(html).toContain('data-piece="Middleware"');
    expect(html).toContain('data-piece="Handler"');
    expect(html).toContain('data-piece="Ingress"');
  });

  it('has drop target slots with correct answers', () => {
    const html = generateActivityHTML(architecturePuzzle);
    expect(html).toContain('puzzle-slot');
    expect(html).toContain('data-correct="Ingress"');
    expect(html).toContain('data-correct="Handler"');
    expect(html).toContain('puzzle-slot-label');
    expect(html).toContain('Step 1');
  });

  it('has Check Arrangement and Reset buttons', () => {
    const html = generateActivityHTML(architecturePuzzle);
    expect(html).toContain("checkPuzzle('act-s5-1')");
    expect(html).toContain("resetPuzzle('act-s5-1')");
  });
});

// ── generateActivityCSS ───────────────────────────────────────────────────

describe('generateActivityCSS', () => {
  const css = generateActivityCSS();

  it('contains activity card styles', () => {
    expect(css).toContain('.activity-card');
    expect(css).toContain('.activity-header');
    expect(css).toContain('.activity-badge');
    expect(css).toContain('.activity-title');
    expect(css).toContain('.activity-description');
  });

  it('contains all badge variants', () => {
    expect(css).toContain('.activity-badge--code');
    expect(css).toContain('.activity-badge--explore');
    expect(css).toContain('.activity-badge--build');
    expect(css).toContain('.activity-badge--debug');
    expect(css).toContain('.activity-badge--puzzle');
  });

  it('contains editor styles', () => {
    expect(css).toContain('.activity-editor');
    expect(css).toContain('.editor-toolbar');
    expect(css).toContain('.editor-lang-tag');
    expect(css).toContain('.editor-reset-btn');
    expect(css).toContain('.activity-actions');
  });

  it('contains feedback and hint styles', () => {
    expect(css).toContain('.feedback-item');
    expect(css).toContain('.feedback-item--pass');
    expect(css).toContain('.feedback-item--fail');
    expect(css).toContain('.hint-item');
    expect(css).toContain('.hint-label');
  });

  it('contains file explorer styles', () => {
    expect(css).toContain('.file-explorer');
    expect(css).toContain('.file-tree');
    expect(css).toContain('.file-tree-dir');
    expect(css).toContain('.file-tree-file');
    expect(css).toContain('.file-tree-target');
    expect(css).toContain('.file-preview');
    expect(css).toContain('.exploration-step');
  });

  it('contains build challenge styles', () => {
    expect(css).toContain('.challenge-step');
    expect(css).toContain('.challenge-step-status');
  });

  it('contains debug challenge styles', () => {
    expect(css).toContain('.debug-badge');
    expect(css).toContain('.debug-test-results');
    expect(css).toContain('.test-result');
    expect(css).toContain('.test-result--pass');
    expect(css).toContain('.test-result--fail');
  });

  it('contains puzzle styles', () => {
    expect(css).toContain('.puzzle-pieces');
    expect(css).toContain('.puzzle-piece');
    expect(css).toContain('.puzzle-slot');
    expect(css).toContain('.puzzle-slot.correct');
    expect(css).toContain('.puzzle-slot.incorrect');
    expect(css).toContain('.puzzle-slot-label');
  });
});

// ── generateActivityJS ────────────────────────────────────────────────────

describe('generateActivityJS', () => {
  const js = generateActivityJS();

  it('contains all required function declarations', () => {
    expect(js).toContain('function initActivities()');
    expect(js).toContain('function checkActivity(');
    expect(js).toContain('function checkDebug(');
    expect(js).toContain('function checkBuildStep(');
    expect(js).toContain('function checkExplorationProgress(');
    expect(js).toContain('function checkPuzzle(');
    expect(js).toContain('function showNextHint(');
    expect(js).toContain('function showSolution(');
    expect(js).toContain('function resetActivity(');
    expect(js).toContain('function markActivityComplete(');
  });

  it('contains puzzle-specific functions', () => {
    expect(js).toContain('function resetPuzzle(');
    expect(js).toContain('function exploreFile(');
  });

  it('contains drag-and-drop event listeners', () => {
    expect(js).toContain('dragstart');
    expect(js).toContain('dragover');
    expect(js).toContain('drop');
  });

  it('initializes activities on load', () => {
    expect(js).toContain('initActivities()');
  });

  it('uses ACTIVITY_DATA and COURSE_DATA', () => {
    expect(js).toContain('ACTIVITY_DATA');
    expect(js).toContain('COURSE_DATA');
  });

  it('integrates with localStorage progress', () => {
    expect(js).toContain('progress.activities');
    expect(js).toContain('localStorage.setItem');
    expect(js).toContain('STORAGE_KEY');
  });
});

// ── Section integration ────────────────────────────────────────────────────

describe('Section with embedded activity', () => {
  const section = {
    id: 's1',
    title: 'Hooks',
    content: '<p>Content about hooks.</p>',
    codeBlocks: [{ language: 'javascript', code: 'const x = 1;' }],
    activities: [codeExercise],
    terms: [{ term: 'Hook', definition: 'A function' }],
    keyInsight: 'Hooks are powerful.',
  };

  it('activity card appears between code block and vernacular box', () => {
    const html = generateSectionHTML(section, 0, []);
    const codeBlockPos = html.indexOf('class="code-block"');
    const activityPos = html.indexOf('class="activity-card"');
    const vernacularPos = html.indexOf('class="vernacular"');

    expect(codeBlockPos).toBeGreaterThan(-1);
    expect(activityPos).toBeGreaterThan(-1);
    expect(vernacularPos).toBeGreaterThan(-1);
    expect(activityPos).toBeGreaterThan(codeBlockPos);
    expect(vernacularPos).toBeGreaterThan(activityPos);
  });

  it('key insight appears after vernacular box', () => {
    const html = generateSectionHTML(section, 0, []);
    const vernacularPos = html.indexOf('class="vernacular"');
    const insightPos = html.indexOf('class="key-insight"');
    expect(insightPos).toBeGreaterThan(vernacularPos);
  });
});

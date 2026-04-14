/**
 * activities.js — Activity engine: HTML, CSS, and JS generation.
 *
 * Generates in-browser interactive activities for 5 types:
 *   1. Code Exercise      2. Guided Exploration  3. Build Challenge
 *   4. Debug Challenge    5. Architecture Puzzle
 *
 * See: ADR-008  (In-Browser Activity System with Client-Side Validation)
 *      DDD-002  (Activity Engine Component Design)
 *      DDD-006  (Brand System Extension — activity type colors)
 */

import { escapeHTML } from './template.js';

// ── Badge labels / CSS class suffixes per type ──────────────────────────────

const TYPE_META = {
  'code-exercise':        { label: 'Code Exercise',        badge: 'code' },
  'guided-exploration':   { label: 'Guided Exploration',   badge: 'explore' },
  'build-challenge':      { label: 'Build Challenge',      badge: 'build' },
  'debug-challenge':      { label: 'Debug Challenge',      badge: 'debug' },
  'architecture-puzzle':  { label: 'Architecture Puzzle',  badge: 'puzzle' },
};

// ── HTML generators ─────────────────────────────────────────────────────────

/**
 * Generate the complete HTML for a single activity card.
 *
 * @param {object} activity — activity data from the unified outline
 * @returns {string} HTML string
 */
export function generateActivityHTML(activity) {
  const id = escapeHTML(activity.id);
  const type = activity.type;
  const meta = TYPE_META[type] || { label: type, badge: 'code' };
  const sectionId = id.replace(/^act-(s\d+)-.*/, '$1');
  const time = activity.estimatedMinutes || activity.estimated_time_minutes;

  const parts = [];

  parts.push(`<div class="activity-card" data-section="${escapeHTML(sectionId)}" data-activity-id="${id}" data-activity-type="${escapeHTML(type)}">`);
  parts.push(`  <div class="activity-header">`);
  parts.push(`    <span class="activity-badge activity-badge--${meta.badge}">${meta.label}</span>`);
  if (time) parts.push(`    <span class="activity-time">~${time} min</span>`);
  parts.push(`  </div>`);
  parts.push(`  <h4 class="activity-title">${escapeHTML(activity.title)}</h4>`);
  if (activity.description) {
    parts.push(`  <p class="activity-description">${escapeHTML(activity.description)}</p>`);
  }

  // Type-specific content
  switch (type) {
    case 'code-exercise':
      parts.push(renderCodeExercise(activity, id));
      break;
    case 'guided-exploration':
      parts.push(renderGuidedExploration(activity, id));
      break;
    case 'build-challenge':
      parts.push(renderBuildChallenge(activity, id));
      break;
    case 'debug-challenge':
      parts.push(renderDebugChallenge(activity, id));
      break;
    case 'architecture-puzzle':
      parts.push(renderArchitecturePuzzle(activity, id));
      break;
  }

  // Shared hints and feedback areas
  parts.push(`  <div class="activity-hints" id="hints-${id}"></div>`);
  parts.push(`  <div class="activity-feedback" id="feedback-${id}"></div>`);
  parts.push(`</div>`);

  return parts.join('\n');
}

function renderCodeExercise(act, id) {
  const lang = escapeHTML(act.language || 'javascript');
  const starter = escapeHTML(act.starterCode || act.starter_code || '// Your code here');
  return `  <div class="activity-editor-wrap">
    <div class="editor-toolbar">
      <span class="editor-lang-tag">${lang}</span>
      <button class="editor-reset-btn" onclick="resetActivity('${id}')" aria-label="Reset to starter code">Reset</button>
    </div>
    <textarea class="activity-editor" id="editor-${id}" rows="12" spellcheck="false" aria-label="Code editor for exercise">${starter}</textarea>
    <div class="activity-actions">
      <button class="btn-primary activity-check-btn" onclick="checkActivity('${id}')">Check Solution</button>
      <button class="btn-outline activity-hint-btn" onclick="showNextHint('${id}')">Hint</button>
      <button class="btn-outline activity-solution-btn" onclick="showSolution('${id}')">Show Solution</button>
    </div>
  </div>`;
}

function renderGuidedExploration(act, id) {
  const fileTree = act.fileTree || [];
  const fileContents = act.fileContents || {};
  const steps = act.steps || [];

  const treeHtml = renderFileTreeNodes(fileTree, id);

  const stepsHtml = steps.map((step, i) => {
    const stepNum = i + 1;
    return `    <div class="exploration-step" data-step="${stepNum}">
      <input type="checkbox" id="step-${id}-${stepNum}" onchange="checkExplorationProgress('${id}')">
      <label for="step-${id}-${stepNum}">${escapeHTML(step.instruction || step)}</label>
    </div>`;
  }).join('\n');

  // Store file contents as a data attribute (JSON-encoded)
  const contentsAttr = Object.keys(fileContents).length > 0
    ? ` data-files="${escapeHTML(JSON.stringify(fileContents))}"`
    : '';

  return `  <div class="exploration-container">
    <div class="file-explorer" id="explorer-${id}"${contentsAttr}>
      <div class="file-tree">
${treeHtml}
      </div>
      <div class="file-preview" id="preview-${id}">
        <div class="file-preview-header">
          <span class="file-preview-path" id="preview-path-${id}">Click a file to preview</span>
        </div>
        <pre class="file-preview-content" id="preview-content-${id}"></pre>
      </div>
    </div>
    <div class="exploration-steps">
${stepsHtml}
    </div>
  </div>`;
}

function renderFileTreeNodes(nodes, actId, depth = 0) {
  if (!nodes || nodes.length === 0) {
    return '        <div class="file-tree-file"><span class="file-icon">📄</span> (no files)</div>';
  }
  const indent = '        '.repeat(Math.min(depth + 1, 3));
  return nodes.map(node => {
    if (node.type === 'directory' && node.children) {
      const open = depth === 0 ? ' open' : '';
      const childHtml = renderFileTreeNodes(node.children, actId, depth + 1);
      return `${indent}<details class="file-tree-dir"${open}>
${indent}  <summary><span class="file-icon">📁</span> ${escapeHTML(node.name)}/</summary>
${childHtml}
${indent}</details>`;
    }
    const targetClass = node.isTarget ? ' file-tree-target' : '';
    const badge = node.isTarget ? '\n' + indent + '  <span class="file-explore-badge">Explore</span>' : '';
    const filePath = node.path || node.name;
    return `${indent}<div class="file-tree-file${targetClass}" onclick="exploreFile('${actId}', '${escapeHTML(filePath)}')">
${indent}  <span class="file-icon">📄</span> ${escapeHTML(node.name)}${badge}
${indent}</div>`;
  }).join('\n');
}

function renderBuildChallenge(act, id) {
  const steps = act.steps || [];
  const scaffold = escapeHTML(act.scaffoldCode || act.scaffold_code || act.starterCode || act.starter_code || '// Build your solution here');

  const stepsHtml = steps.map((step, i) => {
    const stepNum = i + 1;
    const active = stepNum === 1 ? ' active' : '';
    return `    <div class="challenge-step" data-step="${stepNum}">
      <div class="challenge-step-status${active}" id="step-status-${id}-${stepNum}">${stepNum}</div>
      <div class="challenge-step-content">
        <strong>Step ${stepNum}: ${escapeHTML(step.title || '')}</strong>
        <p>${escapeHTML(step.description || '')}</p>
      </div>
    </div>`;
  }).join('\n');

  return `  <div class="challenge-container">
    <div class="challenge-steps" id="challenge-steps-${id}">
${stepsHtml}
    </div>
    <div class="activity-editor-wrap">
      <textarea class="activity-editor" id="editor-${id}" rows="18" spellcheck="false">${scaffold}</textarea>
      <div class="activity-actions">
        <button class="btn-primary" onclick="checkBuildStep('${id}')">Check Current Step</button>
        <button class="btn-outline" onclick="showNextHint('${id}')">Hint</button>
      </div>
    </div>
  </div>`;
}

function renderDebugChallenge(act, id) {
  const bugs = act.bugs || [];
  const buggyCode = escapeHTML(act.buggyCode || act.buggy_code || '// Buggy code here');

  return `  <div class="debug-container">
    <div class="debug-scenario">
      <div class="debug-badge">🐛 ${bugs.length} bug${bugs.length !== 1 ? 's' : ''} to find</div>
      ${act.description ? '' : '<p>Find and fix all the bugs in the code below.</p>'}
    </div>
    <div class="activity-editor-wrap">
      <textarea class="activity-editor" id="editor-${id}" rows="14" spellcheck="false">${buggyCode}</textarea>
      <div class="activity-actions">
        <button class="btn-primary" onclick="checkDebug('${id}')">Run Tests</button>
        <button class="btn-outline" onclick="showNextHint('${id}')">Hint</button>
      </div>
    </div>
    <div class="debug-test-results" id="tests-${id}"></div>
  </div>`;
}

function renderArchitecturePuzzle(act, id) {
  const pieces = act.pieces || [];
  const correctOrder = act.correctOrder || [];

  const piecesHtml = pieces.map(p =>
    `    <div class="puzzle-piece" draggable="true" data-piece="${escapeHTML(p)}">${escapeHTML(p)}</div>`
  ).join('\n');

  const slotsHtml = correctOrder.map((correct, i) =>
    `    <div class="puzzle-slot" data-position="${i + 1}" data-correct="${escapeHTML(correct)}">
      <span class="puzzle-slot-label">Step ${i + 1}</span>
    </div>`
  ).join('\n');

  return `  <div class="puzzle-container" id="puzzle-${id}">
    <div class="puzzle-pieces" id="puzzle-pieces-${id}">
${piecesHtml}
    </div>
    <div class="puzzle-slots" id="puzzle-slots-${id}">
${slotsHtml}
    </div>
    <div class="activity-actions">
      <button class="btn-primary" onclick="checkPuzzle('${id}')">Check Arrangement</button>
      <button class="btn-outline" onclick="resetPuzzle('${id}')">Reset</button>
    </div>
  </div>`;
}

// ── CSS ──────────────────────────────────────────────────────────────────────

/**
 * Return the complete activity engine CSS.
 */
export function generateActivityCSS() {
  return `
/* ═══ Activity Cards (shared) ═══ */
.activity-card { background: var(--bg-card); border: 1px solid var(--border); border-left: 4px solid var(--blue); border-radius: 0 var(--radius) var(--radius) 0; padding: 20px 24px; margin: 32px 0; }
.activity-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.activity-badge { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 10px; border-radius: var(--radius-pill); }
.activity-badge--code { background: rgba(59,130,246,0.1); color: var(--blue); }
.activity-badge--explore { background: rgba(34,197,94,0.1); color: var(--green); }
.activity-badge--build { background: rgba(226,92,61,0.1); color: var(--primary); }
.activity-badge--debug { background: rgba(239,68,68,0.1); color: var(--red); }
.activity-badge--puzzle { background: rgba(139,92,246,0.1); color: #8b5cf6; }
.activity-time { font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-dim); }
.activity-title { font-family: var(--font-mono); font-size: 1rem; color: var(--text-bright); margin-bottom: 8px; }
.activity-description { font-size: 0.92rem; color: var(--text); margin-bottom: 16px; }

/* ═══ Code Editor ═══ */
.activity-editor-wrap { margin: 12px 0; }
.editor-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: hsl(0 0% 14%); border-radius: var(--radius-sm) var(--radius-sm) 0 0; border: 1px solid hsl(0 0% 20%); border-bottom: none; }
.editor-lang-tag { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: hsl(0 0% 50%); }
.editor-reset-btn { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-dim); background: transparent; border: 1px solid hsl(0 0% 25%); border-radius: 4px; padding: 2px 8px; cursor: pointer; }
.editor-reset-btn:hover { color: var(--primary); border-color: var(--primary); }
.activity-editor { width: 100%; font-family: var(--font-mono); font-size: 0.82rem; line-height: 1.6; background: var(--bg-code); color: var(--text-code); border: 1px solid hsl(0 0% 20%); border-radius: 0 0 var(--radius-sm) var(--radius-sm); padding: 14px 16px; resize: vertical; tab-size: 2; white-space: pre; overflow-wrap: normal; overflow-x: auto; }
.activity-editor:focus { outline: none; border-color: var(--primary); }
.activity-actions { display: flex; gap: 8px; margin-top: 12px; }

/* ═══ Feedback & Hints ═══ */
.activity-feedback { margin-top: 12px; }
.feedback-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 12px; margin: 4px 0; border-radius: 6px; font-size: 0.85rem; }
.feedback-item--pass { background: rgba(34,197,94,0.08); color: var(--green); }
.feedback-item--fail { background: rgba(239,68,68,0.08); color: var(--red); }
.feedback-icon { flex-shrink: 0; }
.activity-hints { margin-top: 12px; }
.hint-item { padding: 10px 14px; background: rgba(251,191,36,0.06); border: 1px solid rgba(251,191,36,0.15); border-radius: 6px; font-size: 0.85rem; color: var(--text); margin: 6px 0; }
.hint-item .hint-label { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600; color: var(--amber); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }

/* ═══ File Explorer (Guided Exploration) ═══ */
.exploration-container { margin: 12px 0; }
.file-explorer { display: grid; grid-template-columns: 200px 1fr; border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; min-height: 200px; }
.file-tree { background: var(--bg-console); padding: 12px; border-right: 1px solid var(--border); overflow-y: auto; font-family: var(--font-mono); font-size: 0.78rem; }
.file-tree-dir > summary { cursor: pointer; padding: 3px 4px; border-radius: 4px; list-style: none; }
.file-tree-dir > summary:hover { background: var(--primary-dim); }
.file-tree-dir > summary::before { content: '▸ '; }
.file-tree-dir[open] > summary::before { content: '▾ '; }
.file-tree-file { padding: 3px 4px 3px 20px; cursor: pointer; border-radius: 4px; display: flex; align-items: center; gap: 4px; }
.file-tree-file:hover { background: var(--primary-dim); }
.file-tree-target { color: var(--primary); font-weight: 500; }
.file-explore-badge { font-size: 0.6rem; background: var(--primary-dim); color: var(--primary); padding: 1px 6px; border-radius: 4px; margin-left: auto; }
.file-preview { background: var(--bg-code); }
.file-preview-header { padding: 8px 12px; background: hsl(0 0% 14%); border-bottom: 1px solid hsl(0 0% 20%); }
.file-preview-path { font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim); }
.file-preview-content { padding: 12px 16px; font-family: var(--font-mono); font-size: 0.78rem; line-height: 1.6; color: var(--text-code); overflow: auto; max-height: 300px; margin: 0; }
.exploration-steps { margin-top: 16px; }
.exploration-step { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; font-size: 0.88rem; }
.exploration-step input[type="checkbox"] { accent-color: var(--primary); margin-top: 3px; }

/* ═══ Build Challenge ═══ */
.challenge-steps { margin-bottom: 16px; }
.challenge-step { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
.challenge-step:last-child { border-bottom: none; }
.challenge-step-status { width: 28px; height: 28px; border-radius: 50%; background: var(--bg-muted); color: var(--text-dim); display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 0.78rem; font-weight: 600; flex-shrink: 0; }
.challenge-step-status.completed { background: rgba(34,197,94,0.15); color: var(--green); }
.challenge-step-status.active { background: var(--primary-dim); color: var(--primary); border: 2px solid var(--primary); }

/* ═══ Debug Challenge ═══ */
.debug-scenario { margin-bottom: 12px; }
.debug-badge { display: inline-block; font-family: var(--font-mono); font-size: 0.78rem; font-weight: 600; color: var(--red); background: rgba(239,68,68,0.08); padding: 4px 12px; border-radius: var(--radius-pill); margin-bottom: 8px; }
.debug-test-results { margin-top: 12px; }
.test-result { display: flex; gap: 8px; padding: 8px 12px; border-radius: 6px; font-size: 0.82rem; font-family: var(--font-mono); margin: 4px 0; }
.test-result--pass { background: rgba(34,197,94,0.08); color: var(--green); }
.test-result--fail { background: rgba(239,68,68,0.08); color: var(--red); }

/* ═══ Architecture Puzzle ═══ */
.puzzle-pieces { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px; background: var(--bg-console); border: 1px dashed var(--border); border-radius: var(--radius-sm); margin-bottom: 16px; min-height: 50px; }
.puzzle-piece { padding: 8px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; font-family: var(--font-mono); font-size: 0.82rem; cursor: grab; user-select: none; transition: transform 0.1s, box-shadow 0.1s; }
.puzzle-piece:active { cursor: grabbing; transform: scale(1.05); box-shadow: var(--shadow-md); }
.puzzle-piece.dragging { opacity: 0.5; }
.puzzle-slots { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.puzzle-slot { min-width: 140px; min-height: 44px; border: 2px dashed var(--border); border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 8px 12px; position: relative; transition: border-color 0.2s, background 0.2s; }
.puzzle-slot.drag-over { border-color: var(--primary); background: var(--primary-dim); }
.puzzle-slot.filled { border-style: solid; border-color: var(--border); }
.puzzle-slot.correct { border-color: var(--green); background: rgba(34,197,94,0.08); }
.puzzle-slot.incorrect { border-color: var(--red); background: rgba(239,68,68,0.08); }
.puzzle-slot-label { font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-dim); position: absolute; top: -10px; left: 10px; background: var(--bg); padding: 0 4px; }
`;
}

// ── JavaScript ──────────────────────────────────────────────────────────────

/**
 * Return the complete activity engine client-side JavaScript.
 */
export function generateActivityJS() {
  return `
// ═══ ACTIVITY ENGINE ═══

const ACTIVITY_DATA = {};

function initActivities() {
  COURSE_DATA.sections.forEach(function(section) {
    (section.activities || []).forEach(function(act) {
      ACTIVITY_DATA[act.id] = Object.assign({}, act, {
        hintsShown: 0,
        completed: progress.activities ? progress.activities[act.id] || false : false,
        currentStep: 1
      });
    });
  });
}

function checkActivity(actId) {
  var act = ACTIVITY_DATA[actId];
  var editor = document.getElementById('editor-' + actId);
  var feedbackEl = document.getElementById('feedback-' + actId);
  if (!act || !editor) return;
  var userCode = editor.value;
  var results = [];
  var patterns = act.expectedPatterns || [];
  for (var i = 0; i < patterns.length; i++) {
    var pattern = patterns[i];
    var pass = false;
    if (pattern.type === 'contains') pass = userCode.includes(pattern.value);
    else if (pattern.type === 'regex') pass = new RegExp(pattern.value).test(userCode);
    else if (pattern.type === 'not_contains') pass = !userCode.includes(pattern.value);
    results.push({ pass: pass, message: pass ? (pattern.pass_msg || 'Correct!') : (pattern.fail_msg || pattern.hint) });
  }
  feedbackEl.innerHTML = results.map(function(r) {
    return '<div class="feedback-item feedback-item--' + (r.pass ? 'pass' : 'fail') + '"><span class="feedback-icon">' + (r.pass ? '✓' : '✗') + '</span> ' + r.message + '</div>';
  }).join('');
  if (results.every(function(r) { return r.pass; })) markActivityComplete(actId);
}

function checkDebug(actId) {
  var act = ACTIVITY_DATA[actId];
  var editor = document.getElementById('editor-' + actId);
  var resultsEl = document.getElementById('tests-' + actId);
  if (!act || !editor) return;
  var userCode = editor.value;
  var results = [];
  var bugs = act.bugs || [];
  for (var i = 0; i < bugs.length; i++) {
    var bug = bugs[i];
    var bugPresent = new RegExp(bug.buggy_pattern).test(userCode);
    var fixApplied = new RegExp(bug.fixed_pattern).test(userCode);
    results.push({
      pass: !bugPresent && fixApplied,
      name: bug.test_name,
      message: !bugPresent && fixApplied ? 'Fixed: ' + bug.description : bugPresent ? 'Bug still present: ' + bug.hint : 'Fix not recognized: ' + bug.hint
    });
  }
  resultsEl.innerHTML = results.map(function(r) {
    return '<div class="test-result test-result--' + (r.pass ? 'pass' : 'fail') + '">' + (r.pass ? 'PASS' : 'FAIL') + ' ' + r.name + ': ' + r.message + '</div>';
  }).join('');
  if (results.every(function(r) { return r.pass; })) markActivityComplete(actId);
}

function checkBuildStep(actId) {
  var act = ACTIVITY_DATA[actId];
  var editor = document.getElementById('editor-' + actId);
  if (!act || !editor) return;
  var userCode = editor.value;
  var currentStep = act.currentStep || 1;
  var step = (act.steps || [])[currentStep - 1];
  if (!step) return;
  var pass = (step.patterns || []).every(function(p) { return new RegExp(p.value).test(userCode); });
  var statusEl = document.getElementById('step-status-' + actId + '-' + currentStep);
  if (pass) {
    if (statusEl) { statusEl.classList.add('completed'); statusEl.textContent = '✓'; }
    act.currentStep = currentStep + 1;
    if (act.currentStep <= (act.steps || []).length) {
      var nextStatus = document.getElementById('step-status-' + actId + '-' + act.currentStep);
      if (nextStatus) nextStatus.classList.add('active');
    } else {
      markActivityComplete(actId);
    }
  } else {
    showFeedback(actId, [{ pass: false, message: step.fail_msg || 'Step not complete yet' }]);
  }
}

function showFeedback(actId, results) {
  var el = document.getElementById('feedback-' + actId);
  if (!el) return;
  el.innerHTML = results.map(function(r) {
    return '<div class="feedback-item feedback-item--' + (r.pass ? 'pass' : 'fail') + '"><span class="feedback-icon">' + (r.pass ? '✓' : '✗') + '</span> ' + r.message + '</div>';
  }).join('');
}

function checkExplorationProgress(actId) {
  var card = document.querySelector('[data-activity-id="' + actId + '"]');
  if (!card) return;
  var steps = card.querySelectorAll('.exploration-step input');
  var allChecked = Array.from(steps).every(function(s) { return s.checked; });
  if (allChecked) markActivityComplete(actId);
}

function checkPuzzle(actId) {
  var slots = document.querySelectorAll('#puzzle-slots-' + actId + ' .puzzle-slot');
  var allCorrect = true;
  slots.forEach(function(slot) {
    var placed = slot.querySelector('.puzzle-piece');
    var correct = placed && placed.dataset.piece === slot.dataset.correct;
    slot.classList.toggle('correct', !!correct);
    slot.classList.toggle('incorrect', !correct && !!placed);
    if (!correct) allCorrect = false;
  });
  if (allCorrect) markActivityComplete(actId);
}

function resetPuzzle(actId) {
  var piecesContainer = document.getElementById('puzzle-pieces-' + actId);
  var slotsContainer = document.getElementById('puzzle-slots-' + actId);
  if (!piecesContainer || !slotsContainer) return;
  var placed = slotsContainer.querySelectorAll('.puzzle-piece');
  placed.forEach(function(p) { piecesContainer.appendChild(p); });
  slotsContainer.querySelectorAll('.puzzle-slot').forEach(function(s) {
    s.classList.remove('correct', 'incorrect', 'filled');
  });
}

function showNextHint(actId) {
  var act = ACTIVITY_DATA[actId];
  if (!act || !act.hints || act.hintsShown >= act.hints.length) return;
  var hintsEl = document.getElementById('hints-' + actId);
  if (!hintsEl) return;
  var hint = act.hints[act.hintsShown];
  hintsEl.innerHTML += '<div class="hint-item"><div class="hint-label">Hint ' + (act.hintsShown + 1) + '</div>' + hint + '</div>';
  act.hintsShown++;
}

function showSolution(actId) {
  var act = ACTIVITY_DATA[actId];
  var editor = document.getElementById('editor-' + actId);
  if (!act || !editor) return;
  editor.value = act.solution || '';
  markActivityComplete(actId);
}

function resetActivity(actId) {
  var act = ACTIVITY_DATA[actId];
  var editor = document.getElementById('editor-' + actId);
  if (!act || !editor) return;
  editor.value = act.starterCode || act.starter_code || act.buggyCode || act.buggy_code || '';
  act.hintsShown = 0;
  var hintsEl = document.getElementById('hints-' + actId);
  if (hintsEl) hintsEl.innerHTML = '';
  var feedbackEl = document.getElementById('feedback-' + actId);
  if (feedbackEl) feedbackEl.innerHTML = '';
}

function markActivityComplete(actId) {
  var act = ACTIVITY_DATA[actId];
  if (!act || act.completed) return;
  act.completed = true;
  progress.activities = progress.activities || {};
  progress.activities[actId] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  var card = document.querySelector('[data-activity-id="' + actId + '"]');
  if (card) card.style.borderLeftColor = 'var(--green)';
}

function exploreFile(actId, filePath) {
  var explorer = document.getElementById('explorer-' + actId);
  var pathEl = document.getElementById('preview-path-' + actId);
  var contentEl = document.getElementById('preview-content-' + actId);
  if (!explorer || !pathEl || !contentEl) return;
  pathEl.textContent = filePath;
  var files = {};
  try { files = JSON.parse(explorer.dataset.files || '{}'); } catch(e) {}
  contentEl.textContent = files[filePath] || '// File content not available in preview';
}

// Drag-and-drop for puzzle pieces
document.addEventListener('dragstart', function(e) {
  if (e.target.classList.contains('puzzle-piece')) {
    e.dataTransfer.setData('text/plain', e.target.dataset.piece);
    e.target.classList.add('dragging');
  }
});
document.addEventListener('dragend', function(e) {
  if (e.target.classList.contains('puzzle-piece')) e.target.classList.remove('dragging');
});
document.addEventListener('dragover', function(e) {
  if (e.target.classList.contains('puzzle-slot') || e.target.closest('.puzzle-slot')) {
    e.preventDefault();
    (e.target.closest('.puzzle-slot') || e.target).classList.add('drag-over');
  }
});
document.addEventListener('dragleave', function(e) {
  if (e.target.classList.contains('puzzle-slot')) e.target.classList.remove('drag-over');
});
document.addEventListener('drop', function(e) {
  var slot = e.target.closest('.puzzle-slot');
  if (!slot) return;
  e.preventDefault();
  slot.classList.remove('drag-over');
  var pieceId = e.dataTransfer.getData('text/plain');
  var piece = document.querySelector('.puzzle-piece[data-piece="' + pieceId + '"]');
  if (piece) {
    // If slot already has a piece, move it back to pieces container
    var existing = slot.querySelector('.puzzle-piece');
    if (existing) {
      var container = slot.closest('.puzzle-container');
      var piecesArea = container.querySelector('.puzzle-pieces');
      if (piecesArea) piecesArea.appendChild(existing);
    }
    slot.appendChild(piece);
    slot.classList.add('filled');
  }
});

initActivities();
`;
}

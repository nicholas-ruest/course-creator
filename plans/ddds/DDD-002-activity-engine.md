# DDD-002: Activity Engine Component Design

## Overview

This document specifies the detailed design of the five activity types,
their HTML structure, CSS styling, JavaScript validation engine, and
integration with the course data model and progress tracking system.

**Related ADRs**: ADR-008 (activity system design), ADR-002 (7-agent swarm)

## Activity Types and Bloom's Alignment

| Activity Type | Bloom's Levels | When to Use |
|--------------|---------------|-------------|
| Guided Exploration | Remember, Understand | Early sections: familiarize with structure, locate key files |
| Code Exercise | Apply | Mid sections: write code applying learned concepts |
| Debug Challenge | Analyze | Mid-late sections: identify and fix issues |
| Build Challenge | Evaluate, Create | Late sections: synthesize knowledge into larger constructs |
| Architecture Puzzle | Analyze, Evaluate | Any section with system design content |

## HTML Components

### Activity Card (shared wrapper)

```html
<div class="activity-card" data-section="s3" data-activity-id="act-s3-1"
     data-activity-type="code-exercise">
  <div class="activity-header">
    <span class="activity-badge activity-badge--code">Code Exercise</span>
    <span class="activity-time">~5 min</span>
  </div>
  <h4 class="activity-title">Build a Route Handler</h4>
  <p class="activity-description">
    Using what you learned about the router module, create a GET handler
    that returns user data by ID.
  </p>

  <!-- Type-specific content goes here -->

  <div class="activity-hints" id="hints-act-s3-1">
    <!-- Progressive hints revealed on demand -->
  </div>
  <div class="activity-feedback" id="feedback-act-s3-1">
    <!-- Validation results shown here -->
  </div>
</div>
```

### Type 1: Code Exercise

```html
<div class="activity-editor-wrap">
  <div class="editor-toolbar">
    <span class="editor-lang-tag">javascript</span>
    <button class="editor-reset-btn"
            onclick="resetActivity('act-s3-1')"
            aria-label="Reset to starter code">Reset</button>
  </div>
  <textarea class="activity-editor" id="editor-act-s3-1"
            rows="12" spellcheck="false"
            aria-label="Code editor for exercise"
  >function handleGet(req) {
  // Your code here:
  // 1. Get the user ID from req.params
  // 2. Look up the user data
  // 3. Return a Response with the data
}</textarea>
  <div class="activity-actions">
    <button class="btn-primary activity-check-btn"
            onclick="checkActivity('act-s3-1')">
      Check Solution
    </button>
    <button class="btn-outline activity-hint-btn"
            onclick="showNextHint('act-s3-1')">
      Hint
    </button>
    <button class="btn-outline activity-solution-btn"
            onclick="showSolution('act-s3-1')">
      Show Solution
    </button>
  </div>
</div>
```

### Type 2: Guided Exploration

```html
<div class="exploration-container">
  <div class="file-explorer" id="explorer-act-s2-1">
    <div class="file-tree">
      <details class="file-tree-dir" open>
        <summary>
          <span class="file-icon">📁</span> src/
        </summary>
        <details class="file-tree-dir">
          <summary>
            <span class="file-icon">📁</span> router/
          </summary>
          <div class="file-tree-file file-tree-target"
               data-step="1"
               onclick="exploreFile('act-s2-1', 'src/router/index.js')">
            <span class="file-icon">📄</span> index.js
            <span class="file-explore-badge">Explore</span>
          </div>
          <div class="file-tree-file"
               onclick="exploreFile('act-s2-1', 'src/router/routes.js')">
            <span class="file-icon">📄</span> routes.js
          </div>
        </details>
      </details>
    </div>
    <div class="file-preview" id="preview-act-s2-1">
      <div class="file-preview-header">
        <span class="file-preview-path" id="preview-path-act-s2-1">
          Click a file to preview
        </span>
      </div>
      <pre class="file-preview-content" id="preview-content-act-s2-1"></pre>
    </div>
  </div>
  <div class="exploration-steps">
    <div class="exploration-step" data-step="1">
      <input type="checkbox" id="step-act-s2-1-1"
             onchange="checkExplorationProgress('act-s2-1')">
      <label for="step-act-s2-1-1">
        Open <code>src/router/index.js</code> and find the main export
      </label>
    </div>
    <div class="exploration-step" data-step="2">
      <input type="checkbox" id="step-act-s2-1-2"
             onchange="checkExplorationProgress('act-s2-1')">
      <label for="step-act-s2-1-2">
        Identify the three route-matching strategies used
      </label>
    </div>
    <div class="exploration-step" data-step="3">
      <input type="checkbox" id="step-act-s2-1-3"
             onchange="checkExplorationProgress('act-s2-1')">
      <label for="step-act-s2-1-3">
        Find where the fallback handler is registered
      </label>
    </div>
  </div>
</div>
```

### Type 3: Build Challenge

```html
<div class="challenge-container">
  <div class="challenge-steps" id="challenge-steps-act-s7-1">
    <div class="challenge-step" data-step="1">
      <div class="challenge-step-status" id="step-status-act-s7-1-1">1</div>
      <div class="challenge-step-content">
        <strong>Step 1: Define the schema</strong>
        <p>Add a Zod schema for the user input with name (string, 2-50 chars)
           and email (valid email format).</p>
      </div>
    </div>
    <div class="challenge-step" data-step="2">
      <div class="challenge-step-status" id="step-status-act-s7-1-2">2</div>
      <div class="challenge-step-content">
        <strong>Step 2: Add validation middleware</strong>
        <p>Create a middleware function that validates the request body
           against your schema and returns a 400 error with details on failure.</p>
      </div>
    </div>
    <div class="challenge-step" data-step="3">
      <div class="challenge-step-status" id="step-status-act-s7-1-3">3</div>
      <div class="challenge-step-content">
        <strong>Step 3: Wire it up</strong>
        <p>Apply the middleware to the POST /users route.</p>
      </div>
    </div>
  </div>
  <div class="activity-editor-wrap">
    <textarea class="activity-editor" id="editor-act-s7-1"
              rows="18" spellcheck="false">
// Build your solution here:
const z = require('zod');

// Step 1: Define the schema


// Step 2: Validation middleware


// Step 3: Wire it up
app.post('/users', /* your middleware */, createUser);
</textarea>
    <div class="activity-actions">
      <button class="btn-primary" onclick="checkBuildStep('act-s7-1')">
        Check Current Step
      </button>
      <button class="btn-outline" onclick="showNextHint('act-s7-1')">
        Hint
      </button>
    </div>
  </div>
</div>
```

### Type 4: Debug Challenge

```html
<div class="debug-container">
  <div class="debug-scenario">
    <div class="debug-badge">🐛 3 bugs to find</div>
    <p>The following code is supposed to fetch user data and cache it,
       but it has three bugs. Find and fix them all.</p>
  </div>
  <div class="activity-editor-wrap">
    <textarea class="activity-editor" id="editor-act-s5-1"
              rows="14" spellcheck="false">
async function getUserWithCache(userId) {
  const cached = cache.get(userId);
  if (cached) return cached;

  const response = await fetch('/api/users/' + id);  // Bug 1
  const data = response.json();                       // Bug 2
  cache.set(usrId, data, { ttl: 3600 });              // Bug 3
  return data;
}
</textarea>
    <div class="activity-actions">
      <button class="btn-primary" onclick="checkDebug('act-s5-1')">
        Run Tests
      </button>
      <button class="btn-outline" onclick="showNextHint('act-s5-1')">
        Hint
      </button>
    </div>
  </div>
  <div class="debug-test-results" id="tests-act-s5-1">
    <!-- Test results rendered here -->
  </div>
</div>
```

### Type 5: Architecture Puzzle

```html
<div class="puzzle-container" id="puzzle-act-s4-1">
  <p class="puzzle-instruction">
    Drag the components into the correct order to represent the request
    lifecycle in this system.
  </p>
  <div class="puzzle-pieces" id="puzzle-pieces-act-s4-1">
    <!-- Draggable pieces (shuffled) -->
    <div class="puzzle-piece" draggable="true" data-piece="middleware">
      Middleware Chain
    </div>
    <div class="puzzle-piece" draggable="true" data-piece="router">
      Router
    </div>
    <div class="puzzle-piece" draggable="true" data-piece="handler">
      Route Handler
    </div>
    <div class="puzzle-piece" draggable="true" data-piece="ingress">
      HTTP Ingress
    </div>
    <div class="puzzle-piece" draggable="true" data-piece="response">
      Response Serializer
    </div>
  </div>
  <div class="puzzle-slots" id="puzzle-slots-act-s4-1">
    <!-- Drop targets -->
    <div class="puzzle-slot" data-position="1" data-correct="ingress">
      <span class="puzzle-slot-label">Step 1</span>
    </div>
    <div class="puzzle-slot" data-position="2" data-correct="middleware">
      <span class="puzzle-slot-label">Step 2</span>
    </div>
    <div class="puzzle-slot" data-position="3" data-correct="router">
      <span class="puzzle-slot-label">Step 3</span>
    </div>
    <div class="puzzle-slot" data-position="4" data-correct="handler">
      <span class="puzzle-slot-label">Step 4</span>
    </div>
    <div class="puzzle-slot" data-position="5" data-correct="response">
      <span class="puzzle-slot-label">Step 5</span>
    </div>
  </div>
  <div class="activity-actions">
    <button class="btn-primary" onclick="checkPuzzle('act-s4-1')">
      Check Arrangement
    </button>
    <button class="btn-outline" onclick="resetPuzzle('act-s4-1')">
      Reset
    </button>
  </div>
</div>
```

## CSS Specification

```css
/* ═══ Activity Cards (shared) ═══ */
.activity-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-left: 4px solid var(--blue);
  border-radius: 0 var(--radius) var(--radius) 0;
  padding: 20px 24px;
  margin: 32px 0;
}

.activity-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.activity-badge {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
}

.activity-badge--code {
  background: rgba(59, 130, 246, 0.1);
  color: var(--blue);
}
.activity-badge--explore {
  background: rgba(34, 197, 94, 0.1);
  color: var(--green);
}
.activity-badge--build {
  background: rgba(226, 92, 61, 0.1);
  color: var(--primary);
}
.activity-badge--debug {
  background: rgba(239, 68, 68, 0.1);
  color: var(--red);
}
.activity-badge--puzzle {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.activity-time {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-dim);
}

.activity-title {
  font-family: var(--font-mono);
  font-size: 1rem;
  color: var(--text-bright);
  margin-bottom: 8px;
}

.activity-description {
  font-size: 0.92rem;
  color: var(--text);
  margin-bottom: 16px;
}

/* ═══ Code Editor ═══ */
.activity-editor-wrap {
  margin: 12px 0;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: hsl(0 0% 14%);
  border-radius: var(--radius-sm) var(--radius-sm) 0 0;
  border: 1px solid hsl(0 0% 20%);
  border-bottom: none;
}

.editor-lang-tag {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: hsl(0 0% 50%);
}

.editor-reset-btn {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid hsl(0 0% 25%);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
}
.editor-reset-btn:hover { color: var(--primary); border-color: var(--primary); }

.activity-editor {
  width: 100%;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  line-height: 1.6;
  background: var(--bg-code);
  color: var(--text-code);
  border: 1px solid hsl(0 0% 20%);
  border-radius: 0 0 var(--radius-sm) var(--radius-sm);
  padding: 14px 16px;
  resize: vertical;
  tab-size: 2;
  white-space: pre;
  overflow-wrap: normal;
  overflow-x: auto;
}

.activity-editor:focus {
  outline: none;
  border-color: var(--primary);
}

.activity-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

/* ═══ Feedback & Hints ═══ */
.activity-feedback {
  margin-top: 12px;
}

.feedback-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 6px;
  font-size: 0.85rem;
}

.feedback-item--pass {
  background: rgba(34, 197, 94, 0.08);
  color: var(--green);
}

.feedback-item--fail {
  background: rgba(239, 68, 68, 0.08);
  color: var(--red);
}

.feedback-icon { flex-shrink: 0; }

.activity-hints {
  margin-top: 12px;
}

.hint-item {
  padding: 10px 14px;
  background: rgba(251, 191, 36, 0.06);
  border: 1px solid rgba(251, 191, 36, 0.15);
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--text);
  margin: 6px 0;
}

.hint-item .hint-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--amber);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}

/* ═══ File Explorer (Guided Exploration) ═══ */
.exploration-container {
  margin: 12px 0;
}

.file-explorer {
  display: grid;
  grid-template-columns: 200px 1fr;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  min-height: 200px;
}

.file-tree {
  background: var(--bg-console);
  padding: 12px;
  border-right: 1px solid var(--border);
  overflow-y: auto;
  font-family: var(--font-mono);
  font-size: 0.78rem;
}

.file-tree-dir > summary {
  cursor: pointer;
  padding: 3px 4px;
  border-radius: 4px;
  list-style: none;
}

.file-tree-dir > summary:hover { background: var(--primary-dim); }
.file-tree-dir > summary::before { content: '▸ '; }
.file-tree-dir[open] > summary::before { content: '▾ '; }

.file-tree-file {
  padding: 3px 4px 3px 20px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.file-tree-file:hover { background: var(--primary-dim); }

.file-tree-target {
  color: var(--primary);
  font-weight: 500;
}

.file-explore-badge {
  font-size: 0.6rem;
  background: var(--primary-dim);
  color: var(--primary);
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: auto;
}

.file-preview {
  background: var(--bg-code);
}

.file-preview-header {
  padding: 8px 12px;
  background: hsl(0 0% 14%);
  border-bottom: 1px solid hsl(0 0% 20%);
}

.file-preview-path {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-dim);
}

.file-preview-content {
  padding: 12px 16px;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  line-height: 1.6;
  color: var(--text-code);
  overflow: auto;
  max-height: 300px;
  margin: 0;
}

.exploration-steps {
  margin-top: 16px;
}

.exploration-step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  font-size: 0.88rem;
}

.exploration-step input[type="checkbox"] {
  accent-color: var(--primary);
  margin-top: 3px;
}

/* ═══ Build Challenge ═══ */
.challenge-steps {
  margin-bottom: 16px;
}

.challenge-step {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
}

.challenge-step:last-child { border-bottom: none; }

.challenge-step-status {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-muted);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 600;
  flex-shrink: 0;
}

.challenge-step-status.completed {
  background: rgba(34, 197, 94, 0.15);
  color: var(--green);
}

.challenge-step-status.active {
  background: var(--primary-dim);
  color: var(--primary);
  border: 2px solid var(--primary);
}

/* ═══ Debug Challenge ═══ */
.debug-scenario {
  margin-bottom: 12px;
}

.debug-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--red);
  background: rgba(239, 68, 68, 0.08);
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  margin-bottom: 8px;
}

.debug-test-results {
  margin-top: 12px;
}

.test-result {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.82rem;
  font-family: var(--font-mono);
  margin: 4px 0;
}

.test-result--pass { background: rgba(34, 197, 94, 0.08); color: var(--green); }
.test-result--fail { background: rgba(239, 68, 68, 0.08); color: var(--red); }

/* ═══ Architecture Puzzle ═══ */
.puzzle-pieces {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 16px;
  background: var(--bg-console);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  margin-bottom: 16px;
  min-height: 50px;
}

.puzzle-piece {
  padding: 8px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  cursor: grab;
  user-select: none;
  transition: transform 0.1s, box-shadow 0.1s;
}

.puzzle-piece:active { cursor: grabbing; transform: scale(1.05); box-shadow: var(--shadow-md); }
.puzzle-piece.dragging { opacity: 0.5; }

.puzzle-slots {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.puzzle-slot {
  min-width: 140px;
  min-height: 44px;
  border: 2px dashed var(--border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  position: relative;
  transition: border-color 0.2s, background 0.2s;
}

.puzzle-slot.drag-over {
  border-color: var(--primary);
  background: var(--primary-dim);
}

.puzzle-slot.filled {
  border-style: solid;
  border-color: var(--border);
}

.puzzle-slot.correct {
  border-color: var(--green);
  background: rgba(34, 197, 94, 0.08);
}

.puzzle-slot.incorrect {
  border-color: var(--red);
  background: rgba(239, 68, 68, 0.08);
}

.puzzle-slot-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-dim);
  position: absolute;
  top: -10px;
  left: 10px;
  background: var(--bg);
  padding: 0 4px;
}
```

## JavaScript: Activity Engine

```javascript
// ═══ ACTIVITY ENGINE ═══

const ACTIVITY_DATA = {}; // Populated from COURSE_DATA.sections[n].activities

// ── Initialize activities from COURSE_DATA ──
function initActivities() {
  COURSE_DATA.sections.forEach(section => {
    (section.activities || []).forEach(act => {
      ACTIVITY_DATA[act.id] = {
        ...act,
        hintsShown: 0,
        completed: progress.activities?.[act.id] || false
      };
    });
  });
}

// ── Code Exercise: Check Solution ──
function checkActivity(actId) {
  const act = ACTIVITY_DATA[actId];
  const editor = document.getElementById('editor-' + actId);
  const feedbackEl = document.getElementById('feedback-' + actId);
  if (!act || !editor) return;

  const userCode = editor.value;
  const results = [];

  for (const pattern of act.expectedPatterns) {
    let pass = false;
    if (pattern.type === 'contains') pass = userCode.includes(pattern.value);
    else if (pattern.type === 'regex') pass = new RegExp(pattern.value).test(userCode);
    else if (pattern.type === 'not_contains') pass = !userCode.includes(pattern.value);

    results.push({
      pass,
      message: pass ? (pattern.pass_msg || 'Correct!') : (pattern.fail_msg || pattern.hint)
    });
  }

  const allPass = results.every(r => r.pass);
  feedbackEl.innerHTML = results.map(r =>
    '<div class="feedback-item feedback-item--' + (r.pass ? 'pass' : 'fail') + '">' +
    '<span class="feedback-icon">' + (r.pass ? '✓' : '✗') + '</span> ' +
    r.message + '</div>'
  ).join('');

  if (allPass) {
    markActivityComplete(actId);
  }
}

// ── Debug Challenge: Run Tests ──
function checkDebug(actId) {
  const act = ACTIVITY_DATA[actId];
  const editor = document.getElementById('editor-' + actId);
  const resultsEl = document.getElementById('tests-' + actId);
  if (!act || !editor) return;

  const userCode = editor.value;
  const results = [];

  for (const bug of act.bugs) {
    const bugPresent = new RegExp(bug.buggy_pattern).test(userCode);
    const fixApplied = new RegExp(bug.fixed_pattern).test(userCode);

    results.push({
      pass: !bugPresent && fixApplied,
      name: bug.test_name,
      message: !bugPresent && fixApplied
        ? 'Fixed: ' + bug.description
        : bugPresent
          ? 'Bug still present: ' + bug.hint
          : 'Fix not recognized: ' + bug.hint
    });
  }

  const allPass = results.every(r => r.pass);
  resultsEl.innerHTML = results.map(r =>
    '<div class="test-result test-result--' + (r.pass ? 'pass' : 'fail') + '">' +
    (r.pass ? 'PASS' : 'FAIL') + ' ' + r.name + ': ' + r.message + '</div>'
  ).join('');

  if (allPass) markActivityComplete(actId);
}

// ── Build Challenge: Check Current Step ──
function checkBuildStep(actId) {
  const act = ACTIVITY_DATA[actId];
  const editor = document.getElementById('editor-' + actId);
  if (!act || !editor) return;

  const userCode = editor.value;
  const currentStep = act.currentStep || 1;
  const step = act.steps[currentStep - 1];
  if (!step) return;

  const pass = step.patterns.every(p => new RegExp(p.value).test(userCode));
  const statusEl = document.getElementById('step-status-' + actId + '-' + currentStep);

  if (pass) {
    statusEl.classList.add('completed');
    statusEl.textContent = '✓';
    act.currentStep = currentStep + 1;

    if (act.currentStep <= act.steps.length) {
      const nextStatus = document.getElementById('step-status-' + actId + '-' + act.currentStep);
      nextStatus?.classList.add('active');
    } else {
      markActivityComplete(actId);
    }
  } else {
    showFeedback(actId, [{ pass: false, message: step.fail_msg || 'Step not complete yet' }]);
  }
}

// ── Guided Exploration: Track Progress ──
function checkExplorationProgress(actId) {
  const act = ACTIVITY_DATA[actId];
  if (!act) return;

  const steps = document.querySelectorAll(
    '[data-activity-id="' + actId + '"] .exploration-step input'
  );
  const allChecked = Array.from(steps).every(s => s.checked);
  if (allChecked) markActivityComplete(actId);
}

// ── Architecture Puzzle ──
function checkPuzzle(actId) {
  const slots = document.querySelectorAll('#puzzle-slots-' + actId + ' .puzzle-slot');
  let allCorrect = true;

  slots.forEach(slot => {
    const placed = slot.querySelector('.puzzle-piece');
    const correct = placed?.dataset.piece === slot.dataset.correct;
    slot.classList.toggle('correct', correct);
    slot.classList.toggle('incorrect', !correct && placed);
    if (!correct) allCorrect = false;
  });

  if (allCorrect) markActivityComplete(actId);
}

// ── Shared: Hints ──
function showNextHint(actId) {
  const act = ACTIVITY_DATA[actId];
  if (!act || !act.hints || act.hintsShown >= act.hints.length) return;

  const hintsEl = document.getElementById('hints-' + actId);
  const hint = act.hints[act.hintsShown];
  hintsEl.innerHTML += '<div class="hint-item"><div class="hint-label">Hint ' +
    (act.hintsShown + 1) + '</div>' + hint + '</div>';
  act.hintsShown++;
}

// ── Shared: Show Solution ──
function showSolution(actId) {
  const act = ACTIVITY_DATA[actId];
  const editor = document.getElementById('editor-' + actId);
  if (!act || !editor) return;
  editor.value = act.solution;
  markActivityComplete(actId);
}

// ── Shared: Reset ──
function resetActivity(actId) {
  const act = ACTIVITY_DATA[actId];
  const editor = document.getElementById('editor-' + actId);
  if (!act || !editor) return;
  editor.value = act.starter_code || act.buggy_code || '';
  act.hintsShown = 0;
  document.getElementById('hints-' + actId).innerHTML = '';
  document.getElementById('feedback-' + actId).innerHTML = '';
}

// ── Shared: Progress Tracking ──
function markActivityComplete(actId) {
  const act = ACTIVITY_DATA[actId];
  if (!act || act.completed) return;
  act.completed = true;
  progress.activities = progress.activities || {};
  progress.activities[actId] = true;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));

  const card = document.querySelector('[data-activity-id="' + actId + '"]');
  if (card) card.style.borderLeftColor = 'var(--green)';
}

// Initialize on load
initActivities();
```

## COURSE_DATA Schema Extension

```javascript
// Per-section activity array:
sections: [{
  id: "s3",
  // ...existing fields...
  activities: [{
    id: "act-s3-1",
    type: "code-exercise",
    title: "Build a Route Handler",
    description: "...",
    estimated_time_minutes: 5,
    bloom_level: "apply",
    starter_code: "function handleGet(req) {\n  // TODO\n}",
    solution: "function handleGet(req) {\n  ...\n}",
    expectedPatterns: [
      { type: "contains", value: "return Response", hint: "...", pass_msg: "...", fail_msg: "..." }
    ],
    hints: ["Hint 1", "Hint 2", "Hint 3"]
  }]
}]
```

## Progress Tracking Extension

The existing localStorage progress object is extended:

```javascript
{
  answers: { "s1-q0": 2, ... },    // Existing quiz answers
  score: 5,                         // Existing quiz score
  activities: {                      // NEW
    "act-s3-1": true,               // completed
    "act-s5-1": true
  }
}
```

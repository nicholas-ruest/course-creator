# ADR-008: In-Browser Activity System with Client-Side Validation

## Status

Accepted

## Date

2026-04-13

## Context

The existing course skill includes quizzes (multiple-choice, code-completion,
concept-matching) but no hands-on activities. Modern e-learning research shows
that active practice produces significantly better retention than passive
reading or even quiz-taking. The system needs a richer activity model.

Key constraint: courses are self-contained HTML files with no backend. All
activity logic must run client-side in the browser.

We considered three approaches:

1. **External sandbox links**: Activities link out to CodeSandbox, StackBlitz,
   or Repl.it with pre-configured exercises.
2. **Embedded WebAssembly runtime**: Bundle a language runtime (e.g., Pyodide
   for Python, QuickJS for JavaScript) and execute user code in-browser.
3. **Client-side validation with pattern matching**: Provide an in-page code
   editor (textarea) with validation logic that checks the user's solution
   against expected patterns, outputs, or structural criteria using JavaScript
   string matching and regex.

## Decision

We will use **Option 3: Client-side validation with pattern matching** for MVP,
with Option 2 as a future enhancement.

Five activity types are supported:

| Type | UI Component | Validation Method |
|------|-------------|-------------------|
| Code Exercise | Textarea editor with syntax highlighting via CSS | Regex/string match against expected patterns and output |
| Guided Exploration | Interactive file tree (expandable `<details>` elements) | Checklist completion tracking |
| Build Challenge | Multi-step checklist with textarea editor | Step-by-step regex validation |
| Architecture Puzzle | SVG-based drag-and-drop containers | Position comparison against correct arrangement |
| Debug Challenge | Textarea with pre-filled buggy code | Diff against corrected version |

## Rationale

**Option 1 rejected** because it breaks the self-contained model. External
links require internet access, may rot over time (sandbox URLs expire), and
fragment the learning experience across multiple browser tabs. The user
experience of "click a link, wait for a sandbox to load, write code, come
back to the course" is poor.

**Option 2 rejected for MVP** because bundling a WebAssembly runtime adds
significant file size (Pyodide is ~20MB, QuickJS is ~500KB) and complexity.
It is the right long-term solution for true code execution, but premature
for the first version. It is explicitly listed as a future enhancement
(DDD-002 and SPARC Section 5.5).

**Option 3** is pragmatic: it runs entirely client-side with zero dependencies,
adds minimal file size (JavaScript validation functions), and provides a
meaningful interactive experience. The validation is not as rigorous as actual
code execution, but it catches the most common patterns and provides useful
feedback.

## Activity Placement in Course Structure

Activities are placed inline within sections, after the main content and
code examples, and before the vernacular terminology box:

```html
<div class="section" data-section="s3">
  <div class="section-label">03 -- Building Routes</div>
  <h2>Building Routes</h2>
  <p>Content explanation...</p>
  <div class="code-block">...</div>

  <!-- Activity goes here -->
  <div class="activity-card" data-activity-type="code-exercise">
    ...
  </div>

  <div class="vernacular">...</div>
  <div class="key-insight">...</div>
</div>
```

This placement ensures the student reads the explanation and sees the code
before attempting the practice exercise, and the vernacular box serves as a
summary after both content and practice.

## Validation Examples

### Code Exercise Validation

```javascript
function validateCodeExercise(activityId, userCode, expectedPatterns) {
  const results = [];

  for (const pattern of expectedPatterns) {
    if (pattern.type === "contains") {
      results.push({
        pass: userCode.includes(pattern.value),
        message: pattern.pass_msg || "Correct!",
        fail_message: pattern.fail_msg || "Expected to find: " + pattern.hint
      });
    } else if (pattern.type === "regex") {
      results.push({
        pass: new RegExp(pattern.value).test(userCode),
        message: pattern.pass_msg || "Pattern matched!",
        fail_message: pattern.fail_msg || "Check: " + pattern.hint
      });
    } else if (pattern.type === "not_contains") {
      results.push({
        pass: !userCode.includes(pattern.value),
        message: pattern.pass_msg || "Good - avoided the anti-pattern",
        fail_message: pattern.fail_msg || "Should not contain: " + pattern.hint
      });
    }
  }

  return results;
}
```

### Debug Challenge Validation

```javascript
function validateDebugChallenge(activityId, userCode, bugs) {
  const results = [];

  for (const bug of bugs) {
    const bugStillPresent = new RegExp(bug.buggy_pattern).test(userCode);
    const fixApplied = new RegExp(bug.fixed_pattern).test(userCode);

    results.push({
      pass: !bugStillPresent && fixApplied,
      message: "Bug fixed: " + bug.description,
      fail_message: bugStillPresent
        ? "Bug still present: " + bug.hint
        : "Fix doesn't match expected pattern: " + bug.hint
    });
  }

  return results;
}
```

## Consequences

### Positive

- Zero external dependencies: activities work offline, in any browser
- Minimal file size impact: validation JS is <5KB per activity
- Immediate feedback: no network round-trip for validation
- Graceful degradation: if JS fails, the code editor still works as a
  plain textarea for manual practice

### Negative

- Validation is approximate, not authoritative: regex matching can produce
  false positives (correct pattern but wrong logic) and false negatives
  (correct solution with unexpected formatting)
- No actual code execution: students cannot "Run" their code and see output
- Architecture Puzzle requires SVG drag-and-drop, which is the most complex
  activity type to implement and may have mobile usability issues

### Mitigations

- Validation messages are educational, not binary: "Your code includes the
  right function call but check the argument order" rather than just "Wrong"
- The hint system provides progressive guidance: Hint 1 is vague, Hint 2 is
  specific, Hint 3 gives away most of the answer
- Mobile fallback for Architecture Puzzle: degrade to a multiple-choice
  "which arrangement is correct?" question
- Future WebAssembly integration (Option 2) can be added without changing the
  activity HTML structure -- only the validation function changes

## Activity Data Model

```javascript
// In COURSE_DATA.sections[n].activities[]
{
  id: "act-s3-1",
  type: "code-exercise",        // enum
  title: "Build a Route Handler",
  description: "Create a GET route...",
  estimated_time_minutes: 5,
  bloom_level: "apply",

  // Type-specific fields
  starter_code: "function handleGet(req) {\n  // TODO\n}",
  expected_patterns: [
    { type: "contains", value: "return Response", hint: "Return a Response object" },
    { type: "regex", value: "status:\\s*200", hint: "Set status to 200" }
  ],
  hints: [
    "Think about what the handler should return",
    "A Response object needs a status code",
    "return new Response({ status: 200, body: data })"
  ],
  solution: "function handleGet(req) {\n  const data = getData(req.params.id);\n  return new Response({ status: 200, body: data });\n}"
}
```

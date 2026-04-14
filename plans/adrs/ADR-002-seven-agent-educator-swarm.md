# ADR-002: Seven-Agent Parallel Educator Swarm

## Status

Accepted

## Date

2026-04-13

## Context

The existing course skill uses a 6-agent parallel swarm to generate course
content: Curriculum Designer, Subject Matter Expert, Visualization Specialist,
Assessment Engineer, Research Librarian, and UX/Accessibility Reviewer. Each
agent operates independently with a shared brief and produces specialized output
that the coordinator synthesizes.

The new system introduces **hands-on activities** (code exercises, guided
explorations, build challenges, debug challenges) as a first-class course
component alongside quizzes. This raises the question of which agent should
design activities.

We considered three approaches:

1. **Extend the Assessment Engineer** to also design activities (6 agents total).
2. **Add a dedicated Activity Designer** as a 7th agent (7 agents total).
3. **Have the coordinator design activities** during synthesis (6 agents, more
   coordinator work).

## Decision

We will use **Option 2: Add a dedicated Activity Designer as a 7th parallel
agent**.

The Activity Designer agent receives the same brief and content as the other
agents and produces:

- Per-section activity specifications (type, title, description, starter code,
  expected outcome, hints, estimated time)
- Activity type selection based on Bloom's taxonomy alignment
- Scaffold code and validation criteria

All 7 agents are spawned in a single parallel message and execute concurrently.

## Rationale

**Option 1 rejected** because the Assessment Engineer's prompt is already
substantial (quiz design, Bloom's alignment, difficulty curves, distractor
quality, explanations). Adding activity design to the same agent would:
- Exceed practical prompt length for quality output
- Conflate two different pedagogical concerns (assessment vs. practice)
- Risk one concern crowding out the other under token pressure

**Option 3 rejected** because the coordinator's synthesis phase is already
complex (conflict resolution, unified outline, lecturer scripts). Adding
creative activity design to synthesis would make it a bottleneck and blur
the clean separation between "generate" (agents) and "integrate" (coordinator).

**Option 2** preserves the existing architecture's strength: each agent is an
independent specialist with a focused prompt, producing output that the
coordinator merges. The Activity Designer naturally parallels the Assessment
Engineer -- both create interactive elements, but with different pedagogical
goals (practice vs. evaluation).

## Consequences

### Positive

- Clean separation of concerns: quizzes test knowledge, activities build it
- Activity design gets full agent attention (not competing with quiz design
  for tokens)
- Parallelism is preserved: 7 agents run concurrently, no additional latency
- The coordinator's synthesis step gets richer input without getting more complex

### Negative

- One additional agent spawn increases API cost per course (~15% more tokens)
- Coordinator must now merge 7 outputs instead of 6 (modest complexity increase)
- Potential for conflict between Activity Designer and Assessment Engineer
  (e.g., both proposing a code exercise for the same section)

### Mitigations

- The conflict resolution table in the synthesis phase explicitly handles
  Activity Designer vs. Assessment Engineer conflicts: if both propose a code
  exercise for the same section, the Assessment Engineer's version becomes the
  quiz and the Activity Designer's version becomes the hands-on practice
- The Activity Designer agent prompt explicitly states it should design
  *practice* activities (not assessments), reinforcing the boundary
- Cost increase is proportional and predictable; the `--quick` modifier can
  reduce agent work for cost-sensitive users

## Agent Roster (Complete)

| # | Agent | Responsibility | Priority in Conflicts |
|---|-------|---------------|----------------------|
| 1 | Curriculum Designer | Section structure, learning objectives, Bloom's levels | Wins on section count/order |
| 2 | Subject Matter Expert | Technical content, code examples, terminology | Wins on accuracy |
| 3 | Visualization Specialist | Interactive illustrations per section | Wins on viz design, constrained by UX Reviewer |
| 4 | Assessment Engineer | Quizzes: MC, code-completion, concept-match | Wins on assessment design |
| 5 | Research Librarian | Citations, external source validation | Wins on citation authority |
| 6 | UX/Accessibility Reviewer | Font sizes, contrast, keyboard nav, responsive | Absolute veto on accessibility |
| 7 | Activity Designer | Hands-on activities: code exercises, explorations, challenges | Wins on activity design, constrained by Assessment Engineer scope |

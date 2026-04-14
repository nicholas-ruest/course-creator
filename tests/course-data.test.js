import { describe, it, expect } from 'vitest';
import { buildCourseData, buildManifest } from '../src/generator/course-data.js';

// ── Fixture ────────────────────────────────────────────────────────────────

const minimalOutline = {
  title: 'Understanding Hooks',
  slug: 'understanding-hooks',
  source: 'anthropics/claude-code',
  sourceType: 'github_slug',
  audience: 'intermediate',
  instructor: {
    name: 'Dr. Ada',
    emoji: '🤖',
    role: 'Course Instructor',
    avatarId: 'avatar-123',
    voiceId: 'voice-456',
  },
  sections: [
    {
      id: 's1',
      title: 'What Are Hooks?',
      bloomLevel: 'understand',
      learningObjectives: ['Explain what hooks are'],
      estimatedMinutes: 5,
      prerequisites: [],
      lectureScript: '<p>Welcome to hooks.</p>',
      videoUrl: null,
      videoPoster: null,
      videoDuration: null,
      videoTimestamps: null,
      assessments: [
        {
          type: 'multiple-choice',
          bloom: 'understand',
          difficulty: 2,
          question: 'What is a hook?',
          options: ['A', 'B', 'C', 'D'],
          correct: 1,
          explanation: 'B is correct.',
          distractorNotes: ['wrong', '', 'wrong', 'wrong'],
        },
      ],
      activities: [
        {
          id: 'act-s1-1',
          type: 'code-exercise',
          title: 'Write a Hook',
          description: 'Create a simple hook.',
          estimatedMinutes: 3,
          bloomLevel: 'apply',
          hints: ['Think about lifecycle', 'Use useEffect'],
          starterCode: 'function useMyHook() {}',
          solution: 'function useMyHook() { return 42; }',
          expectedPatterns: [
            { type: 'contains', value: 'return', hint: 'Must return a value' },
          ],
          language: 'javascript',
        },
      ],
      terms: [{ term: 'Hook', definition: 'A function' }],
      termCount: 1,
      hasVisualization: false,
      hasCodeBlock: true,
    },
    {
      id: 's2',
      title: 'Advanced Hooks',
      bloomLevel: 'apply',
      learningObjectives: ['Use custom hooks'],
      estimatedMinutes: 8,
      prerequisites: ['s1'],
      lectureScript: '<p>Now for advanced hooks.</p>',
      videoUrl: 'videos/s2.mp4',
      videoPoster: 'videos/s2.jpg',
      videoDuration: 120,
      videoTimestamps: [{ start: 0, end: 60, paragraph: 0 }],
      assessments: [
        {
          type: 'code-completion',
          bloom: 'apply',
          difficulty: 3,
          prompt: 'Complete the hook.',
          starterCode: 'function useFoo() { /* TODO */ }',
          solution: 'function useFoo() { return "bar"; }',
          hints: ['Return a string'],
          language: 'javascript',
        },
      ],
      activities: [],
      terms: [{ term: 'Custom Hook', definition: 'User-defined' }],
      termCount: 1,
      hasVisualization: true,
      hasCodeBlock: true,
    },
  ],
  glossary: [
    { term: 'Hook', definition: 'A reusable function', category: 'concept', firstIntroduced: 's1', related: ['Custom Hook'] },
    { term: 'Custom Hook', definition: 'User-defined hook', category: 'concept', firstIntroduced: 's2', related: ['Hook'] },
    { term: 'Effect', definition: 'Side effect in a component', category: 'concept', firstIntroduced: 's1', related: [] },
  ],
  citations: [
    { id: 'c1', title: 'React Docs', url: 'https://react.dev/reference/react', accessed: '2026-04-14', relevance: 'Official docs', sections: ['s1', 's2'] },
  ],
};

// ── buildCourseData ────────────────────────────────────────────────────────

describe('buildCourseData', () => {
  it('returns an object with meta, sections, glossary, citations', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data).toHaveProperty('meta');
    expect(data).toHaveProperty('sections');
    expect(data).toHaveProperty('glossary');
    expect(data).toHaveProperty('citations');
  });

  it('meta.version is "2.0.0"', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data.meta.version).toBe('2.0.0');
  });

  it('meta.generator is "course-creator/1.0.0"', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data.meta.generator).toBe('course-creator/1.0.0');
  });

  it('computes totalQuestions correctly', () => {
    const data = buildCourseData(minimalOutline, {});
    // s1 has 1 assessment, s2 has 1 assessment = 2 total
    expect(data.meta.totalQuestions).toBe(2);
  });

  it('computes totalActivities correctly', () => {
    const data = buildCourseData(minimalOutline, {});
    // s1 has 1 activity, s2 has 0 = 1 total
    expect(data.meta.totalActivities).toBe(1);
  });

  it('computes estimatedDuration correctly', () => {
    const data = buildCourseData(minimalOutline, {});
    // 5 + 8 = 13
    expect(data.meta.estimatedDuration).toBe(13);
  });

  it('computes totalVideoDuration correctly', () => {
    const data = buildCourseData(minimalOutline, {});
    // s1: null (0), s2: 120 = 120
    expect(data.meta.totalVideoDuration).toBe(120);
  });

  it('meta.sectionCount matches sections array length', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data.meta.sectionCount).toBe(data.sections.length);
    expect(data.meta.sectionCount).toBe(2);
  });

  it('preserves title, topic, source, sourceType', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data.meta.title).toBe('Understanding Hooks');
    expect(data.meta.topic).toBe('understanding-hooks');
    expect(data.meta.source).toBe('anthropics/claude-code');
    expect(data.meta.sourceType).toBe('github_slug');
  });

  it('preserves instructor metadata', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data.meta.instructor.name).toBe('Dr. Ada');
    expect(data.meta.instructor.emoji).toBe('🤖');
    expect(data.meta.instructor.avatarId).toBe('avatar-123');
    expect(data.meta.instructor.voiceId).toBe('voice-456');
  });

  it('uses options.audience when provided', () => {
    const data = buildCourseData(minimalOutline, { audience: 'beginner' });
    expect(data.meta.audience).toBe('beginner');
  });

  it('falls back to outline.audience when option not given', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data.meta.audience).toBe('intermediate');
  });

  it('hasVideo is true when videos exist and noVideo is not set', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data.meta.hasVideo).toBe(true);
  });

  it('hasVideo is false when noVideo option is set', () => {
    const data = buildCourseData(minimalOutline, { noVideo: true });
    expect(data.meta.hasVideo).toBe(false);
  });

  it('sections have all expected fields', () => {
    const data = buildCourseData(minimalOutline, {});
    const s = data.sections[0];
    expect(s.id).toBe('s1');
    expect(s.title).toBe('What Are Hooks?');
    expect(s.bloomLevel).toBe('understand');
    expect(s.learningObjectives).toEqual(['Explain what hooks are']);
    expect(s.estimatedMinutes).toBe(5);
    expect(s.prerequisites).toEqual([]);
    expect(s.lectureScript).toBe('<p>Welcome to hooks.</p>');
    expect(s.videoUrl).toBeNull();
    expect(s.assessments).toHaveLength(1);
    expect(s.activities).toHaveLength(1);
    expect(s.termCount).toBe(1);
    expect(s.hasVisualization).toBe(false);
    expect(s.hasCodeBlock).toBe(true);
  });

  it('glossary entries have all fields', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data.glossary).toHaveLength(3);
    const entry = data.glossary[0];
    expect(entry).toHaveProperty('term');
    expect(entry).toHaveProperty('definition');
    expect(entry).toHaveProperty('category');
    expect(entry).toHaveProperty('firstIntroduced');
    expect(entry).toHaveProperty('related');
  });

  it('citations have all fields', () => {
    const data = buildCourseData(minimalOutline, {});
    expect(data.citations).toHaveLength(1);
    const cite = data.citations[0];
    expect(cite.id).toBe('c1');
    expect(cite.title).toBe('React Docs');
    expect(cite.url).toBe('https://react.dev/reference/react');
    expect(cite.sections).toEqual(['s1', 's2']);
  });

  it('generates slug from title when slug not provided', () => {
    const outline = { ...minimalOutline, slug: undefined, title: 'My Great Course!' };
    const data = buildCourseData(outline, {});
    expect(data.meta.topic).toBe('my-great-course');
  });

  it('handles empty outline gracefully', () => {
    const data = buildCourseData({}, {});
    expect(data.meta.title).toBe('Untitled Course');
    expect(data.meta.sectionCount).toBe(0);
    expect(data.meta.totalQuestions).toBe(0);
    expect(data.sections).toEqual([]);
    expect(data.glossary).toEqual([]);
    expect(data.citations).toEqual([]);
  });
});

// ── buildManifest ──────────────────────────────────────────────────────────

describe('buildManifest', () => {
  it('produces a manifest with correct structure', () => {
    const courseData = buildCourseData(minimalOutline, {});
    const manifest = buildManifest(courseData, null);

    expect(manifest.title).toBe('Understanding Hooks');
    expect(manifest.slug).toBe('understanding-hooks');
    expect(manifest.section_count).toBe(2);
    expect(manifest.total_questions).toBe(2);
    expect(manifest.total_activities).toBe(1);
    expect(manifest.total_video_duration).toBe(120);
    expect(manifest.estimated_duration).toBe(13);
    expect(manifest.heygen).toBeNull();
  });

  it('includes per-section summary', () => {
    const courseData = buildCourseData(minimalOutline, {});
    const manifest = buildManifest(courseData, null);

    expect(manifest.sections).toHaveLength(2);
    expect(manifest.sections[0]).toEqual({
      id: 's1',
      title: 'What Are Hooks?',
      has_video: false,
      has_quiz: true,
      has_activity: true,
    });
    expect(manifest.sections[1]).toEqual({
      id: 's2',
      title: 'Advanced Hooks',
      has_video: true,
      has_quiz: true,
      has_activity: false,
    });
  });

  it('includes video manifest when provided', () => {
    const courseData = buildCourseData(minimalOutline, {});
    const videoManifest = { avatar_id: 'test', generated_at: '2026-04-14' };
    const manifest = buildManifest(courseData, videoManifest);
    expect(manifest.heygen).toEqual(videoManifest);
  });
});

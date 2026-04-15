/**
 * course-data.js — Build the COURSE_DATA v2 object and course manifest.
 *
 * Assembles the complete COURSE_DATA JavaScript object embedded in every
 * generated course HTML, and the manifest.json sidecar file.
 *
 * See: DDD-004  (COURSE_DATA Schema Design)
 *      ADR-001  (Output format — manifest.json)
 */

/**
 * Build the COURSE_DATA object from a unified outline.
 *
 * @param {object} outline — synthesized output from the educator agents
 * @param {object} options — parsed CLI options
 * @returns {object} COURSE_DATA matching DDD-004 schema v2.0.0
 */
export function buildCourseData(outline, options) {
  const sections = (outline.sections || []).map((section, index) => {
    const assessments = section.assessments || [];
    const activities = section.activities || [];

    return {
      id: section.id || `s${index + 1}`,
      title: section.title || `Section ${index + 1}`,
      bloomLevel: section.bloomLevel || 'understand',
      learningObjectives: section.learningObjectives || [],
      estimatedMinutes: section.estimatedMinutes || 5,
      prerequisites: section.prerequisites || [],
      lectureScript: section.lectureScript || '',
      videoUrl: section.videoUrl || null,
      videoPoster: section.videoPoster || null,
      videoDuration: section.videoDuration || null,
      videoTimestamps: section.videoTimestamps || null,
      assessments,
      activities,
      termCount: section.termCount ?? (section.terms || []).length,
      hasVisualization: section.hasVisualization ?? false,
      hasCodeBlock: section.hasCodeBlock ?? false,
    };
  });

  // Compute derived totals
  const totalQuestions = sections.reduce(
    (sum, s) => sum + s.assessments.length,
    0,
  );
  const totalActivities = sections.reduce(
    (sum, s) => sum + s.activities.length,
    0,
  );
  const estimatedDuration = sections.reduce(
    (sum, s) => sum + s.estimatedMinutes,
    0,
  );
  const totalVideoDuration = sections.reduce(
    (sum, s) => sum + (s.videoDuration || 0),
    0,
  );

  const instructor = outline.instructor || {};

  return {
    meta: {
      title: outline.title || 'Untitled Course',
      topic: outline.slug || outline.topic || slugify(outline.title || 'untitled'),
      generated: new Date().toISOString().split('T')[0],
      sectionCount: sections.length,
      totalQuestions,
      source: outline.source || '',
      sourceType: outline.sourceType || '',
      audience: options.audience || outline.audience || 'intermediate',
      estimatedDuration,
      totalActivities,
      totalVideoDuration,
      hasVideo: !options.noVideo,
      version: '2.0.0',
      generator: 'course-creator/1.0.0',
      instructor: {
        name: instructor.name || 'Dr. Ada',
        emoji: instructor.emoji || '🤖',
        role: instructor.role || 'Course Instructor',
        avatarId: instructor.avatarId || null,
        voiceId: instructor.voiceId || null,
      },
    },
    sections,
    glossary: (outline.glossary || []).map(entry => ({
      term: entry.term,
      definition: entry.definition,
      category: entry.category || 'concept',
      firstIntroduced: entry.firstIntroduced || 's1',
      related: entry.related || [],
    })),
    citations: (outline.citations || []).map(cite => ({
      id: cite.id,
      title: cite.title,
      url: cite.url,
      accessed: cite.accessed || new Date().toISOString().split('T')[0],
      relevance: cite.relevance || '',
      sections: cite.sections || [],
    })),
  };
}

/**
 * Build the manifest.json structure for a generated course.
 *
 * @param {object} courseData — COURSE_DATA object from buildCourseData
 * @param {object|null} videoManifest — video generation results (null if no video)
 * @returns {object} CourseManifest matching SPARC.md Section 3.3
 */
export function buildManifest(courseData, videoManifest) {
  return {
    title: courseData.meta.title,
    slug: courseData.meta.topic,
    generated: courseData.meta.generated,
    source: courseData.meta.source,
    section_count: courseData.meta.sectionCount,
    total_questions: courseData.meta.totalQuestions,
    total_activities: courseData.meta.totalActivities,
    total_video_duration: courseData.meta.totalVideoDuration,
    estimated_duration: courseData.meta.estimatedDuration,
    file_size_kb: null, // set by caller after writing HTML
    sections: courseData.sections.map(s => ({
      id: s.id,
      title: s.title,
      has_video: !!s.videoUrl,
      has_quiz: s.assessments.length > 0,
      has_activity: s.activities.length > 0,
    })),
    heygen: videoManifest || null,
  };
}

/**
 * Convert a title string to a kebab-case slug.
 */
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

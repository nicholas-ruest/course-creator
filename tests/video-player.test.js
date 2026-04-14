import { describe, it, expect } from 'vitest';
import {
  generateVideoPlayerHTML,
  generateTranscriptHTML,
  generateVideoPlayerCSS,
  generateVideoPlayerJS,
} from '../src/generator/video-player.js';
import { generateHTML } from '../src/generator/html.js';
import { DEFAULTS } from '../src/config.js';

// ── Fixture outline ────────────────────────────────────────────────────────

const outline = {
  title: 'Video Test Course',
  slug: 'video-test',
  source: 'test/repo',
  sourceType: 'local_path',
  instructor: { name: 'Dr. Video', emoji: '🎬', role: 'Instructor' },
  sections: [
    {
      id: 's1', title: 'Intro', bloomLevel: 'understand', estimatedMinutes: 5,
      lectureScript: '<p>Welcome to the course.</p>',
      content: '<p>Introduction content.</p>',
      videoUrl: 'videos/s1.mp4', videoPoster: 'videos/s1.jpg',
      videoDuration: 120, videoTimestamps: null,
      terms: [{ term: 'Intro', definition: 'The beginning' }],
      assessments: [], activities: [],
    },
    {
      id: 's2', title: 'Details', bloomLevel: 'apply', estimatedMinutes: 8,
      lectureScript: '<p>Now for the details.</p>',
      content: '<p>Detailed content here.</p>',
      videoUrl: 'videos/s2.mp4', videoPoster: null,
      videoDuration: 90, videoTimestamps: null,
      terms: [], assessments: [], activities: [],
    },
  ],
  glossary: [{ term: 'Intro', definition: 'The beginning', category: 'concept', firstIntroduced: 's1', related: [] }],
  citations: [],
};

// ── generateVideoPlayerHTML ────────────────────────────────────────────────

describe('generateVideoPlayerHTML', () => {
  const html = generateVideoPlayerHTML();

  it('contains instructor-video element', () => {
    expect(html).toContain('id="instructor-video"');
  });

  it('contains video-source element', () => {
    expect(html).toContain('id="video-source"');
  });

  it('contains video-play-btn', () => {
    expect(html).toContain('id="video-play-btn"');
  });

  it('contains video-progress-fill', () => {
    expect(html).toContain('id="video-progress-fill"');
  });

  it('contains video-time display', () => {
    expect(html).toContain('id="video-time"');
  });

  it('contains video-mute-btn', () => {
    expect(html).toContain('id="video-mute-btn"');
  });

  it('contains video-fallback', () => {
    expect(html).toContain('id="video-fallback"');
  });

  it('contains lecturer-video wrapper', () => {
    expect(html).toContain('id="lecturer-video"');
  });

  it('has aria labels for accessibility', () => {
    expect(html).toContain('aria-label="Play video"');
    expect(html).toContain('aria-label="Mute"');
    expect(html).toContain('role="slider"');
  });

  it('has playsinline attribute for mobile', () => {
    expect(html).toContain('playsinline');
  });

  it('retains avatar/name placeholders in fallback', () => {
    expect(html).toContain('{{AVATAR_EMOJI}}');
    expect(html).toContain('{{INSTRUCTOR_NAME}}');
  });
});

// ── generateTranscriptHTML ─────────────────────────────────────────────────

describe('generateTranscriptHTML', () => {
  const html = generateTranscriptHTML();

  it('contains lecturer-transcript', () => {
    expect(html).toContain('id="lecturer-transcript"');
  });

  it('contains transcript-body', () => {
    expect(html).toContain('id="transcript-body"');
  });

  it('contains transcript-header', () => {
    expect(html).toContain('transcript-header');
    expect(html).toContain('Transcript');
  });
});

// ── generateVideoPlayerCSS ─────────────────────────────────────────────────

describe('generateVideoPlayerCSS', () => {
  const css = generateVideoPlayerCSS();

  it('contains all required selectors', () => {
    expect(css).toContain('.lecturer-video');
    expect(css).toContain('.instructor-video-player');
    expect(css).toContain('.video-controls');
    expect(css).toContain('.video-ctrl-btn');
    expect(css).toContain('.video-progress-track');
    expect(css).toContain('.video-progress-fill');
    expect(css).toContain('.video-time');
    expect(css).toContain('.video-fallback');
    expect(css).toContain('.lecturer-transcript');
    expect(css).toContain('.transcript-header');
    expect(css).toContain('.transcript-body');
    expect(css).toContain('.transcript-active');
  });

  it('contains mobile mini-player rule', () => {
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('.mini-player');
  });

  it('uses brand variables', () => {
    expect(css).toContain('var(--primary)');
    expect(css).toContain('var(--bg-code)');
    expect(css).toContain('var(--bg-console)');
    expect(css).toContain('var(--font-mono)');
  });
});

// ── generateVideoPlayerJS ──────────────────────────────────────────────────

describe('generateVideoPlayerJS', () => {
  const js = generateVideoPlayerJS();

  it('contains loadSectionVideo function', () => {
    expect(js).toContain('function loadSectionVideo(');
  });

  it('contains syncTranscript function', () => {
    expect(js).toContain('function syncTranscript(');
  });

  it('contains keyboard event listener', () => {
    expect(js).toContain("document.addEventListener('keydown'");
    expect(js).toContain('Space');
    expect(js).toContain('ArrowLeft');
    expect(js).toContain('ArrowRight');
    expect(js).toContain('KeyM');
  });

  it('contains play/pause event handlers', () => {
    expect(js).toContain("addEventListener('play'");
    expect(js).toContain("addEventListener('pause'");
  });

  it('contains progress bar handler', () => {
    expect(js).toContain("addEventListener('timeupdate'");
  });

  it('contains error fallback handler', () => {
    expect(js).toContain("addEventListener('error'");
    expect(js).toContain('fallbackEl');
  });

  it('references COURSE_DATA', () => {
    expect(js).toContain('COURSE_DATA.sections');
  });

  it('respects prefers-reduced-motion', () => {
    expect(js).toContain('prefers-reduced-motion');
  });
});

// ── HTML generation with hasVideo: true ────────────────────────────────────

describe('generateHTML with video enabled', () => {
  let result;

  it('generates HTML with video player', async () => {
    result = await generateHTML(outline, {}, DEFAULTS);
    expect(result.html).toContain('id="instructor-video"');
    expect(result.html).toContain('id="lecturer-video"');
    expect(result.html).toContain('id="lecturer-transcript"');
    expect(result.html).toContain('id="transcript-body"');
  });

  it('does NOT contain the static avatar/name elements', async () => {
    if (!result) result = await generateHTML(outline, {}, DEFAULTS);
    // The video player HTML has a fallback with avatar/name but the
    // original static ones should be replaced
    expect(result.html).not.toContain('id="lecturer-dialogue"');
  });

  it('retains the nav list', async () => {
    if (!result) result = await generateHTML(outline, {}, DEFAULTS);
    expect(result.html).toContain('id="lecturer-nav"');
    expect(result.html).toContain('1. Intro');
    expect(result.html).toContain('2. Details');
  });

  it('retains the progress bar', async () => {
    if (!result) result = await generateHTML(outline, {}, DEFAULTS);
    expect(result.html).toContain('id="progress-fill"');
  });

  it('has loadSectionVideo hooked into activateSection', async () => {
    if (!result) result = await generateHTML(outline, {}, DEFAULTS);
    expect(result.html).toContain('loadSectionVideo(sid)');
  });

  it('has video player CSS injected', async () => {
    if (!result) result = await generateHTML(outline, {}, DEFAULTS);
    expect(result.html).toContain('.lecturer-video');
    expect(result.html).toContain('.video-controls');
    expect(result.html).toContain('.transcript-active');
  });

  it('has video player JS injected', async () => {
    if (!result) result = await generateHTML(outline, {}, DEFAULTS);
    expect(result.html).toContain('function loadSectionVideo');
    expect(result.html).toContain('function syncTranscript');
  });

  it('COURSE_DATA has hasVideo: true', async () => {
    if (!result) result = await generateHTML(outline, {}, DEFAULTS);
    expect(result.courseData.meta.hasVideo).toBe(true);
  });

  it('fallback has correct instructor name and emoji', async () => {
    if (!result) result = await generateHTML(outline, {}, DEFAULTS);
    expect(result.html).toContain('Dr. Video');
    expect(result.html).toContain('🎬');
  });
});

// ── HTML generation with hasVideo: false ───────────────────────────────────

describe('generateHTML with video disabled', () => {
  const noVideoOutline = {
    ...outline,
    sections: outline.sections.map(s => ({
      ...s, videoUrl: null, videoDuration: null,
    })),
  };

  let result;

  it('generates HTML without video player', async () => {
    result = await generateHTML(noVideoOutline, { noVideo: true }, DEFAULTS);
    expect(result.html).not.toContain('id="instructor-video"');
    expect(result.html).not.toContain('id="lecturer-video"');
  });

  it('retains the text lecturer pane with dialogue', async () => {
    if (!result) result = await generateHTML(noVideoOutline, { noVideo: true }, DEFAULTS);
    expect(result.html).toContain('id="lecturer-dialogue"');
    expect(result.html).toContain('lecturer-avatar');
    expect(result.html).toContain('lecturer-name');
  });

  it('COURSE_DATA has hasVideo: false', async () => {
    if (!result) result = await generateHTML(noVideoOutline, { noVideo: true }, DEFAULTS);
    expect(result.courseData.meta.hasVideo).toBe(false);
  });

  it('does NOT inject video player CSS or JS', async () => {
    if (!result) result = await generateHTML(noVideoOutline, { noVideo: true }, DEFAULTS);
    expect(result.html).not.toContain('function loadSectionVideo');
    expect(result.html).not.toContain('.instructor-video-player');
  });
});

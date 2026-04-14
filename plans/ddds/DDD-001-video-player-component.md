# DDD-001: Video Player Component Design

## Overview

This document specifies the design of the video player component that replaces
the text-only lecturer dialogue in the left pane. The video player must integrate
seamlessly with the existing 3-pane layout, synchronize with the
IntersectionObserver-driven section tracking, and degrade gracefully when video
is unavailable.

**Related ADRs**: ADR-001 (output format), ADR-003 (async video pipeline)

## Layout Integration

The video player occupies the top portion of the existing 240px-wide lecturer
pane. The pane is restructured from:

```
BEFORE (text-only):
+------------------+
| Avatar (emoji)   |
| Name             |
| Role             |
| Nav list         |
| Dialogue text    |
+------------------+

AFTER (with video):
+------------------+
| Video Player     |
|  (16:9 ratio     |
|   within 240px)  |
| Video controls   |
| Nav list         |
| Transcript text  |
+------------------+
```

The avatar, name, and role elements are removed when video is active -- the
HeyGen avatar IS the instructor presence. The nav list remains for section
navigation. The dialogue text becomes a scrollable transcript below the video.

### Dimensions

- Pane width: 240px (unchanged from existing layout)
- Video player: 240px wide x 135px tall (16:9 at 240px width)
- Video controls bar: 240px wide x 32px tall
- Remaining height: nav list + transcript (scrollable)

### Responsive Behavior

| Breakpoint | Behavior |
|-----------|----------|
| > 1024px | Video player visible in left pane, full layout |
| 768-1024px | Left pane hidden by default (existing slide-in behavior). When opened, video plays inline. |
| < 768px | Video moves to a floating mini-player (picture-in-picture style) anchored to bottom-right of content pane. 160px x 90px. Tappable to expand. |

## HTML Structure

```html
<aside class="lecturer">
  <div class="progress-bar">
    <div class="progress-fill" id="progress-fill" style="height:0%"></div>
  </div>

  <!-- Video Player (NEW - replaces avatar/name/role when video enabled) -->
  <div class="lecturer-video" id="lecturer-video">
    <video id="instructor-video"
           playsinline
           preload="metadata"
           class="instructor-video-player">
      <source id="video-source" src="" type="video/mp4">
      Your browser does not support video playback.
    </video>
    <div class="video-controls">
      <button class="video-ctrl-btn" id="video-play-btn"
              aria-label="Play video" title="Play (Space)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5,3 19,12 5,21"/>
        </svg>
      </button>
      <div class="video-progress-track" id="video-progress-track"
           role="slider" aria-label="Video progress"
           aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
           tabindex="0">
        <div class="video-progress-fill" id="video-progress-fill"></div>
      </div>
      <span class="video-time" id="video-time">0:00</span>
      <button class="video-ctrl-btn" id="video-mute-btn"
              aria-label="Mute" title="Mute (M)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
      </button>
    </div>
    <!-- Fallback shown when video unavailable -->
    <div class="video-fallback" id="video-fallback" style="display:none;">
      <div class="lecturer-avatar">{{AVATAR_EMOJI}}</div>
      <div class="lecturer-name">{{INSTRUCTOR_NAME}}</div>
      <div class="lecturer-role">Course Instructor</div>
    </div>
  </div>

  <!-- Section Navigation (unchanged) -->
  <ul class="lecturer-nav" id="lecturer-nav">
    <!-- Generated nav items -->
  </ul>

  <!-- Transcript (replaces lecturer-dialogue) -->
  <div class="lecturer-transcript" id="lecturer-transcript">
    <div class="transcript-header">Transcript</div>
    <div class="transcript-body" id="transcript-body">
      <!-- Updated dynamically as sections scroll into view -->
    </div>
  </div>
</aside>
```

## CSS Specification

```css
/* ═══ Video Player ═══ */
.lecturer-video {
  width: 100%;
  margin-bottom: 12px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--bg-code);
  position: relative;
}

.instructor-video-player {
  width: 100%;
  aspect-ratio: 16/9;
  display: block;
  object-fit: cover;
  background: var(--bg-code);
}

.video-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-console);
  border-top: 1px solid var(--border);
}

.video-ctrl-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-dim);
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s;
  flex-shrink: 0;
}

.video-ctrl-btn:hover {
  color: var(--primary);
  background: var(--primary-dim);
}

.video-ctrl-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.video-progress-track {
  flex: 1;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  cursor: pointer;
  position: relative;
}

.video-progress-track:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 4px;
}

.video-progress-fill {
  height: 100%;
  background: var(--primary);
  border-radius: 2px;
  width: 0%;
  transition: width 0.1s linear;
}

.video-time {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  color: var(--text-dim);
  min-width: 32px;
  text-align: right;
  flex-shrink: 0;
}

.video-fallback {
  padding: 20px 16px;
  text-align: center;
}

/* ═══ Transcript ═══ */
.lecturer-transcript {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.transcript-header {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-dim);
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

.transcript-body {
  font-size: 0.85rem;
  color: var(--text);
  line-height: 1.7;
}

.transcript-body p {
  margin-bottom: 10px;
}

.transcript-body p:last-child {
  margin-bottom: 0;
}

/* Active transcript paragraph (synced with video playback) */
.transcript-body p.transcript-active {
  color: var(--text-bright);
  background: var(--primary-dim);
  border-radius: 4px;
  padding: 4px 8px;
  margin-left: -8px;
  margin-right: -8px;
}

/* ═══ Mini Player (mobile) ═══ */
@media (max-width: 768px) {
  .lecturer-video.mini-player {
    position: fixed;
    bottom: 80px;
    right: 16px;
    width: 160px;
    z-index: 60;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--border);
  }

  .lecturer-video.mini-player .video-controls {
    display: none;
  }

  .lecturer-video.mini-player .instructor-video-player {
    border-radius: var(--radius-sm);
  }
}
```

## JavaScript Specification

```javascript
// ═══ VIDEO PLAYER ENGINE ═══

const videoEl = document.getElementById('instructor-video');
const videoSource = document.getElementById('video-source');
const playBtn = document.getElementById('video-play-btn');
const muteBtn = document.getElementById('video-mute-btn');
const progressTrack = document.getElementById('video-progress-track');
const progressFill = document.getElementById('video-progress-fill');
const timeDisplay = document.getElementById('video-time');
const fallbackEl = document.getElementById('video-fallback');
const transcriptBody = document.getElementById('transcript-body');

let currentVideoSection = null;

// ── Section change: load new video ──
function loadSectionVideo(sid) {
  const section = COURSE_DATA.sections.find(s => s.id === sid);
  if (!section) return;

  currentVideoSection = sid;

  // Update transcript
  if (transcriptBody) {
    transcriptBody.innerHTML = section.lectureScript;
  }

  // Load video if available
  if (section.videoUrl && videoEl) {
    videoSource.src = section.videoUrl;
    videoEl.poster = section.videoPoster || '';
    videoEl.load();
    videoEl.style.display = 'block';
    fallbackEl.style.display = 'none';

    // Auto-play preference
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      videoEl.play().catch(() => {}); // Silently fail if autoplay blocked
    }
  } else {
    // No video: show fallback
    if (videoEl) videoEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'block';
  }
}

// ── Hook into existing activateSection ──
// The existing activateSection function is modified to call loadSectionVideo:
//   function activateSection(sid) {
//     ...existing logic...
//     loadSectionVideo(sid);  // <-- added
//   }

// ── Play/Pause ──
playBtn?.addEventListener('click', () => {
  if (videoEl.paused) {
    videoEl.play();
  } else {
    videoEl.pause();
  }
});

videoEl?.addEventListener('play', () => {
  playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" ' +
    'fill="currentColor"><rect x="6" y="4" width="4" height="16"/>' +
    '<rect x="14" y="4" width="4" height="16"/></svg>';
  playBtn.setAttribute('aria-label', 'Pause video');
});

videoEl?.addEventListener('pause', () => {
  playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" ' +
    'fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
  playBtn.setAttribute('aria-label', 'Play video');
});

// ── Progress Bar ──
videoEl?.addEventListener('timeupdate', () => {
  if (!videoEl.duration) return;
  const pct = (videoEl.currentTime / videoEl.duration) * 100;
  progressFill.style.width = pct + '%';
  progressTrack.setAttribute('aria-valuenow', Math.round(pct));

  // Time display
  const mins = Math.floor(videoEl.currentTime / 60);
  const secs = Math.floor(videoEl.currentTime % 60);
  timeDisplay.textContent = mins + ':' + String(secs).padStart(2, '0');

  // Transcript sync (if timestamps available)
  syncTranscript(videoEl.currentTime);
});

progressTrack?.addEventListener('click', (e) => {
  const rect = progressTrack.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  videoEl.currentTime = pct * videoEl.duration;
});

// ── Mute ──
muteBtn?.addEventListener('click', () => {
  videoEl.muted = !videoEl.muted;
  muteBtn.setAttribute('aria-label', videoEl.muted ? 'Unmute' : 'Mute');
});

// ── Keyboard Controls ──
document.addEventListener('keydown', (e) => {
  if (!videoEl || document.activeElement.tagName === 'TEXTAREA') return;
  if (e.code === 'Space' && !e.target.closest('.activity-card')) {
    e.preventDefault();
    videoEl.paused ? videoEl.play() : videoEl.pause();
  }
  if (e.code === 'ArrowLeft') { videoEl.currentTime -= 10; }
  if (e.code === 'ArrowRight') { videoEl.currentTime += 10; }
  if (e.code === 'KeyM') { videoEl.muted = !videoEl.muted; }
});

// ── Video error fallback ──
videoEl?.addEventListener('error', () => {
  videoEl.style.display = 'none';
  fallbackEl.style.display = 'block';
});

// ── Transcript sync ──
function syncTranscript(currentTime) {
  const paragraphs = transcriptBody?.querySelectorAll('p[data-start]');
  if (!paragraphs) return;

  paragraphs.forEach(p => {
    const start = parseFloat(p.dataset.start);
    const end = parseFloat(p.dataset.end || Infinity);
    if (currentTime >= start && currentTime < end) {
      p.classList.add('transcript-active');
      p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      p.classList.remove('transcript-active');
    }
  });
}
```

## Accessibility Requirements

| Requirement | Implementation |
|------------|----------------|
| Keyboard operable | Space=play/pause, arrows=seek, M=mute, all via keydown listener |
| Focus indicators | `:focus-visible` outline on all controls |
| Screen reader labels | `aria-label` on play, mute, progress; `role="slider"` on progress bar |
| Reduced motion | `prefers-reduced-motion: reduce` disables autoplay |
| Transcript | Always visible below video; scrolls with playback |
| No autoplay audio | Video starts muted until user interaction (browser policy) |
| Video error | Graceful fallback to text avatar on load error |

## COURSE_DATA Schema Extension

```javascript
// New fields per section:
{
  id: "s1",
  title: "...",
  lectureScript: "<p>...</p>",           // Retained: text fallback + transcript
  videoUrl: "videos/s1-intro.mp4",       // NEW: relative path to HeyGen video
  videoPoster: "videos/s1-intro.jpg",    // NEW: thumbnail for poster frame
  videoDuration: 142,                    // NEW: duration in seconds
  videoTimestamps: [                     // NEW: paragraph-level timestamps
    { start: 0, end: 23, paragraph: 0 },
    { start: 23, end: 51, paragraph: 1 },
    { start: 51, end: 89, paragraph: 2 }
  ],
  // ...existing fields unchanged
}
```

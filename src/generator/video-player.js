/**
 * video-player.js — Video player component for the lecturer pane.
 *
 * Generates the HTML, CSS, and JS for the HeyGen talking-head video player
 * that replaces the text-only lecturer dialogue when video is enabled.
 *
 * See: DDD-001  (Video Player Component Design)
 *      DDD-006  (Brand System Extension — video player brand integration)
 */

/**
 * Generate the video player HTML that replaces the avatar/name/role/dialogue
 * elements in the lecturer pane.
 *
 * The returned HTML goes inside <aside class="lecturer">, after the
 * progress bar and before the nav list.
 */
export function generateVideoPlayerHTML() {
  return `  <!-- Video Player (replaces avatar/name/role when video enabled) -->
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
  </div>`;
}

/**
 * Generate the transcript section that replaces lecturer-dialogue.
 */
export function generateTranscriptHTML() {
  return `  <!-- Transcript (replaces lecturer-dialogue) -->
  <div class="lecturer-transcript" id="lecturer-transcript">
    <div class="transcript-header">Transcript</div>
    <div class="transcript-body" id="transcript-body">
      <!-- Updated dynamically as sections scroll into view -->
    </div>
  </div>`;
}

/**
 * Return the complete video player CSS from DDD-001.
 */
export function generateVideoPlayerCSS() {
  return `
/* ═══ Video Player ═══ */
.lecturer-video { width: 100%; margin-bottom: 12px; border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-code); position: relative; }
.instructor-video-player { width: 100%; aspect-ratio: 16/9; display: block; object-fit: cover; background: var(--bg-code); }
.video-controls { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: var(--bg-console); border-top: 1px solid var(--border); }
.video-ctrl-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; color: var(--text-dim); cursor: pointer; border-radius: 4px; transition: color 0.2s, background 0.2s; flex-shrink: 0; }
.video-ctrl-btn:hover { color: var(--primary); background: var(--primary-dim); }
.video-ctrl-btn:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.video-progress-track { flex: 1; height: 4px; background: var(--border); border-radius: 2px; cursor: pointer; position: relative; }
.video-progress-track:focus-visible { outline: 2px solid var(--primary); outline-offset: 4px; }
.video-progress-fill { height: 100%; background: var(--primary); border-radius: 2px; width: 0%; transition: width 0.1s linear; }
.video-time { font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-dim); min-width: 32px; text-align: right; flex-shrink: 0; }
.video-fallback { padding: 20px 16px; text-align: center; }

/* ═══ Transcript ═══ */
.lecturer-transcript { flex: 1; overflow-y: auto; padding: 0 16px 16px; }
.transcript-header { font-family: var(--font-mono); font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
.transcript-body { font-size: 0.85rem; color: var(--text); line-height: 1.7; }
.transcript-body p { margin-bottom: 10px; }
.transcript-body p:last-child { margin-bottom: 0; }
.transcript-body p.transcript-active { color: var(--text-bright); background: var(--primary-dim); border-radius: 4px; padding: 4px 8px; margin-left: -8px; margin-right: -8px; }

/* ═══ Mini Player (mobile) ═══ */
@media (max-width: 768px) {
  .lecturer-video.mini-player { position: fixed; bottom: 80px; right: 16px; width: 160px; z-index: 60; border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); border: 1px solid var(--border); }
  .lecturer-video.mini-player .video-controls { display: none; }
  .lecturer-video.mini-player .instructor-video-player { border-radius: var(--radius-sm); }
}
`;
}

/**
 * Return the complete video player client-side JavaScript from DDD-001.
 */
export function generateVideoPlayerJS() {
  return `
// ═══ VIDEO PLAYER ENGINE ═══

var videoEl = document.getElementById('instructor-video');
var videoSource = document.getElementById('video-source');
var playBtn = document.getElementById('video-play-btn');
var muteBtn = document.getElementById('video-mute-btn');
var progressTrack = document.getElementById('video-progress-track');
var progressFill = document.getElementById('video-progress-fill');
var timeDisplay = document.getElementById('video-time');
var fallbackEl = document.getElementById('video-fallback');
var transcriptBody = document.getElementById('transcript-body');
var currentVideoSection = null;

function loadSectionVideo(sid) {
  var section = COURSE_DATA.sections.find(function(s) { return s.id === sid; });
  if (!section) return;
  currentVideoSection = sid;

  // Update transcript
  if (transcriptBody) {
    transcriptBody.innerHTML = section.lectureScript || '';
  }

  // Load video if available
  if (section.videoUrl && videoEl) {
    videoSource.src = section.videoUrl;
    videoEl.poster = section.videoPoster || '';
    videoEl.load();
    videoEl.style.display = 'block';
    if (fallbackEl) fallbackEl.style.display = 'none';

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      videoEl.play().catch(function() {});
    }
  } else {
    if (videoEl) videoEl.style.display = 'none';
    if (fallbackEl) fallbackEl.style.display = 'block';
  }
}

// Play/Pause
if (playBtn) playBtn.addEventListener('click', function() {
  if (videoEl.paused) { videoEl.play(); } else { videoEl.pause(); }
});

if (videoEl) videoEl.addEventListener('play', function() {
  playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
  playBtn.setAttribute('aria-label', 'Pause video');
});

if (videoEl) videoEl.addEventListener('pause', function() {
  playBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>';
  playBtn.setAttribute('aria-label', 'Play video');
});

// Progress bar
if (videoEl) videoEl.addEventListener('timeupdate', function() {
  if (!videoEl.duration) return;
  var pct = (videoEl.currentTime / videoEl.duration) * 100;
  progressFill.style.width = pct + '%';
  progressTrack.setAttribute('aria-valuenow', Math.round(pct));
  var mins = Math.floor(videoEl.currentTime / 60);
  var secs = Math.floor(videoEl.currentTime % 60);
  timeDisplay.textContent = mins + ':' + String(secs).padStart(2, '0');
  syncTranscript(videoEl.currentTime);
});

if (progressTrack) progressTrack.addEventListener('click', function(e) {
  var rect = progressTrack.getBoundingClientRect();
  var pct = (e.clientX - rect.left) / rect.width;
  videoEl.currentTime = pct * videoEl.duration;
});

// Mute
if (muteBtn) muteBtn.addEventListener('click', function() {
  videoEl.muted = !videoEl.muted;
  muteBtn.setAttribute('aria-label', videoEl.muted ? 'Unmute' : 'Mute');
});

// Keyboard controls
document.addEventListener('keydown', function(e) {
  if (!videoEl || !document.activeElement) return;
  if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;
  if (e.code === 'Space' && !e.target.closest('.activity-card')) {
    e.preventDefault();
    videoEl.paused ? videoEl.play() : videoEl.pause();
  }
  if (e.code === 'ArrowLeft') { videoEl.currentTime = Math.max(0, videoEl.currentTime - 10); }
  if (e.code === 'ArrowRight') { videoEl.currentTime = Math.min(videoEl.duration || 0, videoEl.currentTime + 10); }
  if (e.code === 'KeyM') { videoEl.muted = !videoEl.muted; }
});

// Video error fallback
if (videoEl) videoEl.addEventListener('error', function() {
  videoEl.style.display = 'none';
  if (fallbackEl) fallbackEl.style.display = 'block';
});

// Transcript sync
function syncTranscript(currentTime) {
  if (!transcriptBody) return;
  var paragraphs = transcriptBody.querySelectorAll('p[data-start]');
  if (!paragraphs || !paragraphs.length) return;
  paragraphs.forEach(function(p) {
    var start = parseFloat(p.dataset.start);
    var end = parseFloat(p.dataset.end || Infinity);
    if (currentTime >= start && currentTime < end) {
      p.classList.add('transcript-active');
      p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      p.classList.remove('transcript-active');
    }
  });
}
`;
}

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VideoCache } from '../src/video/cache.js';
import { HeyGenClient } from '../src/video/heygen.js';
import { awaitAllVideos } from '../src/video/poller.js';
import { DEFAULTS } from '../src/config.js';

// ── VideoCache ──────────────────────────────────────────────────────────────

describe('VideoCache', () => {
  const cacheDir = path.join(os.tmpdir(), `cache-test-${Date.now()}`);
  const cache = new VideoCache(cacheDir);

  afterAll(() => {
    try { fs.rmSync(cacheDir, { recursive: true, force: true }); } catch {}
  });

  it('computeHash returns a 64-char hex string', () => {
    const hash = cache.computeHash('hello', 'avatar1', 'voice1');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computeHash is deterministic', () => {
    const h1 = cache.computeHash('script', 'av', 'vo');
    const h2 = cache.computeHash('script', 'av', 'vo');
    expect(h1).toBe(h2);
  });

  it('computeHash normalizes whitespace', () => {
    const h1 = cache.computeHash('hello  world', 'a', 'v');
    const h2 = cache.computeHash('hello world', 'a', 'v');
    expect(h1).toBe(h2);
  });

  it('computeHash differs for different scripts', () => {
    const h1 = cache.computeHash('script A', 'av', 'vo');
    const h2 = cache.computeHash('script B', 'av', 'vo');
    expect(h1).not.toBe(h2);
  });

  it('computeHash differs for different avatars', () => {
    const h1 = cache.computeHash('script', 'avatar1', 'vo');
    const h2 = cache.computeHash('script', 'avatar2', 'vo');
    expect(h1).not.toBe(h2);
  });

  it('has() returns false for missing entry', () => {
    expect(cache.has('nonexistent')).toBe(false);
  });

  it('get() returns null for missing entry', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('set/has/get lifecycle works', () => {
    // Create a temp video file
    const tempVideo = path.join(os.tmpdir(), `test-video-${Date.now()}.mp4`);
    fs.writeFileSync(tempVideo, 'fake video content');

    const hash = cache.computeHash('test script', 'av', 'vo');
    cache.set(hash, tempVideo, { duration: 120 });

    expect(cache.has(hash)).toBe(true);

    const entry = cache.get(hash);
    expect(entry).not.toBeNull();
    expect(entry.videoPath).toContain(`${hash}.mp4`);
    expect(entry.metadata.duration).toBe(120);
    expect(fs.existsSync(entry.videoPath)).toBe(true);

    fs.unlinkSync(tempVideo);
  });

  it('creates cache directory on first write', () => {
    const newDir = path.join(os.tmpdir(), `new-cache-${Date.now()}`);
    const newCache = new VideoCache(newDir);
    const tempVideo = path.join(os.tmpdir(), `test-vid-${Date.now()}.mp4`);
    fs.writeFileSync(tempVideo, 'data');

    newCache.set('abc123' + Date.now(), tempVideo, {});
    expect(fs.existsSync(newDir)).toBe(true);

    fs.unlinkSync(tempVideo);
    fs.rmSync(newDir, { recursive: true, force: true });
  });
});

// ── HeyGenClient ────────────────────────────────────────────────────────────

describe('HeyGenClient', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('submitVideo returns cached result when available', async () => {
    const cacheDir = path.join(os.tmpdir(), `heygen-cache-${Date.now()}`);
    const cache = new VideoCache(cacheDir);

    // Pre-populate cache
    const tempVideo = path.join(os.tmpdir(), `cached-${Date.now()}.mp4`);
    fs.writeFileSync(tempVideo, 'cached');
    const hash = cache.computeHash(
      // The sanitized version of '<p>Hello</p>' is 'Hello'
      'Hello', DEFAULTS.heygen.avatar_id, DEFAULTS.heygen.voice_id,
    );
    cache.set(hash, tempVideo, {});

    const client = new HeyGenClient('test-key', DEFAULTS.heygen, cache);
    const result = await client.submitVideo('<p>Hello</p>', 's1');

    expect(result.status).toBe('completed');
    expect(result.cached).toBe(true);
    expect(result.section_id).toBe('s1');

    fs.unlinkSync(tempVideo);
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('submitVideo posts correct payload to HeyGen API', async () => {
    let capturedBody = null;
    let capturedHeaders = null;

    globalThis.fetch = vi.fn().mockImplementation(async (url, opts) => {
      capturedBody = JSON.parse(opts.body);
      capturedHeaders = opts.headers;
      return {
        ok: true,
        json: async () => ({ data: { video_id: 'vid-123' } }),
      };
    });

    const client = new HeyGenClient('my-api-key', DEFAULTS.heygen);
    const result = await client.submitVideo('<p>Test script</p>', 's2');

    expect(result.video_id).toBe('vid-123');
    expect(result.status).toBe('processing');
    expect(result.section_id).toBe('s2');

    // Verify payload structure
    expect(capturedBody.video_inputs).toHaveLength(1);
    expect(capturedBody.video_inputs[0].character.type).toBe('avatar');
    expect(capturedBody.video_inputs[0].character.avatar_id).toBe(DEFAULTS.heygen.avatar_id);
    expect(capturedBody.video_inputs[0].voice.type).toBe('text');
    expect(capturedBody.video_inputs[0].voice.voice_id).toBe(DEFAULTS.heygen.voice_id);
    expect(capturedBody.video_inputs[0].voice.speed).toBe(1.0);
    expect(capturedBody.video_inputs[0].background.value).toBe('#FAF9F6');
    expect(capturedBody.dimension).toEqual({ width: 1920, height: 1080 });
    expect(capturedBody.aspect_ratio).toBe('16:9');

    // Verify headers
    expect(capturedHeaders['X-Api-Key']).toBe('my-api-key');
    expect(capturedHeaders['Content-Type']).toBe('application/json');

    // Script should be sanitized (no HTML tags)
    expect(capturedBody.video_inputs[0].voice.input_text).not.toContain('<p>');
  });

  it('submitVideo handles API failure gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limited',
    });

    const client = new HeyGenClient('key', DEFAULTS.heygen);
    const result = await client.submitVideo('<p>Test</p>', 's1');

    expect(result.status).toBe('failed');
    expect(result.error).toContain('429');
  });

  it('pollVideoStatus returns status from API', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          status: 'completed',
          video_url: 'https://cdn.heygen.com/video.mp4',
          thumbnail_url: 'https://cdn.heygen.com/thumb.jpg',
          duration: 142,
        },
      }),
    });

    const client = new HeyGenClient('key', DEFAULTS.heygen);
    const status = await client.pollVideoStatus('vid-123');

    expect(status.status).toBe('completed');
    expect(status.video_url).toBe('https://cdn.heygen.com/video.mp4');
    expect(status.duration).toBe(142);
  });
});

// ── awaitAllVideos ──────────────────────────────────────────────────────────

describe('awaitAllVideos', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('handles 2 completed + 1 failed scenario', async () => {
    const pollCounts = { 'vid-1': 0, 'vid-2': 0, 'vid-3': 0 };

    globalThis.fetch = vi.fn().mockImplementation(async (url) => {
      if (url.includes('video_status')) {
        const vidId = url.match(/video_id=([^&]+)/)?.[1];
        pollCounts[vidId] = (pollCounts[vidId] || 0) + 1;

        if (vidId === 'vid-1') {
          return {
            ok: true,
            json: async () => ({
              data: { status: 'completed', video_url: 'https://cdn.heygen.com/v1.mp4', duration: 120 },
            }),
          };
        }
        if (vidId === 'vid-2') {
          return {
            ok: true,
            json: async () => ({
              data: { status: 'completed', video_url: 'https://cdn.heygen.com/v2.mp4', duration: 90 },
            }),
          };
        }
        if (vidId === 'vid-3') {
          return {
            ok: true,
            json: async () => ({
              data: { status: 'failed', error: 'Generation error' },
            }),
          };
        }
      }

      // Download mock
      return {
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('fake video'));
            controller.close();
          },
        }),
      };
    });

    const outputDir = path.join(os.tmpdir(), `poller-test-${Date.now()}`);
    fs.mkdirSync(outputDir, { recursive: true });

    const jobs = [
      { video_id: 'vid-1', status: 'processing', section_id: 's1', script_hash: 'h1' },
      { video_id: 'vid-2', status: 'processing', section_id: 's2', script_hash: 'h2' },
      { video_id: 'vid-3', status: 'processing', section_id: 's3', script_hash: 'h3' },
    ];

    // Use tiny poll interval and timeout for testing
    const config = {
      heygen: { ...DEFAULTS.heygen, poll_interval_ms: 10, timeout_ms: 5000 },
    };

    const cacheDir = path.join(os.tmpdir(), `poller-cache-${Date.now()}`);
    const client = new HeyGenClient('key', config.heygen, new VideoCache(cacheDir));

    // Suppress console.warn/log during test
    const origWarn = console.warn;
    const origLog = console.log;
    console.warn = () => {};
    console.log = () => {};

    const result = await awaitAllVideos(jobs, client, config, outputDir);

    console.warn = origWarn;
    console.log = origLog;

    // Check results
    const s1 = result.find(j => j.section_id === 's1');
    const s2 = result.find(j => j.section_id === 's2');
    const s3 = result.find(j => j.section_id === 's3');

    expect(s1.status).toBe('completed');
    expect(s2.status).toBe('completed');
    expect(s3.status).toBe('failed');

    expect(s1.duration).toBe(120);
    expect(s2.duration).toBe(90);

    // Cleanup
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }, 10000);

  it('handles already-completed (cached) jobs', async () => {
    const jobs = [
      { video_id: null, status: 'completed', section_id: 's1', cached: true },
    ];

    const config = { heygen: { ...DEFAULTS.heygen, poll_interval_ms: 10 } };
    const client = new HeyGenClient('key', config.heygen);

    const result = await awaitAllVideos(jobs, client, config, '/tmp');

    expect(result[0].status).toBe('completed');
  });

  it('handles jobs with no video_id', async () => {
    const jobs = [
      { video_id: null, status: 'processing', section_id: 's1', script_hash: 'h1' },
    ];

    const config = { heygen: { ...DEFAULTS.heygen, poll_interval_ms: 10 } };
    const client = new HeyGenClient('key', config.heygen);

    const origWarn = console.warn;
    console.warn = () => {};
    const result = await awaitAllVideos(jobs, client, config, '/tmp');
    console.warn = origWarn;

    expect(result[0].status).toBe('failed');
  });
});

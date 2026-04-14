/**
 * heygen.js — HeyGen API v2 client for talking-head video generation.
 *
 * Submits video generation jobs, polls for completion, and downloads results.
 * Integrates with VideoCache to avoid duplicate generation.
 *
 * See: ADR-003  (Asynchronous HeyGen Video Pipeline)
 *      ADR-006  (Video Caching by Script Hash)
 */

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { sanitizeForTTS } from './tts-sanitizer.js';
import { VideoCache } from './cache.js';

const HEYGEN_API_BASE = 'https://api.heygen.com';

export class HeyGenClient {
  /**
   * @param {string} apiKey — HeyGen API key
   * @param {object} heygenConfig — config.heygen options
   * @param {VideoCache} [cache] — optional cache instance
   */
  constructor(apiKey, heygenConfig, cache = null) {
    this.apiKey = apiKey;
    this.config = heygenConfig;
    this.cache = cache || new VideoCache();
  }

  /**
   * Submit a video generation request to HeyGen.
   *
   * @param {string} script — raw HTML lecturer script
   * @param {string} sectionId — e.g. "s1"
   * @param {object} [options] — avatar/voice overrides
   * @returns {Promise<object>} job descriptor
   */
  async submitVideo(script, sectionId, options = {}) {
    const cleanScript = sanitizeForTTS(script);
    const avatarId = options.avatar || this.config.avatar_id;
    const voiceId = options.voice || this.config.voice_id;
    const scriptHash = this.cache.computeHash(cleanScript, avatarId, voiceId);

    // Check cache
    if (this.cache.has(scriptHash)) {
      const cached = this.cache.get(scriptHash);
      return {
        video_id: null,
        status: 'completed',
        script_hash: scriptHash,
        section_id: sectionId,
        video_url: null,
        local_path: cached.videoPath,
        cached: true,
      };
    }

    // Build HeyGen API payload
    const payload = {
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: avatarId,
          avatar_style: 'normal',
        },
        voice: {
          type: 'text',
          input_text: cleanScript,
          voice_id: voiceId,
          speed: 1.0,
        },
        background: {
          type: 'color',
          value: this.config.background_color || '#FAF9F6',
        },
      }],
      dimension: this.config.resolution || { width: 1920, height: 1080 },
      aspect_ratio: '16:9',
    };

    const response = await fetch(`${HEYGEN_API_BASE}/v2/video/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      console.warn(`HeyGen submission failed for ${sectionId}: ${response.status} ${body}`);
      return {
        video_id: null,
        status: 'failed',
        script_hash: scriptHash,
        section_id: sectionId,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      video_id: data.data?.video_id || null,
      status: 'processing',
      script_hash: scriptHash,
      section_id: sectionId,
    };
  }

  /**
   * Poll for a video generation job's status.
   *
   * @param {string} videoId — HeyGen video ID
   * @returns {Promise<object>} status object
   */
  async pollVideoStatus(videoId) {
    const response = await fetch(
      `${HEYGEN_API_BASE}/v1/video_status.get?video_id=${videoId}`,
      {
        headers: { 'X-Api-Key': this.apiKey },
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      return { status: 'error', error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      status: data.data?.status || 'unknown',
      video_url: data.data?.video_url || null,
      thumbnail_url: data.data?.thumbnail_url || null,
      duration: data.data?.duration || null,
    };
  }

  /**
   * Download a completed video to a local file path.
   *
   * @param {string} videoUrl — URL of the completed video
   * @param {string} outputPath — local file path to write
   * @param {string} scriptHash — for caching
   * @returns {Promise<string>} the output file path
   */
  async downloadVideo(videoUrl, outputPath, scriptHash) {
    const response = await fetch(videoUrl, {
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to download video: HTTP ${response.status}`);
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const fileStream = fs.createWriteStream(outputPath);
    await pipeline(Readable.fromWeb(response.body), fileStream);

    // Store in cache
    if (scriptHash) {
      this.cache.set(scriptHash, outputPath, {
        downloaded_at: new Date().toISOString(),
        source_url: videoUrl,
      });
    }

    return outputPath;
  }
}

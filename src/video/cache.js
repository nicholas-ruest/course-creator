/**
 * cache.js — Content-addressed video cache keyed on script hash.
 *
 * Caches generated HeyGen videos by SHA-256(script + avatar + voice) to
 * avoid re-generating identical videos.
 *
 * See: ADR-006  (Video Caching by Script Hash)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CACHE_DIR = '.course-creator-cache/videos';

export class VideoCache {
  /**
   * @param {string} [cacheDir] — path to the cache directory
   */
  constructor(cacheDir = DEFAULT_CACHE_DIR) {
    this.cacheDir = path.resolve(cacheDir);
  }

  /**
   * Compute a SHA-256 cache key from the script content, avatar, and voice.
   * Normalizes by trimming and collapsing whitespace.
   */
  computeHash(script, avatarId, voiceId) {
    const normalized = (script || '').trim().replace(/\s+/g, ' ');
    const input = normalized + '|' + (avatarId || '') + '|' + (voiceId || '');
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Check if a cached video exists for the given hash.
   */
  has(hash) {
    return fs.existsSync(path.join(this.cacheDir, `${hash}.mp4`));
  }

  /**
   * Retrieve a cached video and its metadata.
   * @returns {{ videoPath: string, metadata: object } | null}
   */
  get(hash) {
    const videoPath = path.join(this.cacheDir, `${hash}.mp4`);
    const metaPath = path.join(this.cacheDir, `${hash}.json`);

    if (!fs.existsSync(videoPath)) return null;

    let metadata = {};
    try {
      metadata = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
      // metadata is optional
    }

    return { videoPath, metadata };
  }

  /**
   * Store a video file and metadata in the cache.
   *
   * @param {string} hash — cache key
   * @param {string} videoPath — path to the source video file
   * @param {object} metadata — metadata to store alongside
   */
  set(hash, videoPath, metadata = {}) {
    fs.mkdirSync(this.cacheDir, { recursive: true });

    const cachedVideoPath = path.join(this.cacheDir, `${hash}.mp4`);
    const cachedMetaPath = path.join(this.cacheDir, `${hash}.json`);

    // Copy video to cache (don't move — caller may need the original)
    fs.copyFileSync(videoPath, cachedVideoPath);
    fs.writeFileSync(cachedMetaPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }
}

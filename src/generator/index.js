/**
 * generator/index.js — Write generated course artifacts to disk.
 *
 * Implements the output logic from ADR-001:
 *   - No video: write courses/{slug}.html (single file)
 *   - With video: create courses/{slug}/ directory with index.html,
 *     videos/ subdirectory, and manifest.json
 *
 * See: ADR-001  (Single-File HTML Output with Sidecar Video Directory)
 */

import fs from 'node:fs';
import path from 'node:path';
import { buildManifest } from './course-data.js';

/**
 * Write a generated course to disk.
 *
 * @param {string} html — the complete course HTML
 * @param {string} slug — kebab-case topic slug
 * @param {object} courseData — COURSE_DATA object (for manifest)
 * @param {object|null} videoManifest — video generation results (null if no video)
 * @param {object} config — resolved configuration
 * @returns {{ htmlPath: string, manifestPath: string|null, courseDir: string }}
 */
export async function writeCourseToDisk(html, slug, courseData, videoManifest, config) {
  const outputDir = path.resolve(config.output.dir);

  // Ensure the output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  if (videoManifest) {
    // Video mode: create a directory structure
    const courseDir = path.join(outputDir, slug);
    const videosDir = path.join(courseDir, config.output.video_dir);
    fs.mkdirSync(videosDir, { recursive: true });

    const htmlPath = path.join(courseDir, 'index.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');

    const manifest = buildManifest(courseData, videoManifest);
    const fileSizeKb = Math.round(fs.statSync(htmlPath).size / 1024);
    manifest.file_size_kb = fileSizeKb;

    const manifestPath = path.join(courseDir, config.output.manifest_file);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    return { htmlPath, manifestPath, courseDir };
  } else {
    // No video: single HTML file
    const htmlPath = path.join(outputDir, `${slug}.html`);
    fs.writeFileSync(htmlPath, html, 'utf-8');

    return { htmlPath, manifestPath: null, courseDir: outputDir };
  }
}

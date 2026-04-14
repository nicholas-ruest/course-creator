/**
 * template.js — Load and fill the agentics-shell.html template.
 *
 * See: ADR-001  (Single-File HTML Output)
 *      DDD-006  (Brand System Extension)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.resolve(__dirname, '../../resources/templates/agentics-shell.html');

/**
 * Read the agentics-shell.html template and return it as a string.
 *
 * @returns {string} raw template HTML
 */
export function loadTemplate() {
  return fs.readFileSync(TEMPLATE_PATH, 'utf-8');
}

/**
 * Replace template placeholders with actual values.
 *
 * Placeholders:
 *   {{COURSE_TITLE}}     — course title string
 *   {{AVATAR_EMOJI}}     — instructor emoji
 *   {{INSTRUCTOR_NAME}}  — instructor persona name
 *   {{COURSE_DATA_JSON}} — the full COURSE_DATA object as JSON
 *
 * @param {string} html — template HTML
 * @param {object} data — { title, instructor: { emoji, name }, courseData }
 * @returns {string} HTML with placeholders replaced
 */
export function fillPlaceholders(html, data) {
  const courseDataJson = JSON.stringify(data.courseData, null, 2);

  return html
    .replaceAll('{{COURSE_TITLE}}', escapeHTML(data.title))
    .replaceAll('{{AVATAR_EMOJI}}', data.instructor.emoji)
    .replaceAll('{{INSTRUCTOR_NAME}}', escapeHTML(data.instructor.name))
    .replace('{{COURSE_DATA_JSON}}', courseDataJson);
}

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

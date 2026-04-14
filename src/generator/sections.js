/**
 * sections.js — Generate the HTML for individual course sections.
 *
 * Follows the exact component structure from agentics-shell.html:
 *   section-label, h2, content, analogy, code blocks, demo container,
 *   vernacular box (MANDATORY), key insight.
 *
 * See: SPARC.md Section 2.5  (HTML Generation pseudocode)
 *      SKILL.md "Terminology Integration" (term wrapping rules)
 */

import { escapeHTML } from './template.js';
import { generateActivityHTML } from './activities.js';

/**
 * Generate the complete HTML for one course section.
 *
 * @param {object} section — section from the unified outline
 * @param {number} index — 0-based section index
 * @param {object[]} glossary — full glossary array for term wrapping
 * @returns {string} HTML string
 */
export function generateSectionHTML(section, index, glossary = []) {
  const num = String(index + 1).padStart(2, '0');
  const title = escapeHTML(section.title || `Section ${index + 1}`);
  const id = section.id || `s${index + 1}`;

  const parts = [];

  // Section wrapper open
  parts.push(`<div class="section" data-section="${escapeHTML(id)}">`);

  // Section label + heading
  parts.push(`  <div class="section-label">${num} — ${title}</div>`);
  parts.push(`  <h2>${title}</h2>`);

  // Content paragraphs
  if (section.content) {
    parts.push(wrapTerms(section.content, id, glossary));
  } else if (section.contentHtml) {
    parts.push(wrapTerms(section.contentHtml, id, glossary));
  }

  // Analogy box
  if (section.analogy) {
    parts.push(`  <div class="analogy"><p>${escapeHTML(section.analogy)}</p></div>`);
  }

  // Code blocks
  if (section.codeBlocks && section.codeBlocks.length > 0) {
    for (const block of section.codeBlocks) {
      const lang = escapeHTML(block.language || '');
      const code = escapeHTML(block.code || '');
      const filePath = block.filePath ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-bottom:4px;font-family:var(--font-mono);">File: ${escapeHTML(block.filePath)}</div>` : '';
      parts.push(`  <div class="code-block">`);
      if (lang) parts.push(`    <span class="lang-tag">${lang}</span>`);
      if (filePath) parts.push(`    ${filePath}`);
      parts.push(`    <pre>${code}</pre>`);
      parts.push(`  </div>`);
    }
  }

  // Demo container (visualization)
  if (section.visualization) {
    const viz = section.visualization;
    const vizTitle = escapeHTML(viz.title || 'Interactive Demo');
    parts.push(`  <div class="demo-container">`);
    parts.push(`    <div class="demo-header">`);
    parts.push(`      <div class="dots"><span></span><span></span><span></span></div>`);
    parts.push(`      <span class="demo-title">${vizTitle}</span>`);
    parts.push(`    </div>`);
    parts.push(`    <div class="demo-body">`);
    parts.push(`      <canvas id="viz-${escapeHTML(id)}" width="600" height="300"></canvas>`);
    parts.push(`      <p class="print-fallback">${escapeHTML(viz.description || vizTitle)}</p>`);
    parts.push(`    </div>`);
    parts.push(`  </div>`);
  }

  // Activity cards — injected between demo/code and vernacular
  const activities = section.activities || [];
  for (const activity of activities) {
    parts.push(generateActivityHTML(activity));
  }

  // Vernacular box — MANDATORY per section
  const terms = section.terms || [];
  parts.push(`  <div class="vernacular">`);
  parts.push(`    <div class="vernacular-header">Terminology</div>`);
  parts.push(`    <dl>`);
  if (terms.length > 0) {
    for (const term of terms) {
      parts.push(`      <dt>${escapeHTML(term.term)}</dt><dd>${escapeHTML(term.definition)}</dd>`);
    }
  } else {
    parts.push(`      <dt>—</dt><dd>No new terms in this section</dd>`);
  }
  parts.push(`    </dl>`);
  parts.push(`  </div>`);

  // Key insight
  if (section.keyInsight) {
    parts.push(`  <div class="key-insight">`);
    parts.push(`    <div class="key-insight-header">Key Insight</div>`);
    parts.push(`    <p>${escapeHTML(section.keyInsight)}</p>`);
    parts.push(`  </div>`);
  }

  // Section wrapper close
  parts.push(`</div>`);

  return parts.join('\n');
}

/**
 * Generate the citations section HTML.
 *
 * @param {object[]} citations — from the unified outline
 * @returns {string} HTML string for the citations section
 */
export function generateCitationsHTML(citations) {
  if (!citations || citations.length === 0) return '';

  const items = citations.map((cite) => {
    const title = escapeHTML(cite.title || '');
    const url = escapeHTML(cite.url || '#');
    const relevance = escapeHTML(cite.relevance || '');
    const accessed = escapeHTML(cite.accessed || '');
    return `      <li id="cite-${escapeHTML(cite.id)}"><a href="${url}" target="_blank" rel="noopener">${title}</a> — ${relevance} <small>(accessed ${accessed})</small></li>`;
  });

  return items.join('\n');
}

/**
 * Generate the nav list items for the lecturer pane.
 *
 * @param {object[]} sections — from the unified outline
 * @returns {string} HTML <li> items
 */
export function generateNavHTML(sections) {
  return sections.map((section, i) => {
    const id = escapeHTML(section.id || `s${i + 1}`);
    const title = escapeHTML(section.title || `Section ${i + 1}`);
    const active = i === 0 ? ' class="active"' : '';
    return `      <li data-section="${id}"${active}>${i + 1}. ${title}</li>`;
  }).join('\n');
}

// ── Term wrapping ───────────────────────────────────────────────────────────

/**
 * Wrap the first occurrence of each glossary term in a section's content
 * with a .term span and .term-tooltip.
 *
 * Only wraps the FIRST occurrence per section per SKILL.md rules.
 * Does not wrap inside existing HTML tags.
 */
function wrapTerms(html, sectionId, glossary) {
  if (!glossary || glossary.length === 0) return html;

  let result = html;
  const wrapped = new Set();

  // Sort terms by length descending to match longer terms first
  const sortedTerms = [...glossary].sort(
    (a, b) => b.term.length - a.term.length,
  );

  for (const entry of sortedTerms) {
    if (wrapped.has(entry.term.toLowerCase())) continue;

    // Match the term as a whole word, not inside HTML tags
    const escaped = entry.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<![<\\w])\\b(${escaped})\\b(?![^<]*>)`, 'i');
    const match = result.match(regex);

    if (match) {
      const termHtml = escapeHTML(entry.term);
      const category = escapeHTML(entry.category || 'concept');
      const definition = escapeHTML(entry.definition || '');

      const tooltip =
        `<span class="term" data-term="${termHtml}" tabindex="0">${match[0]}` +
        `<span class="term-tooltip">` +
        `<div class="term-name">${termHtml}</div>` +
        `<div class="term-category">${category}</div>` +
        `${definition}` +
        `</span></span>`;

      result = result.replace(match[0], tooltip);
      wrapped.add(entry.term.toLowerCase());
    }
  }

  return result;
}

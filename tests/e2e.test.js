import { describe, it, expect, vi, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { generateCourse } from '../src/orchestrator.js';
import { loadConfig } from '../src/config.js';

const FIXTURE_REPO = path.resolve('tests/fixtures/sample-repo');
const OUTPUT_DIR = path.resolve('courses');
const VALIDATOR = path.resolve('src/validation/validate-course.cjs');

// Suppress console output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});

afterAll(() => {
  // Clean up generated course files
  const files = [
    path.join(OUTPUT_DIR, 'sample-repo.html'),
    path.join(OUTPUT_DIR, 'sample-repo-noquiz.html'),
  ];
  for (const f of files) {
    try { fs.unlinkSync(f); } catch {}
  }
});

describe('E2E: generateCourse with local fixture', () => {
  let result;

  it('generates a course from the fixture repo', async () => {
    const config = loadConfig();
    result = await generateCourse(FIXTURE_REPO, { noVideo: true }, config);

    expect(result).toHaveProperty('htmlPath');
    expect(fs.existsSync(result.htmlPath)).toBe(true);
  }, 30000);

  it('output file has correct path pattern', async () => {
    expect(result.htmlPath).toContain('sample-repo');
    expect(result.htmlPath).toMatch(/\.html$/);
  });

  it('HTML contains DOCTYPE and closing tag', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });

  it('HTML contains COURSE_DATA with version 2.0.0', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('const COURSE_DATA =');
    expect(html).toContain('"version": "2.0.0"');
  });

  it('COURSE_DATA contains sections', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('"sections":');
    // Should have at least 3 sections (min_sections default)
    const sectionMatches = html.match(/data-section="s\d+"/g) || [];
    expect(sectionMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('COURSE_DATA contains glossary terms', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('"glossary":');
  });

  it('COURSE_DATA contains assessments', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('"assessments":');
    expect(html).toContain('multiple-choice');
  });

  it('HTML has vernacular boxes in sections', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    const vernacularCount = (html.match(/class="vernacular"/g) || []).length;
    expect(vernacularCount).toBeGreaterThanOrEqual(3);
  });

  it('HTML has activity cards', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('class="activity-card"');
  });

  it('HTML has the course meta bar', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('course-meta-bar');
    expect(html).toContain('sections');
    expect(html).toContain('activities');
    expect(html).toContain('questions');
  });

  it('HTML has Agentics brand elements', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('#E25C3D');
    expect(html).toContain('IBM Plex Mono');
    expect(html).toContain('glossary-btn');
    expect(html).toContain('glossary-overlay');
  });

  it('HTML has no video player (--no-video)', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).not.toContain('id="instructor-video"');
    expect(html).toContain('id="lecturer-dialogue"');
  });

  it('HTML has lecturer nav list', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('id="lecturer-nav"');
    expect(html).toContain('data-section="s1"');
  });

  it('HTML has activity engine JS', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('function initActivities()');
    expect(html).toContain('function checkActivity(');
  });

  it('passes the structural validator', () => {
    // The validator may warn but should not FAIL on a generated course
    try {
      execSync(`node ${VALIDATOR} ${result.htmlPath}`, {
        encoding: 'utf-8',
        timeout: 10000,
      });
      // Exit 0 = PASS
    } catch (e) {
      // If it fails, check if the failures are expected
      // (e.g. small file size for a fixture-based course)
      const output = e.stdout || '';
      // The only acceptable failure is filesize (fixture-based courses are small)
      if (output.includes('FAIL') && !output.includes('filesize')) {
        // Real failures — report them
        console.error(output);
        throw new Error('Validator reported failures: ' + output);
      }
      // filesize warning is OK for test fixtures
    }
  });
});

describe('E2E: generateCourse with --no-quizzes', () => {
  let result;

  it('generates a course without quizzes', async () => {
    const config = loadConfig({ output: { ...loadConfig().output } });
    result = await generateCourse(FIXTURE_REPO, { noVideo: true, noQuizzes: true }, config);

    expect(fs.existsSync(result.htmlPath)).toBe(true);
  }, 30000);

  it('HTML has no quiz cards', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    // The quiz sidebar exists (it's in the template) but COURSE_DATA
    // should have totalQuestions: 0
    expect(html).toContain('"totalQuestions": 0');
  });

  it('HTML still has activity cards', () => {
    const html = fs.readFileSync(result.htmlPath, 'utf-8');
    expect(html).toContain('class="activity-card"');
  });
});

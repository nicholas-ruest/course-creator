import { describe, it, expect } from 'vitest';
import { DEFAULTS, loadConfig } from '../src/config.js';

describe('DEFAULTS', () => {
  it('has all top-level sections', () => {
    expect(DEFAULTS).toHaveProperty('heygen');
    expect(DEFAULTS).toHaveProperty('ingestion');
    expect(DEFAULTS).toHaveProperty('course');
    expect(DEFAULTS).toHaveProperty('output');
  });

  it('heygen defaults match SPARC spec', () => {
    expect(DEFAULTS.heygen.avatar_id).toBe('Daisy-inskirt-20220818');
    expect(DEFAULTS.heygen.voice_id).toBe('en-US-JennyNeural');
    expect(DEFAULTS.heygen.background_color).toBe('#FAF9F6');
    expect(DEFAULTS.heygen.resolution).toEqual({ width: 1920, height: 1080 });
    expect(DEFAULTS.heygen.max_script_words).toBe(400);
    expect(DEFAULTS.heygen.poll_interval_ms).toBe(15000);
    expect(DEFAULTS.heygen.timeout_ms).toBe(600000);
    expect(DEFAULTS.heygen.max_retries).toBe(3);
  });

  it('ingestion defaults match SPARC spec', () => {
    expect(DEFAULTS.ingestion.token_budget).toBe(100000);
    expect(DEFAULTS.ingestion.max_files).toBe(500);
    expect(DEFAULTS.ingestion.max_file_size_bytes).toBe(102400);
    expect(DEFAULTS.ingestion.max_repo_size_mb).toBe(500);
    expect(DEFAULTS.ingestion.clone_depth).toBe(1);
    expect(DEFAULTS.ingestion.max_crawl_pages).toBe(20);
  });

  it('course defaults match SPARC spec', () => {
    expect(DEFAULTS.course.min_sections).toBe(3);
    expect(DEFAULTS.course.max_sections).toBe(12);
    expect(DEFAULTS.course.default_sections).toBe('auto');
    expect(DEFAULTS.course.assessments_per_section).toBe(2);
    expect(DEFAULTS.course.activities_per_section).toBe(1);
    expect(DEFAULTS.course.min_font_size_rem).toBe(0.8);
    expect(DEFAULTS.course.target_file_size_kb).toBe(300);
  });

  it('output defaults match SPARC spec', () => {
    expect(DEFAULTS.output.dir).toBe('courses');
    expect(DEFAULTS.output.video_dir).toBe('videos');
    expect(DEFAULTS.output.manifest_file).toBe('manifest.json');
  });
});

describe('loadConfig', () => {
  it('returns defaults when no overrides given', () => {
    const config = loadConfig();
    expect(config.heygen.avatar_id).toBe(DEFAULTS.heygen.avatar_id);
    expect(config.ingestion.token_budget).toBe(100000);
    expect(config.course.max_sections).toBe(12);
    expect(config.output.dir).toBe('courses');
  });

  it('deep-merges nested overrides without clobbering siblings', () => {
    const config = loadConfig({
      heygen: { avatar_id: 'custom-avatar' },
    });
    expect(config.heygen.avatar_id).toBe('custom-avatar');
    expect(config.heygen.voice_id).toBe('en-US-JennyNeural');
    expect(config.heygen.max_script_words).toBe(400);
  });

  it('replaces primitive values', () => {
    const config = loadConfig({
      ingestion: { token_budget: 50000 },
      course: { max_sections: 20 },
    });
    expect(config.ingestion.token_budget).toBe(50000);
    expect(config.course.max_sections).toBe(20);
    expect(config.ingestion.max_files).toBe(500);
  });

  it('replaces array and object values wholesale', () => {
    const config = loadConfig({
      heygen: { resolution: { width: 1280, height: 720 } },
    });
    expect(config.heygen.resolution).toEqual({ width: 1280, height: 720 });
  });

  it('injects environment variables', () => {
    const origHeygen = process.env.HEYGEN_API_KEY;
    const origGithub = process.env.GITHUB_TOKEN;
    process.env.HEYGEN_API_KEY = 'test-heygen-key';
    process.env.GITHUB_TOKEN = 'test-github-token';

    const config = loadConfig();
    expect(config.heygen_api_key).toBe('test-heygen-key');
    expect(config.github_token).toBe('test-github-token');

    // Restore
    if (origHeygen === undefined) delete process.env.HEYGEN_API_KEY;
    else process.env.HEYGEN_API_KEY = origHeygen;
    if (origGithub === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = origGithub;
  });

  it('sets env vars to null when not present', () => {
    const origHeygen = process.env.HEYGEN_API_KEY;
    const origGithub = process.env.GITHUB_TOKEN;
    delete process.env.HEYGEN_API_KEY;
    delete process.env.GITHUB_TOKEN;

    const config = loadConfig();
    expect(config.heygen_api_key).toBeNull();
    expect(config.github_token).toBeNull();

    if (origHeygen !== undefined) process.env.HEYGEN_API_KEY = origHeygen;
    if (origGithub !== undefined) process.env.GITHUB_TOKEN = origGithub;
  });
});

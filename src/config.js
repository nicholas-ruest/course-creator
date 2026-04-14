/**
 * config.js — Configuration module with defaults and environment variable loading.
 *
 * Exports:
 *   DEFAULTS  — The full default configuration object (SPARC.md Section 4.6)
 *   loadConfig(overrides) — Deep-merge user overrides onto DEFAULTS
 */

export const DEFAULTS = {
  heygen: {
    avatar_id: 'Daisy-inskirt-20220818',
    voice_id: 'en-US-JennyNeural',
    background_color: '#FAF9F6',
    resolution: { width: 1920, height: 1080 },
    max_script_words: 400,
    poll_interval_ms: 15000,
    timeout_ms: 600000,
    max_retries: 3,
  },

  ingestion: {
    token_budget: 100000,
    max_files: 500,
    max_file_size_bytes: 102400,
    max_repo_size_mb: 500,
    clone_depth: 1,
    max_crawl_pages: 20,
  },

  course: {
    min_sections: 3,
    max_sections: 12,
    default_sections: 'auto',
    assessments_per_section: 2,
    activities_per_section: 1,
    min_font_size_rem: 0.8,
    target_file_size_kb: 300,
  },

  output: {
    dir: 'courses',
    video_dir: 'videos',
    manifest_file: 'manifest.json',
  },
};

/**
 * Deep-merge `overrides` onto a clone of DEFAULTS.
 * Only plain objects are recursed; arrays and primitives are replaced wholesale.
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal, srcVal);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}

/**
 * Build a resolved configuration by merging user overrides onto DEFAULTS
 * and injecting environment variables.
 *
 * @param {object} [overrides] — Partial config to overlay
 * @returns {object} Fully resolved configuration
 */
export function loadConfig(overrides = {}) {
  const config = deepMerge(DEFAULTS, overrides);

  config.heygen_api_key = process.env.HEYGEN_API_KEY || null;
  config.github_token = process.env.GITHUB_TOKEN || null;

  return config;
}

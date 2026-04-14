/**
 * classifier.js — Parse a source string into a structured descriptor.
 *
 * The classifier applies an ordered list of regex patterns. The first match
 * wins. Ambiguous bare-word inputs (no prefix, no slash) are rejected with
 * a helpful error.
 *
 * See: ADR-004  (Multi-Source Ingestion with Unified ContentBundle)
 *      DDD-003  (Ingestion Pipeline — "Input Classification")
 */

// Patterns are checked in order; first match wins.
// local_path is checked before slugs because `./foo/bar` would otherwise
// match github_slug_with_path (`.` is in the [\w.-] character class).
const PATTERNS = [
  {
    name: 'github_url',
    regex: /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+))?)?$/,
    extract: (m) => ({
      type: 'github_url',
      owner: m[1],
      repo: m[2],
      branch: m[3] || null,
      path: m[4] || null,
    }),
  },
  {
    name: 'npm_package',
    regex: /^npm:([@\w.-]+(?:\/[\w.-]+)?)/,
    extract: (m) => ({
      type: 'npm_package',
      package: m[1],
    }),
  },
  {
    name: 'pypi_package',
    regex: /^pypi:([\w.-]+)/,
    extract: (m) => ({
      type: 'pypi_package',
      package: m[1],
    }),
  },
  {
    name: 'documentation_url',
    regex: /^https?:\/\/.+/,
    extract: (m) => ({
      type: 'documentation_url',
      url: m[0],
    }),
  },
  {
    name: 'local_path',
    regex: /^\.?\/.+/,
    extract: (m) => ({
      type: 'local_path',
      path: m[0],
    }),
  },
  {
    name: 'github_slug_with_path',
    regex: /^([\w.-]+)\/([\w.-]+)\/(.+)/,
    extract: (m) => ({
      type: 'github_slug',
      owner: m[1],
      repo: m[2],
      path: m[3],
      branch: null,
    }),
  },
  {
    name: 'github_slug',
    regex: /^([\w.-]+)\/([\w.-]+)$/,
    extract: (m) => ({
      type: 'github_slug',
      owner: m[1],
      repo: m[2],
      path: null,
      branch: null,
    }),
  },
];

/**
 * Classify a source string into a structured descriptor.
 *
 * @param {string} input — raw source string from the user
 * @returns {object} descriptor with `type` and type-specific fields
 * @throws {Error} if input is ambiguous or unrecognised
 */
export function classifySource(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Source input is required.');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Source input is required.');
  }

  for (const pattern of PATTERNS) {
    const match = trimmed.match(pattern.regex);
    if (match) {
      return pattern.extract(match);
    }
  }

  // Nothing matched — the input is ambiguous (e.g. a bare word like "express")
  throw new Error(
    `Ambiguous source: "${trimmed}"\n\n` +
    'Could not determine source type. Use one of these formats:\n' +
    '  owner/repo              GitHub slug        (e.g. expressjs/express)\n' +
    '  npm:package-name        npm package        (e.g. npm:express)\n' +
    '  pypi:package-name       PyPI package       (e.g. pypi:fastapi)\n' +
    '  https://github.com/...  GitHub URL\n' +
    '  https://docs.example... Documentation URL\n' +
    '  ./path/to/dir           Local directory'
  );
}

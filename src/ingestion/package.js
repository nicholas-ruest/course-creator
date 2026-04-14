/**
 * package.js — npm and PyPI package ingester.
 *
 * Resolves a package name to a GitHub repository via the package registry,
 * then delegates to the GitHub ingester. Enriches the resulting ContentBundle
 * with registry metadata.
 *
 * See: ADR-004  (Multi-Source Ingestion with Unified ContentBundle)
 *      DDD-003  (Ingestion Pipeline — "Package Ingester")
 */

import { ingestGitHub } from './github.js';

/**
 * Ingest a package from npm or PyPI.
 *
 * @param {object} descriptor — { type: "npm_package"|"pypi_package", package: string }
 * @param {object} config — resolved configuration
 * @returns {Promise<object>} ContentBundle enriched with registry_metadata
 */
export async function ingestPackage(descriptor, config) {
  if (descriptor.type === 'npm_package') {
    return ingestNpm(descriptor, config);
  }
  if (descriptor.type === 'pypi_package') {
    return ingestPyPI(descriptor, config);
  }
  throw new Error(`Unknown package type: ${descriptor.type}`);
}

// ── npm ─────────────────────────────────────────────────────────────────────

async function ingestNpm(descriptor, config) {
  const packageName = descriptor.package;
  const registryUrl = `https://registry.npmjs.org/${packageName}`;

  const response = await fetch(registryUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `npm registry returned ${response.status} for "${packageName}". ` +
      'Check the package name or try providing the GitHub URL directly.',
    );
  }

  const data = await response.json();
  const latestVersion = data['dist-tags']?.latest;
  const latest = latestVersion ? data.versions?.[latestVersion] : null;

  // Resolve GitHub URL from repository field
  const repoUrl = data.repository?.url || latest?.repository?.url;
  const githubDescriptor = parseGitHubFromRepoUrl(repoUrl, packageName);

  // Clone and extract
  const bundle = await ingestGitHub(githubDescriptor, config);

  // Enrich with registry metadata
  bundle.registry_metadata = {
    name: data.name,
    version: latestVersion || 'unknown',
    description: data.description || '',
    keywords: data.keywords || [],
    dependencies: latest?.dependencies || {},
  };

  return bundle;
}

// ── PyPI ────────────────────────────────────────────────────────────────────

async function ingestPyPI(descriptor, config) {
  const packageName = descriptor.package;
  const apiUrl = `https://pypi.org/pypi/${packageName}/json`;

  const response = await fetch(apiUrl, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `PyPI returned ${response.status} for "${packageName}". ` +
      'Check the package name or try providing the GitHub URL directly.',
    );
  }

  const data = await response.json();
  const info = data.info || {};
  const projectUrls = info.project_urls || {};

  // Try to find a GitHub URL in project_urls
  const repoUrl =
    projectUrls.Source ||
    projectUrls.Repository ||
    projectUrls.Code ||
    projectUrls['Source Code'] ||
    projectUrls.Homepage ||
    null;

  const githubDescriptor = parseGitHubFromRepoUrl(repoUrl, packageName);

  const bundle = await ingestGitHub(githubDescriptor, config);

  bundle.registry_metadata = {
    name: info.name || packageName,
    version: info.version || 'unknown',
    description: info.summary || '',
    keywords: info.keywords ? info.keywords.split(',').map(k => k.trim()) : [],
    dependencies: {},
  };

  return bundle;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse a GitHub owner/repo from a repository URL string.
 *
 * Handles formats:
 *   git+https://github.com/owner/repo.git
 *   https://github.com/owner/repo
 *   git://github.com/owner/repo.git
 *   github:owner/repo
 *
 * @param {string|null} repoUrl
 * @param {string} packageName — for error messages
 * @returns {object} { type: "github_slug", owner, repo, path: null, branch: null }
 */
export function parseGitHubFromRepoUrl(repoUrl, packageName) {
  if (!repoUrl) {
    throw new Error(
      `Could not resolve a GitHub repository for "${packageName}". ` +
      'The package registry does not list a source repository. ' +
      'Try providing the GitHub URL directly.',
    );
  }

  // Normalise the URL
  let url = repoUrl
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .trim();

  // github:owner/repo shorthand
  if (url.startsWith('github:')) {
    const slug = url.slice('github:'.length);
    const parts = slug.split('/');
    if (parts.length >= 2) {
      return {
        type: 'github_slug',
        owner: parts[0],
        repo: parts[1],
        path: null,
        branch: null,
      };
    }
  }

  // Standard GitHub URL
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (match) {
    return {
      type: 'github_slug',
      owner: match[1],
      repo: match[2],
      path: null,
      branch: null,
    };
  }

  throw new Error(
    `Could not parse a GitHub repository from "${repoUrl}" for package "${packageName}". ` +
    'Try providing the GitHub URL directly.',
  );
}

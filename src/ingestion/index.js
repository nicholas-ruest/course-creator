/**
 * ingestion/index.js — Top-level ingestion entry point.
 *
 * Classifies the source string, routes to the appropriate ingester,
 * and returns a ContentBundle.
 *
 * See: ADR-004  (Multi-Source Ingestion with Unified ContentBundle)
 */

import path from 'node:path';
import { classifySource } from './classifier.js';
import { extractContentBundle } from './extractor.js';
import { ingestGitHub } from './github.js';
import { ingestURL } from './url.js';
import { ingestPackage } from './package.js';

/**
 * Ingest a source and produce a ContentBundle.
 *
 * @param {string} source — raw source string from the user
 * @param {object} config — resolved configuration from loadConfig()
 * @returns {Promise<object>} ContentBundle
 */
export async function ingest(source, config) {
  const descriptor = classifySource(source);

  switch (descriptor.type) {
    case 'github_slug':
    case 'github_url':
      return ingestGitHub(descriptor, config);

    case 'documentation_url':
      return ingestURL(descriptor, config);

    case 'npm_package':
    case 'pypi_package':
      return ingestPackage(descriptor, config);

    case 'local_path': {
      const absPath = path.resolve(descriptor.path);
      return extractContentBundle(absPath, descriptor, config);
    }

    default:
      throw new Error(`Unknown source type: ${descriptor.type}`);
  }
}

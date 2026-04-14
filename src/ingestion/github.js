/**
 * github.js — GitHub repository ingester.
 *
 * Clones a GitHub repository (or a sparse subdirectory) into a temp directory,
 * then delegates to the ContentBundle extractor.
 *
 * See: ADR-004  (Multi-Source Ingestion with Unified ContentBundle)
 *      DDD-003  (Ingestion Pipeline — "GitHub Ingester")
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { extractContentBundle } from './extractor.js';

const CLONE_TIMEOUT_MS = 60_000;

/**
 * Clone a GitHub repository and extract a ContentBundle.
 *
 * @param {object} descriptor — from classifySource(), must have owner + repo
 * @param {object} config — resolved configuration
 * @returns {Promise<object>} ContentBundle
 */
export async function ingestGitHub(descriptor, config) {
  const { owner, repo, branch, path: subPath } = descriptor;
  const tempDir = path.join(
    os.tmpdir(),
    `course-creator-${crypto.randomBytes(6).toString('hex')}`,
  );

  try {
    cloneRepo(owner, repo, branch, subPath, tempDir, config);

    const workspacePath = subPath
      ? path.join(tempDir, subPath)
      : tempDir;

    if (!fs.existsSync(workspacePath)) {
      throw new Error(
        `Subdirectory "${subPath}" does not exist in ${owner}/${repo}.`,
      );
    }

    const bundle = await extractContentBundle(workspacePath, descriptor, config);
    return bundle;
  } finally {
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

/**
 * Clone the repository using git or gh CLI.
 */
function cloneRepo(owner, repo, branch, subPath, tempDir, config) {
  const useGh = !!config.github_token;
  const depth = config.ingestion.clone_depth || 1;
  const slug = `${owner}/${repo}`;

  if (subPath) {
    // Sparse checkout — only fetch the specified subdirectory
    const url = `https://github.com/${slug}.git`;
    const branchArgs = branch ? `--branch ${branch}` : '';
    const cloneCmd =
      `git clone --depth ${depth} --filter=blob:none --sparse ${branchArgs} ${url} ${tempDir}`;

    exec(cloneCmd);
    exec(`git -C ${tempDir} sparse-checkout set ${subPath}`);
  } else if (useGh) {
    const branchArgs = branch ? `-- --depth ${depth} --branch ${branch}` : `-- --depth ${depth}`;
    exec(`gh repo clone ${slug} ${tempDir} ${branchArgs}`);
  } else {
    const url = `https://github.com/${slug}.git`;
    const branchArgs = branch ? `--branch ${branch}` : '';
    exec(`git clone --depth ${depth} ${branchArgs} ${url} ${tempDir}`);
  }
}

/**
 * Execute a shell command with the clone timeout.
 */
function exec(cmd) {
  execSync(cmd, {
    timeout: CLONE_TIMEOUT_MS,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

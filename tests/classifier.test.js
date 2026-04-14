import { describe, it, expect } from 'vitest';
import { classifySource } from '../src/ingestion/classifier.js';

// ── GitHub slugs ───────────────────────────────────────────────────────────

describe('GitHub slug', () => {
  it('parses owner/repo', () => {
    expect(classifySource('anthropics/claude-code')).toEqual({
      type: 'github_slug',
      owner: 'anthropics',
      repo: 'claude-code',
      path: null,
      branch: null,
    });
  });

  it('parses owner/repo with dots in repo name', () => {
    expect(classifySource('user/my.repo')).toEqual({
      type: 'github_slug',
      owner: 'user',
      repo: 'my.repo',
      path: null,
      branch: null,
    });
  });

  it('parses short slugs', () => {
    expect(classifySource('tj/co')).toEqual({
      type: 'github_slug',
      owner: 'tj',
      repo: 'co',
      path: null,
      branch: null,
    });
  });

  it('parses slugs with hyphens', () => {
    expect(classifySource('my-org/my-repo')).toEqual({
      type: 'github_slug',
      owner: 'my-org',
      repo: 'my-repo',
      path: null,
      branch: null,
    });
  });

  it('parses slugs with dots in owner', () => {
    expect(classifySource('org.name/repo')).toEqual({
      type: 'github_slug',
      owner: 'org.name',
      repo: 'repo',
      path: null,
      branch: null,
    });
  });
});

// ── GitHub slug with path ──────────────────────────────────────────────────

describe('GitHub slug with path', () => {
  it('parses owner/repo/path', () => {
    expect(classifySource('vercel/next.js/packages/next/src/server')).toEqual({
      type: 'github_slug',
      owner: 'vercel',
      repo: 'next.js',
      path: 'packages/next/src/server',
      branch: null,
    });
  });

  it('parses single-level subpath', () => {
    expect(classifySource('owner/repo/src')).toEqual({
      type: 'github_slug',
      owner: 'owner',
      repo: 'repo',
      path: 'src',
      branch: null,
    });
  });
});

// ── GitHub URLs ────────────────────────────────────────────────────────────

describe('GitHub URL', () => {
  it('parses full URL with branch and path', () => {
    expect(
      classifySource('https://github.com/vercel/next.js/tree/canary/packages/next')
    ).toEqual({
      type: 'github_url',
      owner: 'vercel',
      repo: 'next.js',
      branch: 'canary',
      path: 'packages/next',
    });
  });

  it('parses URL with branch only (no path)', () => {
    expect(
      classifySource('https://github.com/owner/repo/tree/main')
    ).toEqual({
      type: 'github_url',
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      path: null,
    });
  });

  it('parses bare repo URL', () => {
    expect(
      classifySource('https://github.com/anthropics/claude-code')
    ).toEqual({
      type: 'github_url',
      owner: 'anthropics',
      repo: 'claude-code',
      branch: null,
      path: null,
    });
  });

  it('handles http (not just https)', () => {
    expect(
      classifySource('http://github.com/owner/repo')
    ).toEqual({
      type: 'github_url',
      owner: 'owner',
      repo: 'repo',
      branch: null,
      path: null,
    });
  });

  it('strips .git suffix from repo name', () => {
    expect(
      classifySource('https://github.com/owner/repo.git')
    ).toEqual({
      type: 'github_url',
      owner: 'owner',
      repo: 'repo',
      branch: null,
      path: null,
    });
  });
});

// ── npm packages ───────────────────────────────────────────────────────────

describe('npm package', () => {
  it('parses simple package name', () => {
    expect(classifySource('npm:zod')).toEqual({
      type: 'npm_package',
      package: 'zod',
    });
  });

  it('parses scoped package name', () => {
    expect(classifySource('npm:@anthropic-ai/sdk')).toEqual({
      type: 'npm_package',
      package: '@anthropic-ai/sdk',
    });
  });

  it('parses package with dots and hyphens', () => {
    expect(classifySource('npm:lodash.merge')).toEqual({
      type: 'npm_package',
      package: 'lodash.merge',
    });
  });
});

// ── PyPI packages ──────────────────────────────────────────────────────────

describe('PyPI package', () => {
  it('parses simple package name', () => {
    expect(classifySource('pypi:fastapi')).toEqual({
      type: 'pypi_package',
      package: 'fastapi',
    });
  });

  it('parses package with hyphens', () => {
    expect(classifySource('pypi:scikit-learn')).toEqual({
      type: 'pypi_package',
      package: 'scikit-learn',
    });
  });
});

// ── Documentation URLs ─────────────────────────────────────────────────────

describe('Documentation URL', () => {
  it('parses generic https URL', () => {
    expect(
      classifySource('https://docs.python.org/3/library/asyncio.html')
    ).toEqual({
      type: 'documentation_url',
      url: 'https://docs.python.org/3/library/asyncio.html',
    });
  });

  it('parses http URL', () => {
    expect(
      classifySource('http://example.com/docs')
    ).toEqual({
      type: 'documentation_url',
      url: 'http://example.com/docs',
    });
  });
});

// ── Local paths ────────────────────────────────────────────────────────────

describe('Local path', () => {
  it('parses relative path with dot-slash', () => {
    expect(classifySource('./src/lib')).toEqual({
      type: 'local_path',
      path: './src/lib',
    });
  });

  it('parses absolute path', () => {
    expect(classifySource('/home/user/project')).toEqual({
      type: 'local_path',
      path: '/home/user/project',
    });
  });
});

// ── Ordering / priority ────────────────────────────────────────────────────

describe('Pattern priority', () => {
  it('GitHub URL wins over documentation URL for github.com', () => {
    const result = classifySource('https://github.com/owner/repo');
    expect(result.type).toBe('github_url');
  });

  it('Non-GitHub https URL is classified as documentation', () => {
    const result = classifySource('https://docs.example.com/api');
    expect(result.type).toBe('documentation_url');
  });

  it('owner/repo/path is slug-with-path, not slug', () => {
    const result = classifySource('owner/repo/some/path');
    expect(result.type).toBe('github_slug');
    expect(result.path).toBe('some/path');
  });

  it('owner/repo is slug (no path)', () => {
    const result = classifySource('owner/repo');
    expect(result.type).toBe('github_slug');
    expect(result.path).toBeNull();
  });
});

// ── Ambiguity rejection ────────────────────────────────────────────────────

describe('Ambiguity rejection', () => {
  it('rejects bare word with helpful error', () => {
    expect(() => classifySource('express')).toThrow(/Ambiguous source/);
    expect(() => classifySource('express')).toThrow(/npm:package-name/);
  });

  it('rejects another bare word', () => {
    expect(() => classifySource('react')).toThrow(/Ambiguous source/);
  });

  it('rejects empty string', () => {
    expect(() => classifySource('')).toThrow(/required/);
  });

  it('rejects whitespace-only string', () => {
    expect(() => classifySource('   ')).toThrow(/required/);
  });

  it('rejects null', () => {
    expect(() => classifySource(null)).toThrow(/required/);
  });

  it('rejects undefined', () => {
    expect(() => classifySource(undefined)).toThrow(/required/);
  });
});

// ── Whitespace handling ────────────────────────────────────────────────────

describe('Whitespace handling', () => {
  it('trims leading/trailing whitespace', () => {
    expect(classifySource('  anthropics/claude-code  ')).toEqual({
      type: 'github_slug',
      owner: 'anthropics',
      repo: 'claude-code',
      path: null,
      branch: null,
    });
  });
});

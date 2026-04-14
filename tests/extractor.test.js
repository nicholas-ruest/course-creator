import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import { extractContentBundle } from '../src/ingestion/extractor.js';
import { DEFAULTS } from '../src/config.js';

const FIXTURE_ROOT = path.resolve('tests/fixtures/sample-repo');
const descriptor = { type: 'local_path', path: FIXTURE_ROOT };
const config = { ingestion: DEFAULTS.ingestion };

// Suppress the console.log summary during tests
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('extractContentBundle', () => {
  let bundle;

  // Extract once, test many properties
  it('extracts a ContentBundle', async () => {
    bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    expect(bundle).toBeDefined();
    expect(bundle.source_type).toBe('local_path');
  });

  it('populates readme', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    expect(bundle.readme).toBeTruthy();
    expect(bundle.readme).toContain('Sample Repository');
  });

  it('populates package_json', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    expect(bundle.package_json).toBeTruthy();
    expect(bundle.package_json.name).toBe('sample-repo');
    expect(bundle.package_json.version).toBe('1.0.0');
  });

  it('key_files contains src/ files', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    const keyPaths = bundle.key_files.map(f => f.path);
    expect(keyPaths).toContain('src/index.js');
    expect(keyPaths).toContain('src/lib/utils.js');
  });

  it('key_files does NOT contain node_modules/ files', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    const keyPaths = bundle.key_files.map(f => f.path);
    const hasNodeModules = keyPaths.some(p => p.includes('node_modules'));
    expect(hasNodeModules).toBe(false);
  });

  it('key_files does NOT contain dist/ files', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    const keyPaths = bundle.key_files.map(f => f.path);
    const hasDist = keyPaths.some(p => p.startsWith('dist/'));
    expect(hasDist).toBe(false);
  });

  it('detects JavaScript as a language', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    const langs = bundle.languages.map(l => l.lang);
    expect(langs).toContain('JavaScript');
  });

  it('finds src/index.js as an entry point', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    expect(bundle.entry_points).toContain('src/index.js');
  });

  it('builds a file tree', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    expect(bundle.file_tree).toBeDefined();
    expect(Array.isArray(bundle.file_tree)).toBe(true);
    // Should contain top-level directories like src, tests, examples, docs
    const topNames = bundle.file_tree.map(n => n.name);
    expect(topNames).toContain('src');
    expect(topNames).toContain('tests');
    // node_modules and dist should be excluded
    expect(topNames).not.toContain('node_modules');
    expect(topNames).not.toContain('dist');
  });

  it('includes type definitions', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    expect(bundle.type_definitions.length).toBeGreaterThan(0);
    expect(bundle.type_definitions[0]).toContain('Operation');
  });

  it('includes test files', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    const testPaths = bundle.test_files.map(f => f.path);
    expect(testPaths).toContain('tests/index.test.js');
  });

  it('includes examples', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    const exPaths = bundle.examples.map(f => f.path);
    expect(exPaths).toContain('examples/demo.js');
  });

  it('includes docs', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    expect(bundle.docs.length).toBeGreaterThan(0);
    expect(bundle.docs[0]).toContain('User Guide');
  });

  it('has null registry_metadata for local paths', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    expect(bundle.registry_metadata).toBeNull();
  });

  it('key_files have correct structure', async () => {
    if (!bundle) bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, config);
    for (const kf of bundle.key_files) {
      expect(kf).toHaveProperty('path');
      expect(kf).toHaveProperty('content');
      expect(kf).toHaveProperty('language');
      expect(kf).toHaveProperty('importance_score');
      expect(typeof kf.path).toBe('string');
      expect(typeof kf.content).toBe('string');
      expect(typeof kf.language).toBe('string');
      expect(typeof kf.importance_score).toBe('number');
    }
  });
});

describe('extractContentBundle — token budget', () => {
  it('respects a tiny token budget', async () => {
    const tightConfig = {
      ingestion: {
        ...DEFAULTS.ingestion,
        token_budget: 50, // ~200 bytes — should only fit 1-2 small files
      },
    };
    const bundle = await extractContentBundle(FIXTURE_ROOT, descriptor, tightConfig);
    // With a 50-token budget, we should get fewer key_files than with the default
    expect(bundle.key_files.length).toBeLessThan(5);
  });
});

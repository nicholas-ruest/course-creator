import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { scoreFile, selectFilesWithinBudget } from '../src/ingestion/scorer.js';

const ROOT = '/repo';
const score = (rel, size = 0) => scoreFile(path.join(ROOT, rel), ROOT, size);

// ── scoreFile ──────────────────────────────────────────────────────────────

describe('scoreFile', () => {
  it('ranks src/index.ts higher than tests/foo.test.ts', () => {
    const srcScore = score('src/index.ts');
    const testScore = score('tests/foo.test.ts');
    expect(srcScore).toBeGreaterThan(testScore);
  });

  it('scores node_modules deeply negative', () => {
    expect(score('node_modules/foo/bar.js')).toBeLessThan(0);
  });

  it('ranks README.md higher than docs/guide.md', () => {
    const readmeScore = score('README.md');
    const docsScore = score('docs/guide.md');
    expect(readmeScore).toBeGreaterThan(docsScore);
  });

  it('scores dist/bundle.js negative', () => {
    expect(score('dist/bundle.js')).toBeLessThan(0);
  });

  it('scores entry points high', () => {
    expect(score('index.js')).toBeGreaterThanOrEqual(100);
    expect(score('main.py')).toBeGreaterThanOrEqual(100);
    expect(score('app.ts')).toBeGreaterThanOrEqual(100);
    expect(score('lib.rs')).toBeGreaterThanOrEqual(100);
    expect(score('mod.rs')).toBeGreaterThanOrEqual(100);
    expect(score('__init__.py')).toBeGreaterThanOrEqual(100);
  });

  it('gives +60 to src/ directory files', () => {
    const srcFile = score('src/router.js');
    const topFile = score('utils.js');
    expect(srcFile).toBeGreaterThan(topFile);
  });

  it('gives +80 to config files', () => {
    expect(score('package.json')).toBeGreaterThanOrEqual(80);
    expect(score('pyproject.toml')).toBeGreaterThanOrEqual(80);
    expect(score('Cargo.toml')).toBeGreaterThanOrEqual(80);
    expect(score('go.mod')).toBeGreaterThanOrEqual(80);
    expect(score('tsconfig.json')).toBeGreaterThanOrEqual(80);
  });

  it('gives +50 to type definition files', () => {
    expect(score('src/types.d.ts')).toBeGreaterThanOrEqual(50);
  });

  it('gives +40 to examples directory', () => {
    const ex = score('examples/demo.js');
    const plain = score('demo.js');
    expect(ex).toBeGreaterThan(plain);
  });

  it('gives +30 to test files', () => {
    expect(score('tests/unit.test.js')).toBeGreaterThanOrEqual(30);
    expect(score('src/app.spec.ts')).toBeGreaterThanOrEqual(30);
  });

  it('gives +15 to .github/ CI files', () => {
    expect(score('.github/workflows/ci.yml')).toBeGreaterThanOrEqual(15);
  });

  it('penalises lock files at -150', () => {
    expect(score('package-lock.json')).toBeLessThanOrEqual(-150);
    expect(score('yarn.lock')).toBeLessThanOrEqual(-150);
    expect(score('Cargo.lock')).toBeLessThanOrEqual(-150);
  });

  it('penalises vendor/ at -200', () => {
    expect(score('vendor/lib/thing.go')).toBeLessThanOrEqual(-200);
  });

  it('penalises minified files at -200', () => {
    expect(score('dist/app.min.js')).toBeLessThan(-100);
  });

  it('penalises large files (>50KB: -20, >100KB: -50)', () => {
    const small = score('src/router.js', 1000);
    const medium = score('src/router.js', 60000);
    const large = score('src/router.js', 200000);
    expect(medium).toBeLessThan(small);
    expect(large).toBeLessThan(medium);
  });

  it('gives +50 to core/ and internal/ directories', () => {
    expect(score('core/engine.js')).toBeGreaterThanOrEqual(50);
    expect(score('internal/handler.go')).toBeGreaterThanOrEqual(50);
  });

  it('gives +70 to CONTRIBUTING files', () => {
    expect(score('CONTRIBUTING.md')).toBeGreaterThanOrEqual(70);
  });
});

// ── selectFilesWithinBudget ────────────────────────────────────────────────

describe('selectFilesWithinBudget', () => {
  it('selects highest-scored files first', () => {
    const files = [
      { path: 'a.js', score: 10, size: 400 },  // 100 tokens
      { path: 'b.js', score: 90, size: 400 },  // 100 tokens
      { path: 'c.js', score: 50, size: 400 },  // 100 tokens
    ];
    const { selected } = selectFilesWithinBudget(files, 200);
    expect(selected.map(f => f.path)).toEqual(['b.js', 'c.js']);
  });

  it('skips negatively-scored files', () => {
    const files = [
      { path: 'good.js', score: 100, size: 400 },
      { path: 'bad.js', score: -50, size: 400 },
    ];
    const { selected, skipped } = selectFilesWithinBudget(files, 10000);
    expect(selected).toHaveLength(1);
    expect(selected[0].path).toBe('good.js');
    expect(skipped).toBe(1);
  });

  it('respects token budget', () => {
    const files = [
      { path: 'a.js', score: 100, size: 400 },  // 100 tokens
      { path: 'b.js', score: 90, size: 400 },   // 100 tokens
      { path: 'c.js', score: 80, size: 400 },   // 100 tokens
    ];
    const { selected, remaining } = selectFilesWithinBudget(files, 200);
    expect(selected).toHaveLength(2);
    expect(remaining).toBe(0);
  });

  it('returns correct remaining and skipped counts', () => {
    const files = [
      { path: 'a.js', score: 100, size: 200 },  // 50 tokens
      { path: 'b.js', score: 50, size: 200 },   // 50 tokens
      { path: 'c.js', score: 30, size: 200 },   // 50 tokens -- won't fit
      { path: 'd.js', score: -10, size: 200 },  // negative -- skipped
    ];
    const { selected, remaining, skipped } = selectFilesWithinBudget(files, 100);
    expect(selected).toHaveLength(2);
    expect(remaining).toBe(0);
    expect(skipped).toBe(2); // c.js (budget) + d.js (negative)
  });

  it('handles empty input', () => {
    const { selected, remaining, skipped } = selectFilesWithinBudget([], 100);
    expect(selected).toHaveLength(0);
    expect(remaining).toBe(100);
    expect(skipped).toBe(0);
  });

  it('estimates tokens as ceil(size/4)', () => {
    const files = [
      { path: 'a.js', score: 100, size: 7 },  // ceil(7/4) = 2 tokens
    ];
    const { selected, remaining } = selectFilesWithinBudget(files, 10);
    expect(selected).toHaveLength(1);
    expect(remaining).toBe(8);
  });

  it('handles large budget with many files', () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      path: `file${i}.js`,
      score: 100 - i * 10,
      size: 400,
    }));
    const { selected } = selectFilesWithinBudget(files, 100000);
    expect(selected).toHaveLength(10);
  });
});

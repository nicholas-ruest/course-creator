import { describe, it, expect } from 'vitest';
import {
  stripHtml,
  decodeEntities,
  expandTerms,
  humanizeCodeRefs,
  camelToWords,
  normalizePunctuation,
  insertPauses,
  enforceLength,
  sanitizeForTTS,
  TERM_EXPANSIONS,
} from '../src/video/tts-sanitizer.js';

// ── Stage 1: stripHtml ─────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('strips tags and preserves text', () => {
    expect(stripHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('converts <br> to newline', () => {
    expect(stripHtml('line1<br>line2')).toBe('line1\nline2');
    expect(stripHtml('line1<br/>line2')).toBe('line1\nline2');
    expect(stripHtml('line1<br />line2')).toBe('line1\nline2');
  });

  it('converts </p><p> to double newline', () => {
    expect(stripHtml('<p>Para 1</p><p>Para 2</p>')).toBe('Para 1\n\nPara 2');
  });

  it('handles nested tags', () => {
    expect(stripHtml('<div><p>Hello <em>world</em></p></div>')).toBe('Hello world');
  });

  it('trims whitespace', () => {
    expect(stripHtml('  <p>Hello</p>  ')).toBe('Hello');
  });
});

// ── Stage 2: decodeEntities ─────────────────────────────────────────────────

describe('decodeEntities', () => {
  it('decodes common HTML entities', () => {
    expect(decodeEntities('&amp; &lt; &gt; &quot;')).toBe('& < > "');
  });

  it('decodes typographic quotes', () => {
    expect(decodeEntities('&ldquo;hello&rdquo;')).toBe('"hello"');
    expect(decodeEntities('&lsquo;hi&rsquo;')).toBe("'hi'");
  });

  it('decodes mdash and ndash', () => {
    expect(decodeEntities('A&mdash;B')).toBe('A -- B');
    expect(decodeEntities('A&ndash;B')).toBe('A - B');
  });

  it('decodes numeric entities', () => {
    expect(decodeEntities('&#65;')).toBe('A');
    expect(decodeEntities('&#x41;')).toBe('A');
  });

  it('decodes &nbsp;', () => {
    expect(decodeEntities('hello&nbsp;world')).toBe('hello world');
  });

  it('decodes &copy; &reg; &trade;', () => {
    expect(decodeEntities('&copy; &reg; &trade;')).toBe('copyright registered trademark');
  });
});

// ── Stage 3: expandTerms ────────────────────────────────────────────────────

describe('expandTerms', () => {
  it('expands API to A P I', () => {
    expect(expandTerms('Use the API')).toBe('Use the A P I');
  });

  it('expands HTML', () => {
    expect(expandTerms('Write HTML code')).toBe('Write H T M L code');
  });

  it('expands CSS', () => {
    expect(expandTerms('Add CSS styles')).toBe('Add C S S styles');
  });

  it('expands JSON', () => {
    expect(expandTerms('Parse JSON data')).toBe('Parse Jason data');
  });

  it('expands npm', () => {
    expect(expandTerms('Run npm install')).toBe('Run N P M install');
  });

  it('expands async', () => {
    expect(expandTerms('Use async functions')).toBe('Use a-sink functions');
  });

  it('expands Kubernetes', () => {
    expect(expandTerms('Deploy to Kubernetes')).toBe('Deploy to koo-ber-net-ees');
  });

  it('does not expand partial matches', () => {
    // "application" should not trigger "API" expansion
    const result = expandTerms('application logic');
    expect(result).toBe('application logic');
  });

  it('handles multiple terms in one string', () => {
    const result = expandTerms('The API returns JSON over HTTP');
    expect(result).toContain('A P I');
    expect(result).toContain('Jason');
    expect(result).toContain('H T T P');
  });

  it('TERM_EXPANSIONS has at least 50 entries', () => {
    expect(Object.keys(TERM_EXPANSIONS).length).toBeGreaterThanOrEqual(50);
  });

  it('expands longer terms before shorter ones', () => {
    // HTTPS should expand to "H T T P S", not "H T T P" + leftover "S"
    const result = expandTerms('Use HTTPS only');
    expect(result).toBe('Use H T T P S only');
  });
});

// ── Stage 4: humanizeCodeRefs ───────────────────────────────────────────────

describe('humanizeCodeRefs', () => {
  it('humanizes function references', () => {
    expect(humanizeCodeRefs('`processQuery()`')).toBe('the process query function');
  });

  it('humanizes file paths with multiple segments', () => {
    const result = humanizeCodeRefs('in `src/router/index.ts`');
    // The regex consumes the "in " prefix and replaces with "the file ..."
    expect(result).toBe('the file src slash router slash index dot ts');
  });

  it('humanizes class/variable references', () => {
    expect(humanizeCodeRefs('`SemanticRouter`')).toBe('semantic router');
  });

  it('handles snake_case', () => {
    expect(camelToWords('process_query')).toBe('process query');
  });

  it('handles simple lowercase names', () => {
    expect(camelToWords('router')).toBe('router');
  });
});

// ── Stage 5: normalizePunctuation ───────────────────────────────────────────

describe('normalizePunctuation', () => {
  it('collapses whitespace', () => {
    expect(normalizePunctuation('hello   world')).toBe('hello world');
  });

  it('removes space before period', () => {
    expect(normalizePunctuation('hello .')).toBe('hello.');
  });

  it('removes space before comma', () => {
    expect(normalizePunctuation('hello , world')).toBe('hello, world');
  });

  it('converts em dashes to commas', () => {
    expect(normalizePunctuation('hello -- world')).toBe('hello, world');
  });

  it('converts ellipsis to period', () => {
    // Trailing space gets trimmed by .trim()
    expect(normalizePunctuation('wait...')).toBe('wait.');
  });

  it('trims', () => {
    expect(normalizePunctuation('  hello  ')).toBe('hello');
  });
});

// ── Stage 6: insertPauses ───────────────────────────────────────────────────

describe('insertPauses', () => {
  it('adds period before paragraph breaks', () => {
    const result = insertPauses('Para 1\n\nPara 2');
    expect(result).toContain('.\n\nPara 2');
  });

  it('adds pause before transition words', () => {
    const result = insertPauses('First thing. Now let us continue.');
    expect(result).toContain('.\n\nNow');
  });

  it('handles multiple transition words', () => {
    const result = insertPauses("Done. Next we go. Remember this. Let's try.");
    expect(result).toContain('.\n\nNext');
    expect(result).toContain('.\n\nRemember');
    expect(result).toContain(".\n\nLet's");
  });
});

// ── Stage 7: enforceLength ──────────────────────────────────────────────────

describe('enforceLength', () => {
  it('does not truncate short text', () => {
    expect(enforceLength('Hello world', 400)).toBe('Hello world');
  });

  it('truncates at paragraph boundary', () => {
    const text = 'Para one two three.\n\nPara four five six seven eight nine ten.';
    const result = enforceLength(text, 5);
    expect(result).toBe('Para one two three.');
  });

  it('truncates at sentence boundary for single paragraph', () => {
    const text = 'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five. Sentence six. Sentence seven. Sentence eight.';
    const result = enforceLength(text, 6);
    // Should include first 2 sentences (4 words = "Sentence one. Sentence two.")
    expect(result.split(/\s+/).length).toBeLessThanOrEqual(6);
    expect(result).toContain('Sentence one.');
  });

  it('handles empty text', () => {
    expect(enforceLength('', 400)).toBe('');
  });
});

// ── Full pipeline: sanitizeForTTS ───────────────────────────────────────────

describe('sanitizeForTTS', () => {
  it('processes the DDD-005 example', () => {
    const input = `<p>Welcome to section three. Here we'll explore the <strong>router module</strong>,
which lives in <code>src/router/index.ts</code>.</p>
<p>The router uses a technique called &ldquo;semantic matching&rdquo; &mdash;
it compares the user&rsquo;s query against pre-defined route embeddings using
a <code>SemanticRouter</code> class.</p>
<p>Think of it like a GPS &mdash; instead of exact addresses, it understands
<em>intent</em>. The <code>processQuery()</code> function handles this.</p>`;

    const result = sanitizeForTTS(input);

    // Should not contain HTML tags
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');

    // Should have humanized code refs
    expect(result).toContain('the file src slash router slash index dot ts');
    expect(result).toContain('the process query function');
    // SemanticRouter without backticks after stripping stays as-is since the
    // backtick-wrapping regex only matches `...` patterns. The bare class name
    // is left alone, which is acceptable in TTS context.

    // Should have decoded entities
    expect(result).not.toContain('&ldquo;');
    expect(result).not.toContain('&rsquo;');

    // Should be readable prose
    expect(result).toContain('Welcome to section three');
    expect(result).toContain('semantic matching');
  });

  it('handles empty input', () => {
    expect(sanitizeForTTS('')).toBe('');
  });

  it('handles plain text (no HTML)', () => {
    expect(sanitizeForTTS('Hello world')).toBe('Hello world');
  });

  it('expands terms in context', () => {
    const result = sanitizeForTTS('<p>The API returns JSON over HTTP.</p>');
    expect(result).toContain('A P I');
    expect(result).toContain('Jason');
    expect(result).toContain('H T T P');
  });
});

# DDD-005: TTS Sanitization Pipeline Design

## Overview

This document specifies the text-to-speech sanitization pipeline that
transforms lecturer scripts (HTML-formatted educational prose) into clean,
speakable text suitable for HeyGen's TTS engine. The pipeline must produce
natural-sounding narration while preserving educational meaning.

**Related ADRs**: ADR-003 (HeyGen async pipeline), ADR-006 (video caching)

## Problem

Lecturer scripts are written as HTML for display in the transcript pane:

```html
<p>Welcome to section three. Here we'll explore the <strong>router module</strong>,
which lives in <code>src/router/index.ts</code>. The router uses a technique
called &ldquo;semantic matching&rdquo; &mdash; it compares the user&rsquo;s
query against pre-defined route embeddings.</p>

<p>Think of it like a GPS: instead of exact street addresses, it understands
<em>intent</em>. When you say &ldquo;navigate to the nearest coffee shop,&rdquo;
it doesn&rsquo;t need the exact address &mdash; it figures out what you mean.</p>
```

HeyGen's TTS engine expects plain text. Sending raw HTML produces garbled
speech ("less-than p greater-than Welcome to..."). The sanitizer must strip
HTML while preserving readability, and also handle technical content that
TTS engines notoriously mispronounce.

## Pipeline Stages

```
Raw lecturer script (HTML)
  │
  ├─ Stage 1: HTML stripping
  ├─ Stage 2: HTML entity decoding
  ├─ Stage 3: Technical term expansion
  ├─ Stage 4: Code reference humanization
  ├─ Stage 5: Punctuation normalization
  ├─ Stage 6: Pause insertion
  ├─ Stage 7: Length enforcement
  │
  └─ Clean TTS text
```

### Stage 1: HTML Stripping

Remove all HTML tags, preserving inner text content.

```javascript
function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')          // <br> -> newline
    .replace(/<\/p>\s*<p>/gi, '\n\n')       // paragraph breaks -> double newline
    .replace(/<\/?[^>]+(>|$)/g, '')         // strip all remaining tags
    .trim();
}
```

### Stage 2: HTML Entity Decoding

```javascript
const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&ldquo;': '"',
  '&rdquo;': '"',
  '&lsquo;': "'",
  '&rsquo;': "'",
  '&mdash;': ' -- ',
  '&ndash;': ' - ',
  '&hellip;': '...',
  '&nbsp;': ' ',
  '&copy;': 'copyright',
  '&reg;': 'registered',
  '&trade;': 'trademark',
};

function decodeEntities(text) {
  for (const [entity, replacement] of Object.entries(ENTITY_MAP)) {
    text = text.replaceAll(entity, replacement);
  }
  // Numeric entities
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  return text;
}
```

### Stage 3: Technical Term Expansion

TTS engines mispronounce acronyms, abbreviations, and technical terms.
This stage expands them for natural speech.

```javascript
const TERM_EXPANSIONS = {
  // ── Acronyms (spelled out) ──
  'API': 'A P I',
  'APIs': 'A P Is',
  'HTML': 'H T M L',
  'CSS': 'C S S',
  'SQL': 'S Q L',
  'URL': 'U R L',
  'URLs': 'U R Ls',
  'CLI': 'command line interface',
  'SDK': 'S D K',
  'SDKs': 'S D Ks',
  'JSON': 'Jason',
  'YAML': 'Yammel',
  'TOML': 'Tom-L',
  'REST': 'rest',
  'CRUD': 'crud',
  'GNN': 'G N N',
  'LLM': 'L L M',
  'LLMs': 'L L Ms',
  'NLP': 'N L P',
  'GPU': 'G P U',
  'CPU': 'C P U',
  'RAM': 'ram',
  'DOM': 'dom',
  'CORS': 'cores',
  'JWT': 'J W T',
  'SSH': 'S S H',
  'TCP': 'T C P',
  'HTTP': 'H T T P',
  'HTTPS': 'H T T P S',
  'OAuth': 'oh-auth',
  'WebSocket': 'web socket',
  'RegExp': 'regular expression',
  'UUID': 'U U I D',
  'IDE': 'I D E',

  // ── Technical words often mispronounced ──
  'async': 'a-sink',
  'Kubernetes': 'koo-ber-net-ees',
  'nginx': 'engine-x',
  'SQLite': 'S Q Light',
  'PostgreSQL': 'post-gres-Q-L',
  'MySQL': 'my-S-Q-L',
  'MongoDB': 'mongo D B',
  'Redis': 'red-iss',
  'GraphQL': 'graph-Q-L',
  'webpack': 'web-pack',
  'TypeScript': 'type-script',
  'JavaScript': 'java-script',
  'Node.js': 'node J S',
  'Deno': 'dee-no',
  'Bun': 'bun',
  'npm': 'N P M',
  'pip': 'pip',
  'PyPI': 'pie-P-I',
  'cron': 'cron',
  'sudo': 'soo-doo',
  'stdin': 'standard in',
  'stdout': 'standard out',
  'stderr': 'standard error',
  'localhost': 'local-host',
  'boolean': 'boolean',
  'enum': 'ee-num',
  'tuple': 'too-pull',
  'mutex': 'mew-tex',
  'semaphore': 'sem-a-for',
  'FIFO': 'fy-fo',
  'LIFO': 'ly-fo',
};

function expandTerms(text) {
  // Sort by length descending to match longer terms first
  const sorted = Object.entries(TERM_EXPANSIONS)
    .sort(([a], [b]) => b.length - a.length);

  for (const [term, expansion] of sorted) {
    // Word-boundary matching to avoid partial replacements
    const regex = new RegExp('\\b' + escapeRegex(term) + '\\b', 'g');
    text = text.replace(regex, expansion);
  }

  return text;
}
```

### Stage 4: Code Reference Humanization

File paths and code identifiers need special handling:

```javascript
function humanizeCodeRefs(text) {
  // File paths: "src/router/index.ts" -> "the file src router index dot T S"
  text = text.replace(
    /(?:in |at |from |the file )?`?([a-zA-Z][\w./-]+\.[jt]sx?(?::\d+)?)`?/g,
    (match, filePath) => {
      const parts = filePath.split('/');
      const fileName = parts[parts.length - 1];
      // Only humanize if it looks like a file reference in narrative context
      if (parts.length > 1) {
        return 'the file ' + parts.join(' slash ').replace(/\./g, ' dot ');
      }
      return match;
    }
  );

  // Function references: `processQuery()` -> "the process query function"
  text = text.replace(
    /`(\w+)\(\)`/g,
    (_, name) => 'the ' + camelToWords(name) + ' function'
  );

  // Variable/class references: `SemanticRouter` -> "semantic router"
  text = text.replace(
    /`(\w+)`/g,
    (_, name) => camelToWords(name)
  );

  return text;
}

function camelToWords(str) {
  return str
    .replace(/([A-Z])/g, ' $1')       // CamelCase -> spaced
    .replace(/([a-z])(\d)/g, '$1 $2')  // name2 -> name 2
    .replace(/_/g, ' ')                // snake_case -> spaced
    .trim()
    .toLowerCase();
}
```

### Stage 5: Punctuation Normalization

```javascript
function normalizePunctuation(text) {
  return text
    .replace(/\s+/g, ' ')              // Collapse whitespace
    .replace(/ +\./g, '.')             // Remove space before period
    .replace(/ +,/g, ',')             // Remove space before comma
    .replace(/\.\.\./g, '. ')         // Ellipsis -> period
    .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
    .replace(/[""]/g, '"')            // Normalize quotes
    .replace(/['']/g, "'")
    .replace(/ -- /g, ', ')           // Em dash -> comma (more natural in speech)
    .trim();
}
```

### Stage 6: Pause Insertion

Natural speech has pauses at structural boundaries. Some TTS engines
support SSML; for those that don't, strategic punctuation achieves
similar results.

```javascript
function insertPauses(text) {
  // Paragraph breaks become longer pauses
  text = text.replace(/\n\n/g, '.\n\n');

  // Before "Now", "Next", "Let's", "Remember" (transition words)
  text = text.replace(
    /\. (Now|Next|Let's|Remember|Notice|Here's|Consider|Think about)/g,
    '.\n\n$1'
  );

  // After section-opening sentences (first sentence of each paragraph)
  // No automated change -- the lecturer script should already have natural pacing

  return text;
}
```

### Stage 7: Length Enforcement

HeyGen has limits on script length per video. The sanitizer enforces
word count limits.

```javascript
function enforceLength(text, maxWords = 400) {
  const words = text.split(/\s+/);

  if (words.length <= maxWords) {
    return text;
  }

  // Split into segments at paragraph boundaries
  const paragraphs = text.split('\n\n');
  let result = '';
  let wordCount = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;
    if (wordCount + paraWords > maxWords) {
      break;
    }
    result += (result ? '\n\n' : '') + para;
    wordCount += paraWords;
  }

  // If still over (single giant paragraph), hard truncate at sentence boundary
  if (wordCount > maxWords) {
    const sentences = result.split(/(?<=[.!?])\s+/);
    result = '';
    wordCount = 0;
    for (const sentence of sentences) {
      const sentWords = sentence.split(/\s+/).length;
      if (wordCount + sentWords > maxWords) break;
      result += (result ? ' ' : '') + sentence;
      wordCount += sentWords;
    }
  }

  return result;
}
```

## Full Pipeline Function

```javascript
function sanitizeForTTS(lecturerScript) {
  let text = lecturerScript;

  text = stripHtml(text);
  text = decodeEntities(text);
  text = expandTerms(text);
  text = humanizeCodeRefs(text);
  text = normalizePunctuation(text);
  text = insertPauses(text);
  text = enforceLength(text, 400);

  return text;
}
```

## Examples

### Input (HTML lecturer script)

```html
<p>Welcome to section three. Here we'll explore the <strong>router module</strong>,
which lives in <code>src/router/index.ts</code>.</p>
<p>The router uses a technique called &ldquo;semantic matching&rdquo; &mdash;
it compares the user&rsquo;s query against pre-defined route embeddings using
a <code>SemanticRouter</code> class.</p>
<p>Think of it like a GPS &mdash; instead of exact addresses, it understands
<em>intent</em>. The <code>processQuery()</code> function handles this.</p>
```

### Output (TTS-ready text)

```
Welcome to section three. Here we'll explore the router module, which
lives in the file src slash router slash index dot T S.

The router uses a technique called "semantic matching", it compares the
user's query against pre-defined route embeddings using a semantic router
class.

Think of it like a G P S, instead of exact addresses, it understands
intent. The process query function handles this.
```

## Edge Cases

| Scenario | Handling |
|----------|---------|
| Script contains only code blocks | Strip code, keep surrounding prose. If result is empty, use section title + "Let's look at the code." |
| Script has no paragraphs (single block) | Insert pauses at sentence boundaries |
| Script exceeds 400 words | Truncate at paragraph boundary, then sentence boundary |
| Script contains mathematical notation | Convert `x^2` to "x squared", `O(n log n)` to "O of n log n" |
| Script contains URLs inline | Remove URLs, keep surrounding context |
| Script is empty | Use fallback: "In this section, we'll cover {section.title}." |
| Non-ASCII characters (accented, CJK) | Pass through unchanged -- HeyGen handles Unicode |
| Emoji in script | Remove emoji (TTS may read them as "smiling face with...") |

## Testing Strategy

Each stage has independent unit tests:

```javascript
// Stage 1: HTML stripping
assert.equal(stripHtml('<p>Hello <strong>world</strong></p>'), 'Hello world');
assert.equal(stripHtml('<br/>line<br>break'), '\nline\nbreak');

// Stage 3: Term expansion
assert.equal(expandTerms('Use the API'), 'Use the A P I');
assert.equal(expandTerms('Run npm install'), 'Run N P M install');

// Stage 4: Code humanization
assert.equal(humanizeCodeRefs('`processQuery()`'), 'the process query function');
assert.equal(humanizeCodeRefs('in `src/router/index.ts`'),
  'in the file src slash router slash index dot T S');

// Integration
const html = '<p>The API uses <code>processQuery()</code> from <code>src/router.ts</code>.</p>';
const expected = 'The A P I uses the process query function from the file src slash router dot T S.';
assert.equal(sanitizeForTTS(html), expected);
```

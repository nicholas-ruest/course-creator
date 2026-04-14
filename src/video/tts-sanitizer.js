/**
 * tts-sanitizer.js — 7-stage TTS sanitization pipeline.
 *
 * Transforms HTML lecturer scripts into clean, speakable text for HeyGen's
 * TTS engine. Each stage is exported individually for unit testing.
 *
 * See: DDD-005  (TTS Sanitization Pipeline)
 */

// ── Stage 1: HTML Stripping ─────────────────────────────────────────────────

export function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .trim();
}

// ── Stage 2: HTML Entity Decoding ───────────────────────────────────────────

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

export function decodeEntities(text) {
  for (const [entity, replacement] of Object.entries(ENTITY_MAP)) {
    text = text.replaceAll(entity, replacement);
  }
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  text = text.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
  return text;
}

// ── Stage 3: Technical Term Expansion ───────────────────────────────────────

export const TERM_EXPANSIONS = {
  // Acronyms (spelled out)
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
  // Technical words often mispronounced
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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function expandTerms(text) {
  const sorted = Object.entries(TERM_EXPANSIONS)
    .sort(([a], [b]) => b.length - a.length);

  for (const [term, expansion] of sorted) {
    const regex = new RegExp('\\b' + escapeRegex(term) + '\\b', 'g');
    text = text.replace(regex, expansion);
  }
  return text;
}

// ── Stage 4: Code Reference Humanization ────────────────────────────────────

export function camelToWords(str) {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase();
}

export function humanizeCodeRefs(text) {
  // File paths: `src/router/index.ts` or bare src/router/index.ts
  // -> "the file src slash router slash index dot ts"
  text = text.replace(
    /(?:in |at |from |the file )?`?([a-zA-Z][\w./-]+\.[jt]sx?(?::\d+)?)`?/g,
    (match, filePath) => {
      const parts = filePath.split('/');
      if (parts.length > 1) {
        return 'the file ' + parts.join(' slash ').replace(/\./g, ' dot ');
      }
      return match;
    },
  );

  // Function references: `processQuery()` or bare processQuery()
  // -> "the process query function"
  text = text.replace(
    /`(\w+)\(\)`/g,
    (_, name) => 'the ' + camelToWords(name) + ' function',
  );
  // Also match bare function calls (after HTML stripping removes <code> tags)
  text = text.replace(
    /\b([a-z]\w+)\(\)/g,
    (match, name) => {
      // Skip common words that aren't function names
      if (['the', 'and', 'for', 'not', 'but', 'are'].includes(name)) return match;
      return 'the ' + camelToWords(name) + ' function';
    },
  );

  // Variable/class references in backticks: `SemanticRouter` -> "semantic router"
  text = text.replace(
    /`(\w+)`/g,
    (_, name) => camelToWords(name),
  );

  return text;
}

// ── Stage 5: Punctuation Normalization ──────────────────────────────────────

export function normalizePunctuation(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/ +\./g, '.')
    .replace(/ +,/g, ',')
    .replace(/\.\.\./g, '. ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/ -- /g, ', ')
    .trim();
}

// ── Stage 6: Pause Insertion ────────────────────────────────────────────────

export function insertPauses(text) {
  text = text.replace(/\n\n/g, '.\n\n');
  text = text.replace(
    /\. (Now|Next|Let's|Remember|Notice|Here's|Consider|Think about)/g,
    '.\n\n$1',
  );
  return text;
}

// ── Stage 7: Length Enforcement ─────────────────────────────────────────────

export function enforceLength(text, maxWords = 400) {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return text;
  }

  // Split at paragraph boundaries
  const paragraphs = text.split('\n\n');
  let result = '';
  let wordCount = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).filter(Boolean).length;
    if (wordCount + paraWords > maxWords) break;
    result += (result ? '\n\n' : '') + para;
    wordCount += paraWords;
  }

  // If still over (single giant paragraph), hard truncate at sentence boundary
  if (result.split(/\s+/).filter(Boolean).length > maxWords || wordCount === 0) {
    const sentences = (result || text).split(/(?<=[.!?])\s+/);
    result = '';
    wordCount = 0;
    for (const sentence of sentences) {
      const sentWords = sentence.split(/\s+/).filter(Boolean).length;
      if (wordCount + sentWords > maxWords) break;
      result += (result ? ' ' : '') + sentence;
      wordCount += sentWords;
    }
  }

  return result;
}

// ── Full Pipeline ───────────────────────────────────────────────────────────

/**
 * Sanitize an HTML lecturer script into TTS-ready plain text.
 *
 * @param {string} lecturerScript — HTML-formatted lecturer script
 * @returns {string} clean, speakable text
 */
export function sanitizeForTTS(lecturerScript) {
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

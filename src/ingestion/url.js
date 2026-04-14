/**
 * url.js — Documentation URL ingester.
 *
 * Fetches a web page and up to N same-domain linked pages, extracts text
 * content, headings, code blocks, and paragraphs into a documentation-focused
 * ContentBundle.
 *
 * See: ADR-004  (Multi-Source Ingestion with Unified ContentBundle)
 *      DDD-003  (Ingestion Pipeline — "URL Ingester")
 */

/**
 * Ingest documentation from a URL.
 *
 * @param {object} descriptor — { type: "documentation_url", url: string }
 * @param {object} config — resolved configuration
 * @returns {Promise<object>} ContentBundle (documentation-focused)
 */
export async function ingestURL(descriptor, config) {
  const primaryUrl = descriptor.url;
  const maxPages = config.ingestion.max_crawl_pages || 20;
  const domain = extractDomain(primaryUrl);

  const visited = new Set();
  const docs = [];

  // Fetch the primary page
  const primaryPage = await fetchAndExtract(primaryUrl);
  if (!primaryPage) {
    throw new Error(`Failed to fetch: ${primaryUrl}`);
  }

  visited.add(primaryUrl);
  docs.push({
    url: primaryUrl,
    title: primaryPage.title,
    content: primaryPage.content,
  });

  // Find same-domain internal links and follow them (max depth 1)
  const internalLinks = primaryPage.links
    .filter(link => {
      try {
        const linkDomain = extractDomain(link);
        return linkDomain === domain && !visited.has(link);
      } catch {
        return false;
      }
    })
    .slice(0, maxPages - 1);

  // Fetch linked pages in small batches to avoid hammering the server
  const BATCH_SIZE = 5;
  for (let i = 0; i < internalLinks.length; i += BATCH_SIZE) {
    const batch = internalLinks.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(link => {
        visited.add(link);
        return fetchAndExtract(link);
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        docs.push({
          url: result.value.url,
          title: result.value.title,
          content: result.value.content,
        });
      }
    }
  }

  return {
    source_type: descriptor.type,
    source_ref: primaryUrl,
    workspace_path: null,

    readme: null,
    docs: docs.map(d => d.content),

    package_json: null,
    pyproject: null,
    cargo_toml: null,
    claude_md: null,

    file_tree: [],
    languages: [],
    entry_points: [],

    key_files: [],
    type_definitions: [],
    test_files: [],
    examples: [],

    registry_metadata: null,
  };
}

/**
 * Fetch a URL and extract structured content from the HTML.
 *
 * @param {string} url
 * @returns {Promise<object|null>} { url, title, content, links }
 */
async function fetchAndExtract(url) {
  let html;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'course-creator/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return null;
    }

    html = await response.text();
  } catch {
    return null;
  }

  return parseHTML(url, html);
}

/**
 * Extract structured content from raw HTML using regex-based parsing.
 * We deliberately avoid requiring a DOM library — this is good-enough
 * extraction for course-generation purposes.
 */
function parseHTML(url, html) {
  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : '';

  // Remove script, style, nav, footer, header tags and their contents
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');

  // Extract headings
  const headings = [];
  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = headingRegex.exec(body)) !== null) {
    headings.push(stripTags(m[2]).trim());
  }

  // Extract code blocks
  const codeBlocks = [];
  const preRegex = /<pre[^>]*>([\s\S]*?)<\/pre>/gi;
  while ((m = preRegex.exec(body)) !== null) {
    codeBlocks.push(stripTags(decodeEntities(m[1])).trim());
  }

  // Extract paragraphs and list items
  const textBlocks = [];
  const pRegex = /<(?:p|li)[^>]*>([\s\S]*?)<\/(?:p|li)>/gi;
  while ((m = pRegex.exec(body)) !== null) {
    const text = stripTags(m[1]).trim();
    if (text.length > 20) {
      textBlocks.push(text);
    }
  }

  // Build content string
  const parts = [];
  if (title) parts.push(`# ${title}\n`);
  if (headings.length) {
    parts.push(headings.map(h => `## ${h}`).join('\n'));
  }
  if (textBlocks.length) {
    parts.push(textBlocks.join('\n\n'));
  }
  if (codeBlocks.length) {
    parts.push(codeBlocks.map(c => '```\n' + c + '\n```').join('\n\n'));
  }

  const content = parts.join('\n\n');

  // Extract links (same-domain filtering done by caller)
  const links = [];
  const linkRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi;
  while ((m = linkRegex.exec(html)) !== null) {
    try {
      const resolved = new URL(m[1], url).href;
      links.push(resolved);
    } catch {
      // skip malformed URLs
    }
  }

  return { url, title, content, links };
}

/**
 * Strip HTML tags from a string.
 */
function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

/**
 * Decode common HTML entities.
 */
function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Extract the domain (host) from a URL string.
 */
function extractDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// Export parseHTML for testing
export { parseHTML };

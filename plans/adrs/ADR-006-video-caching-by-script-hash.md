# ADR-006: Video Caching by Script Hash

## Status

Accepted

## Date

2026-04-13

## Context

HeyGen video generation costs approximately $0.50-1.00 per minute of output
video. An 8-section course with 2 minutes per section costs $8-16 in HeyGen
API fees. During iterative development of a course (editing content, re-running
generation), the same lecturer scripts are often re-submitted unchanged.

We need a caching strategy to avoid paying for and waiting on video generation
when the script content has not changed.

We considered three approaches:

1. **No caching**: Always regenerate all videos. Simple but wasteful.
2. **File-based cache keyed on section ID**: Cache by section identifier
   (`s1`, `s2`, etc.). Reuse if the section ID matches.
3. **Content-addressed cache keyed on script hash**: Cache by SHA-256 hash of
   the normalized script text + avatar ID + voice ID. Reuse if the exact same
   content was already generated.

## Decision

We will use **Option 3: Content-addressed caching by script hash**.

The cache key is:

```
SHA-256( normalize(script_text) + "|" + avatar_id + "|" + voice_id )
```

Where `normalize()` strips whitespace variations and lowercases to prevent
trivial formatting changes from busting the cache.

The cache is stored on the local filesystem:

```
.course-creator-cache/
  videos/
    {hash}.mp4          <- Cached video file
    {hash}.json         <- Metadata: duration, thumbnail, original script, date
```

## Rationale

**Option 1 rejected** because it wastes money and time. During iterative
course development, a user might re-run generation 3-5 times while tweaking
content. Regenerating all videos each time would cost $24-80 and add 30-60
minutes of wait time for no benefit.

**Option 2 rejected** because section IDs are not stable across content
changes. If the user edits section 3's content but keeps its ID as `s3`, the
cache would serve stale video that does not match the new script. Worse, if
sections are reordered, the wrong video would be served.

**Option 3** provides correct cache behavior: a video is reused if and only if
the exact same words are being spoken by the exact same avatar with the exact
same voice. Any change to the script, avatar, or voice produces a new hash
and triggers regeneration.

## Cache Lifecycle

```
submit_heygen_video(script, options):
  hash = sha256(normalize(script) + "|" + avatar + "|" + voice)

  IF cache.has(hash):
    log("Cache hit: reusing video for section " + section_id)
    RETURN cache.get(hash)

  video = heygen_api.generate(script, avatar, voice)
  cache.set(hash, video)
  RETURN video
```

## Cache Invalidation

The cache does NOT automatically expire. Entries are invalidated by:

1. **Manual deletion**: User runs `course-creator cache clear` to purge all
   cached videos.
2. **Content change**: Script changes produce a new hash, so the old cache
   entry simply becomes unused (not actively removed).
3. **Disk space management**: A future enhancement could implement LRU eviction
   when the cache exceeds a configurable size limit (e.g., 5GB).

## Consequences

### Positive

- Second and subsequent runs of the same course complete in seconds (video
  step) instead of minutes
- Saves $8-16 per cache-hit run
- Content-addressed: mathematically impossible to serve stale video
- Works across projects: if two courses use the same script for a section
  (unlikely but possible), the cache deduplicates

### Negative

- Cache consumes disk space (~50MB per video, 400MB per 8-section course)
- No automatic eviction -- cache grows indefinitely until manual cleanup
- Normalized script comparison means intentional formatting changes (e.g.,
  adding emphasis pauses via whitespace) may not trigger regeneration

### Mitigations

- The `--no-cache` flag bypasses the cache entirely for forced regeneration
- Cache metadata JSON includes the original script text for human inspection
- A `course-creator cache stats` command shows cache size and hit rate
- Normalization is conservative: only strips leading/trailing whitespace and
  collapses internal whitespace runs, preserving intentional line breaks

/**
 * poller.js — Poll HeyGen video jobs until all complete or timeout.
 *
 * Implements the deferred collection pattern from ADR-003: submit all videos
 * in parallel, then poll until all are done. Failed/timed-out videos fall
 * back to text lecturer.
 *
 * See: ADR-003  (Asynchronous HeyGen Video Pipeline — "Timing Diagram")
 *      SPARC.md Section 2.4 (await_all_videos pseudocode)
 */

/**
 * Wait for all video generation jobs to complete.
 *
 * @param {object[]} jobs — array of job descriptors from HeyGenClient.submitVideo
 * @param {import('./heygen.js').HeyGenClient} client — HeyGen API client
 * @param {object} config — resolved config (needs config.heygen)
 * @param {string} outputDir — directory to download videos to
 * @returns {Promise<object[]>} updated jobs array with final statuses
 */
export async function awaitAllVideos(jobs, client, config, outputDir) {
  const pollInterval = config.heygen.poll_interval_ms || 15_000;
  const timeout = config.heygen.timeout_ms || 600_000;

  // Track per-job deadlines
  const deadlines = new Map();
  const now = Date.now();
  for (const job of jobs) {
    if (job.status === 'processing') {
      deadlines.set(job.section_id, now + timeout);
    }
  }

  while (hasPending(jobs)) {
    // Wait before polling
    await sleep(pollInterval);

    for (const job of jobs) {
      if (job.status !== 'processing') continue;
      if (!job.video_id) {
        job.status = 'failed';
        job.error = 'No video_id returned from submission';
        continue;
      }

      // Check timeout
      if (Date.now() > deadlines.get(job.section_id)) {
        job.status = 'timeout';
        console.warn(`Video timed out for ${job.section_id}`);
        continue;
      }

      try {
        const status = await client.pollVideoStatus(job.video_id);

        if (status.status === 'completed' && status.video_url) {
          const outputPath = `${outputDir}/${job.section_id}.mp4`;
          await client.downloadVideo(status.video_url, outputPath, job.script_hash);
          job.status = 'completed';
          job.video_url = status.video_url;
          job.local_path = outputPath;
          job.thumbnail_url = status.thumbnail_url;
          job.duration = status.duration;
          console.log(`Video completed for ${job.section_id} (${status.duration}s)`);
        } else if (status.status === 'failed' || status.status === 'error') {
          job.status = 'failed';
          job.error = status.error || 'HeyGen reported failure';
          console.warn(`Video failed for ${job.section_id}: ${job.error}`);
        }
        // else still processing — continue polling
      } catch (err) {
        // Network error during poll — don't mark as failed yet, will retry
        console.warn(`Poll error for ${job.section_id}: ${err.message}`);
      }
    }
  }

  return jobs;
}

/**
 * Check if any jobs are still in processing state.
 */
function hasPending(jobs) {
  return jobs.some(j => j.status === 'processing');
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

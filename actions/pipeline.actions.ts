"use server";

import { createJob, getJobById } from "@/repositories/job.repository";
import {
  executeAsyncSitemapPipeline,
  executeAsyncSinglePagePipeline,
} from "@/services/async-pipeline.service";

/**
 * 1. Queue Sitemap Crawler Job (Non-blocking, returns < 50ms)
 */
export async function startAsyncSitemapPipelineAction(sitemapUrl: string, fileLimit?: number) {
  try {
    const jobId = await createJob("SITEMAP_CRAWL", sitemapUrl);

    setImmediate(() => {
      executeAsyncSitemapPipeline(jobId, sitemapUrl, fileLimit);
    });

    return { success: true, jobId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to queue sitemap job";
    return { success: false, error: msg };
  }
}

/**
 * 2. Queue Single Page Ingestion Job (Non-blocking, returns < 50ms)
 */
export async function startAsyncSinglePagePipelineAction(pageUrl: string) {
  try {
    const jobId = await createJob("SINGLE_PAGE", pageUrl);

    setImmediate(() => {
      executeAsyncSinglePagePipeline(jobId, pageUrl);
    });

    return { success: true, jobId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to queue single page job";
    return { success: false, error: msg };
  }
}

/**
 * 3. Poll Status of any background job by ID
 */
export async function checkJobStatusAction(jobId: string) {
  try {
    const job = await getJobById(jobId);
    if (!job) return { success: false, error: "Job not found" };
    return { success: true, job };
  } catch (error) {
    return { success: false, error: "Status check failed" };
  }
}
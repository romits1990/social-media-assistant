import { updateJobProgress } from "@/repositories/job.repository";
import { getValidUrlDetails } from "@/lib/utils/url.helper";
import { processSitemapUrl } from "@/services/sitemap-parser.service";
import {
  scrapePage,
  createScrapDumpDirectory,
  deleteScrapDumpDirectory,
  writeScrapedContentToFile,
  getScrapedPageFiles,
  readScrapedFileContent,
  ScrapedPageData,
} from "@/services/scraper.service";
import { processAndEmbedPageContent } from "@/services/embedding.service";
import { executeConcurrentPipeline } from "@/lib/utils/pipeline.helper";

/**
 * Background Worker: Single Page Crawl & Ingest
 */
export const executeAsyncSinglePagePipeline = async (
  jobId: string,
  pageUrl: string
): Promise<void> => {
  const { isValid, url } = getValidUrlDetails(pageUrl);

  if (!isValid || !url) {
    await updateJobProgress(jobId, {
      status: "FAILED",
      errorMessage: "Invalid web page URL provided.",
    });
    return;
  }

  try {
    await updateJobProgress(jobId, {
      status: "PROCESSING",
      totalItems: 1,
      processedItems: 0,
      progressPercentage: 15,
    });

    console.log(`🌐 [Single Ingest Job: ${jobId}] Scraping: ${url}...`);
    const scrapedData: ScrapedPageData | null = await scrapePage(url);

    if (!scrapedData || !scrapedData.textContent) {
      await updateJobProgress(jobId, {
        status: "FAILED",
        errorMessage: "Failed to extract text content from the target URL.",
      });
      return;
    }

    await updateJobProgress(jobId, {
      progressPercentage: 50,
    });

    console.log(`⚡ [Single Ingest Job: ${jobId}] Chunking & embedding content...`);
    await processAndEmbedPageContent(scrapedData);

    const heroImage =
      scrapedData.images && scrapedData.images.length > 0 ? scrapedData.images[0] : null;

    await updateJobProgress(jobId, {
      status: "COMPLETED",
      progressPercentage: 100,
      processedItems: 1,
      resultData: {
        url,
        title: scrapedData.title || "Untitled Page",
        characterCount: scrapedData.textContent.length,
        heroImage,
      },
    });

    console.log(`🎉 [Single Ingest Job: ${jobId}] Successfully ingested ${url}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Single page ingestion failed";
    console.error(`❌ [Single Ingest Job Error]: ${msg}`);
    await updateJobProgress(jobId, {
      status: "FAILED",
      errorMessage: msg,
    });
  }
};

/**
 * Background Worker: Sitemap Crawl & Multi-Page Ingest
 */
export const executeAsyncSitemapPipeline = async (
  jobId: string,
  sitemapUrl: string,
  fileLimit?: number
): Promise<void> => {
  const { isValid, url: rootUrl, hostname } = getValidUrlDetails(sitemapUrl);

  if (!isValid || !rootUrl || !hostname) {
    await updateJobProgress(jobId, {
      status: "FAILED",
      errorMessage: "Invalid sitemap URL provided.",
    });
    return;
  }

  try {
    await updateJobProgress(jobId, { status: "PROCESSING", progressPercentage: 5 });

    const rawPageUrls = await processSitemapUrl(rootUrl);
    const pageUrls = rawPageUrls.filter((url) => getValidUrlDetails(url).isValid);

    if (pageUrls.length === 0) {
      await updateJobProgress(jobId, {
        status: "FAILED",
        errorMessage: "No valid URLs discovered in sitemap.",
      });
      return;
    }

    const targetUrls = fileLimit && fileLimit > 0 ? pageUrls.slice(0, fileLimit) : pageUrls;
    await updateJobProgress(jobId, {
      totalItems: targetUrls.length,
      progressPercentage: 15,
    });

    const outputDir = await createScrapDumpDirectory(hostname);
    let scrapedCount = 0;

    for (const url of targetUrls) {
      const scraped = await scrapePage(url);
      if (scraped && scraped.textContent) {
        await writeScrapedContentToFile(scraped, url, outputDir);
        scrapedCount++;
      }
      const scrapePct = 15 + Math.round((scrapedCount / targetUrls.length) * 35);
      await updateJobProgress(jobId, {
        processedItems: scrapedCount,
        progressPercentage: scrapePct,
      });
    }

    if (scrapedCount === 0) {
      await deleteScrapDumpDirectory(outputDir);
      await updateJobProgress(jobId, {
        status: "FAILED",
        errorMessage: "Could not extract content from any pages.",
      });
      return;
    }

    const jsonFiles = await getScrapedPageFiles(hostname, { limit: fileLimit });
    let ingestedCount = 0;

    const ingestionTask = async (fileName: string) => {
      const pageData: ScrapedPageData | null = await readScrapedFileContent(fileName, hostname);
      if (pageData) {
        await processAndEmbedPageContent(pageData);
        ingestedCount++;
        const ingestPct = 50 + Math.round((ingestedCount / jsonFiles.length) * 50);
        await updateJobProgress(jobId, {
          processedItems: ingestedCount,
          progressPercentage: Math.min(ingestPct, 99),
        });
      }
    };

    const tasks = jsonFiles.map((file) => () => ingestionTask(file));
    await executeConcurrentPipeline(tasks, { concurrency: 3 });

    await updateJobProgress(jobId, {
      status: "COMPLETED",
      progressPercentage: 100,
      processedItems: ingestedCount,
      resultData: {
        hostname,
        pagesScraped: scrapedCount,
        pagesIngested: ingestedCount,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Fatal pipeline error";
    await updateJobProgress(jobId, {
      status: "FAILED",
      errorMessage: msg,
    });
  }
};
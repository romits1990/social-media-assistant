import axios from 'axios';
import * as cheerio from 'cheerio';
import { getValidUrlDetails } from "@/lib/utils/url.helper";

interface ParseResult {
  sitemaps: string[];
  pages: string[];
}

const sitemapHttpClient = axios.create({
  timeout: 12000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
  },
});

/**
 * Checks if a URL points to a static media file or non-article page
 */
const isStaticOrMediaUrl = (url: string): boolean => {
  return (
    url.endsWith('.xml') ||
    /\.(jpg|jpeg|png|gif|webp|svg|pdf|mp4|mp3|css|js)$/i.test(url) ||
    /\/tag\/|\/category\/|\/author\/|\/image-sitemap/i.test(url)
  );
};

/**
 * Parses a single sitemap URL and extracts sub-sitemaps and content page links
 */
async function parseSingleSitemap(url: string): Promise<ParseResult> {
  try {
    const { data: xmlData } = await sitemapHttpClient.get(url, {
      responseType: 'text',
    });

    const $ = cheerio.load(xmlData, { xmlMode: true });
    const sitemaps: string[] = [];
    const pages: string[] = [];

    // 1. Identify nested sitemaps (<sitemapindex> structures)
    $('sitemapindex > sitemap > loc, sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim();
      const { isValid } = getValidUrlDetails(loc);
      if (loc && isValid && !loc.includes('image-sitemap') && !loc.includes('video-sitemap')) {
        sitemaps.push(loc);
      }
    });

    // 2. Identify target content pages (<urlset> structures)
    $('urlset > url > loc, url > loc').each((_, el) => {
      const loc = $(el).text().trim();
      const { isValid } = getValidUrlDetails(loc);
      if (loc && isValid && !isStaticOrMediaUrl(loc)) {
        pages.push(loc);
      }
    });

    return { sitemaps, pages };
  } catch (error) {
    console.warn(
      `⚠️ [Sitemap Parser] Skipping invalid/blocked sitemap (${url}):`,
      error instanceof Error ? error.message : error
    );
    return { sitemaps: [], pages: [] };
  }
}

/**
 * Breadth-First-Search sitemap crawler with early exit once pageLimit is reached
 */
export const processSitemapUrl = async (
  rootSitemapUrl: string,
  pageLimit: number = 20
): Promise<string[]> => {
  const sitemapQueue: string[] = [rootSitemapUrl];
  const visitedSitemaps = new Set<string>();
  const finalPageUrls = new Set<string>();

  const MAX_SITEMAPS_TO_PROCESS = 100;

  console.log(`🌐 [Crawler] Starting discovery for ${rootSitemapUrl} (Target Limit: ${pageLimit})`);

  while (sitemapQueue.length > 0 && finalPageUrls.size < pageLimit) {
    if (visitedSitemaps.size >= MAX_SITEMAPS_TO_PROCESS) {
      console.warn(`⚠️ [Crawler] Reached safety cap of ${MAX_SITEMAPS_TO_PROCESS} sitemaps.`);
      break;
    }

    const currentSitemap = sitemapQueue.shift()!;
    if (visitedSitemaps.has(currentSitemap)) continue;
    visitedSitemaps.add(currentSitemap);

    console.log(`📑 [Crawler] Parsing index (${visitedSitemaps.size}): ${currentSitemap}`);
    const { sitemaps, pages } = await parseSingleSitemap(currentSitemap);

    // Enqueue sub-sitemaps
    for (const childSitemap of sitemaps) {
      if (!visitedSitemaps.has(childSitemap)) {
        sitemapQueue.push(childSitemap);
      }
    }

    // Collect pages and break immediately once pageLimit is satisfied
    for (const page of pages) {
      if (finalPageUrls.size >= pageLimit) break;
      finalPageUrls.add(page);
    }

    console.log(`📊 [Crawler Progress] Collected ${finalPageUrls.size}/${pageLimit} candidate pages.`);
  }

  const result = Array.from(finalPageUrls);
  console.log(`✅ [Crawler Complete] Discovered ${result.length} candidate URLs.`);
  return result;
};
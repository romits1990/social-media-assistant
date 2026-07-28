import axios from 'axios';
import * as cheerio from 'cheerio';
import { getValidUrlDetails, ValidUrlDetails } from "@/lib/url.helper";

interface ParseResult {
  sitemaps: string[]; // Nested sitemap indexes found
  pages: string[];    // Final content pages found
}

/**
 * Parses a single sitemap URL and returns any child sitemaps or content pages
 */
async function parseSingleSitemap(url: string): Promise<ParseResult> {
  try {
    const { data: xmlData } = await axios.get(url, { 
      responseType: 'text',
      timeout: 10000 // 10-second safety timeout
    });

    const $ = cheerio.load(xmlData, { xmlMode: true });
    const sitemaps: string[] = [];
    const pages: string[] = [];

    // 1. Identify nested sitemaps (<sitemapindex> structures)
    $('sitemapindex > sitemap > loc').each((_, el) => {
      const loc = $(el).text().trim();
      const { isValid } = getValidUrlDetails(loc);
      if (loc && isValid) sitemaps.push(loc);
    });

    // 2. Identify target content pages (<urlset> structures)
    $('urlset > url > loc').each((_, el) => {
      const loc = $(el).text().trim();
      const { isValid } = getValidUrlDetails(loc);
      if (loc && isValid) pages.push(loc);
    });

    return { sitemaps, pages };
  } catch (error) {
    console.error(`[Error] Failed to fetch sitemap: ${url}`, error instanceof Error ? error.message : '');
    return { sitemaps: [], pages: [] };
  }
}

export const processSitemapUrl = async (rootSitemapUrl: string): Promise<string[]> => {
  // Use sets to guarantee uniqueness and avoid loops
  const sitemapQueue: string[] = [rootSitemapUrl];
  const visitedSitemaps = new Set<string>();
  const finalPageUrls = new Set<string>();

  // Safety caps to prevent infinite parsing runaway logs
  const MAX_SITEMAPS_TO_PROCESS = 500; 

  while (sitemapQueue.length > 0) {
    // Safety check against runaway loops
    if (visitedSitemaps.size >= MAX_SITEMAPS_TO_PROCESS) {
      console.warn(`[Warning] Reached safety cap of ${MAX_SITEMAPS_TO_PROCESS} sitemaps. Stopping discovery.`);
      break;
    }

    // Shift removes from front (Breadth-First-Search style parsing)
    const currentSitemap = sitemapQueue.shift()!;
    
    if (visitedSitemaps.has(currentSitemap)) continue;
    visitedSitemaps.add(currentSitemap);

    console.log(`[Crawler] Parsing index (${visitedSitemaps.size}): ${currentSitemap}`);
    const { sitemaps, pages } = await parseSingleSitemap(currentSitemap);

    // Push newly discovered nested links back onto our checklist
    for (const childSitemap of sitemaps) {
      if (!visitedSitemaps.has(childSitemap)) {
        sitemapQueue.push(childSitemap);
      }
    }

    // Save final pages
    for (const page of pages) {
      finalPageUrls.add(page);
    }
  }

  const result = Array.from(finalPageUrls);
  console.log(`\n[Discovery Complete] Processed ${visitedSitemaps.size} sitemaps. Discovered ${result.length} unique pages.`);
  return result;
};


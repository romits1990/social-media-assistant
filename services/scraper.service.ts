// src/services/scraper.service.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { SCRAP_DUMP_FOLDER } from '@/constants/scrap.constants';

export type ScrapedPageData = {
  url: string;
  title: string;
  description: string;
  h1: string[];
  textContent: string;
  images: string[];
};

export type GetFilesOptions = {
  limit?: number;
};

/**
 * Extracts candidate URLs from a srcset string and returns the highest resolution option
 */
const getBestUrlFromSrcset = (srcset: string, baseUrl: string): string | null => {
  if (!srcset) return null;

  try {
    const candidates = srcset
      .split(',')
      .map((entry) => entry.trim().split(/\s+/))
      .filter((parts) => parts.length > 0 && parts[0])
      .map(([url, descriptor]) => {
        let width = 0;
        if (descriptor) {
          if (descriptor.endsWith('w')) {
            width = parseInt(descriptor.replace('w', ''), 10) || 0;
          } else if (descriptor.endsWith('x')) {
            width = (parseFloat(descriptor.replace('x', '')) || 1) * 800; // Estimate 2x/3x scale
          }
        }
        return { url, width };
      });

    if (candidates.length === 0) return null;

    // Sort descending by width descriptor
    candidates.sort((a, b) => b.width - a.width);

    return new URL(candidates[0].url, baseUrl).toString();
  } catch {
    return null;
  }
};

/**
 * Parses image dimension hints from URL query parameters or filename patterns
 * e.g., 'banner-1200x800.jpg', '?w=1080', '?width=1920'
 */
const inferDimensionsFromUrl = (url: string): { width: number; height: number } => {
  let width = 0;
  let height = 0;

  try {
    const parsedUrl = new URL(url);

    // 1. Check URL query params (Cloudinary, Imgix, Next.js, Unsplash)
    const qWidth = parseInt(parsedUrl.searchParams.get('w') || parsedUrl.searchParams.get('width') || '0', 10);
    const qHeight = parseInt(parsedUrl.searchParams.get('h') || parsedUrl.searchParams.get('height') || '0', 10);

    if (qWidth > 0) width = qWidth;
    if (qHeight > 0) height = qHeight;

    // 2. Check filename dimension pattern (WordPress image-1024x768.jpg)
    const filenameMatch = parsedUrl.pathname.match(/[-_](\d{3,4})x(\d{3,4})\.(jpg|jpeg|png|webp)$/i);
    if (filenameMatch) {
      width = parseInt(filenameMatch[1], 10);
      height = parseInt(filenameMatch[2], 10);
    }
  } catch { /* Suppress URL parse errors */ }

  return { width, height };
};

/**
 * Extracts, scores, and ranks candidate image URLs for social media posts.
 * Returns sorted list of absolute image URLs (Index 0 is the best candidate).
 */
const extractAndRankImages = ($dom: cheerio.CheerioAPI, baseUrl: string): string[] => {
  const uniqueCandidates = new Map<string, number>();

  const registerCandidate = (rawUrl: string | undefined | null, scoreBoost: number) => {
    if (!rawUrl) return;

    try {
      // 1. Instantly reject non-HTTP, inline base64, tracking pixels, and unsupported social formats
      const cleanRaw = rawUrl.trim();
      const lowerRaw = cleanRaw.toLowerCase();

      if (
        cleanRaw.startsWith('data:') ||
        lowerRaw.endsWith('.svg') ||
        lowerRaw.endsWith('.gif') ||
        lowerRaw.endsWith('.ico') ||
        lowerRaw.includes('pixel') ||
        lowerRaw.includes('spacer') ||
        lowerRaw.includes('analytics') ||
        lowerRaw.includes('gravatar.com')
      ) {
        return;
      }

      const absoluteUrl = new URL(cleanRaw, baseUrl).toString();

      // Cumulative scoring for duplicates
      const currentScore = uniqueCandidates.get(absoluteUrl) ?? 0;
      uniqueCandidates.set(absoluteUrl, Math.max(currentScore, scoreBoost));
    } catch { /* Suppress invalid URL construction */ }
  };

  // ─────────────────────────────────────────────────────────────
  // STEP 1: OpenGraph & Twitter Card Meta Tags (Authoritative - Tier 1)
  // ─────────────────────────────────────────────────────────────
  const ogImage = $dom('meta[property="og:image"], meta[property="og:image:secure_url"]').attr('content');
  const twitterImage = $dom('meta[name="twitter:image"], meta[name="twitter:image:src"]').attr('content');
  const linkRelImage = $dom('link[rel="image_src"]').attr('href');

  registerCandidate(ogImage, 110);
  registerCandidate(twitterImage, 100);
  registerCandidate(linkRelImage, 90);

  // ─────────────────────────────────────────────────────────────
  // STEP 2: Schema.org Structured Data (JSON-LD - Tier 1)
  // ─────────────────────────────────────────────────────────────
  $dom('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonText = $dom(el).html();
      if (!jsonText) return;

      const schemaData = JSON.parse(jsonText);
      const items = Array.isArray(schemaData) ? schemaData : [schemaData];

      for (const item of items) {
        // Direct image attribute
        if (typeof item.image === 'string') {
          registerCandidate(item.image, 100);
        } else if (Array.isArray(item.image)) {
          item.image.forEach((img: any) => {
            if (typeof img === 'string') registerCandidate(img, 95);
            else if (img?.url) registerCandidate(img.url, 95);
          });
        } else if (item.image?.url) {
          registerCandidate(item.image.url, 100);
        }

        // PrimaryImageOfPage
        if (item.primaryImageOfPage?.url) {
          registerCandidate(item.primaryImageOfPage.url, 105);
        }
      }
    } catch { /* Suppress JSON-LD parse errors */ }
  });

  // ─────────────────────────────────────────────────────────────
  // STEP 3: Scan <picture> and <img> elements in HTML DOM (Tier 2)
  // ─────────────────────────────────────────────────────────────
  $dom('picture source, img').each((index, el) => {
    const $el = $dom(el);

    // A. Check srcset first for high-res responsive candidates
    const srcset = $el.attr('srcset') || $el.attr('data-srcset');
    if (srcset) {
      const bestSrcsetUrl = getBestUrlFromSrcset(srcset, baseUrl);
      if (bestSrcsetUrl) {
        registerCandidate(bestSrcsetUrl, 60);
      }
    }

    // B. Check standard/lazy src attributes
    const src =
      $el.attr('data-src') ||
      $el.attr('data-lazy-src') ||
      $el.attr('data-original') ||
      $el.attr('src');

    if (!src) return;

    try {
      const absoluteUrl = new URL(src, baseUrl).toString();
      const lowerUrl = absoluteUrl.toLowerCase();

      // If already captured with high OG/Schema score, don't degrade score
      if ((uniqueCandidates.get(absoluteUrl) ?? 0) >= 90) return;

      let score = 20; // Base score for HTML body images

      // Keyword Scoring (Positive)
      if (lowerUrl.includes('featured') || lowerUrl.includes('hero')) score += 40;
      if (lowerUrl.includes('banner') || lowerUrl.includes('main') || lowerUrl.includes('cover')) score += 30;
      if (lowerUrl.includes('/uploads/') || lowerUrl.includes('/media/') || lowerUrl.includes('/wp-content/')) score += 15;

      // Keyword Scoring (Negative - Layout Artifacts)
      if (lowerUrl.includes('logo')) score -= 80;
      if (lowerUrl.includes('avatar') || lowerUrl.includes('user') || lowerUrl.includes('profile') || lowerUrl.includes('author')) score -= 60;
      if (lowerUrl.includes('icon') || lowerUrl.includes('badge') || lowerUrl.includes('button') || lowerUrl.includes('sprite')) score -= 50;
      if (lowerUrl.includes('theme') || lowerUrl.includes('asset') || lowerUrl.includes('bg-') || lowerUrl.includes('footer')) score -= 40;

      // Dimension Scoring (from HTML attributes)
      const attrWidth = parseInt($el.attr('width') || '0', 10);
      const attrHeight = parseInt($el.attr('height') || '0', 10);

      // Dimension Scoring (inferred from URL query parameters / filename)
      const inferred = inferDimensionsFromUrl(absoluteUrl);
      const effectiveWidth = attrWidth || inferred.width;
      const effectiveHeight = attrHeight || inferred.height;

      if (effectiveWidth >= 800 && effectiveHeight >= 500) {
        score += 45; // Hero / High-Res image
      } else if (effectiveWidth >= 400 && effectiveHeight >= 300) {
        score += 25;
      } else if (effectiveWidth > 0 && effectiveWidth < 120) {
        score -= 60; // Tiny thumbnail / icon
      }

      // DOM Context Weighting (Images inside <article> or <main> near top of page)
      const isInsideArticle = $el.closest('article, main, #content, .post-content').length > 0;
      if (isInsideArticle) score += 20;

      // Early DOM Position Boost (Top 3 images on page get a slight preference)
      if (index < 3) score += 15;

      registerCandidate(absoluteUrl, score);
    } catch { /* Suppress invalid URLs */ }
  });

  // Compile candidates, drop layout noise (score <= 0), and sort descending
  return Array.from(uniqueCandidates.entries())
    .filter(([_, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([candidateUrl]) => candidateUrl);
};

export const scrapePage = async (url: string): Promise<ScrapedPageData | null> => {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    const $dom = cheerio.load(html);

    // 1. Process image logic first before running destructive tag removals
    const prioritizedImages = extractAndRankImages($dom, url);

    // 2. Clear out heavy layout containers that pollute clean body text strings
    $dom('script, style, nav, header, footer, noscript, iframe, .sidebar, .menu, .footer, .header').remove();

    const title = $dom('title').text().trim() || '';
    const description = $dom('meta[name="description"]').attr('content')?.trim() || '';

    const h1: string[] = [];
    $dom('h1').each((_, el) => {
      const text = $dom(el).text().trim();
      if (text) h1.push(text);
    });

    let bodyContainer = $dom('main, article, #content, .content, .main');
    if (bodyContainer.length === 0) {
      bodyContainer = $dom('body');
    }

    const textContent = bodyContainer.text().trim();

    return {
      url,
      title,
      description,
      h1,
      textContent,
      images: prioritizedImages,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown network failure';
    console.error(`[Scraper Error] Failed extraction on: ${url} -> ${errorMsg}`);
    return null;
  }
};

export const createScrapDumpDirectory = async (domainFolderName: string) => {
  const outputDir = path.join(process.cwd(), SCRAP_DUMP_FOLDER, domainFolderName);
  await fs.mkdir(outputDir, { recursive: true });
  return outputDir;
};

export const deleteScrapDumpDirectory = async (directoryPath: string) => {
  await fs.rmdir(directoryPath);
};

export const writeScrapedContentToFile = async (content: ScrapedPageData, url: string, outputDir: string) => {
  const fileName = createHash('sha256').update(url).digest('hex') + '.json';
  const fullFilePath = path.join(outputDir, fileName);
  await fs.writeFile(fullFilePath, JSON.stringify(content, null, 2), 'utf-8');
};

export const getScrapedPageFiles = async (
  domainFolderName: string,
  options?: GetFilesOptions
): Promise<string[]> => {
  try {
    const scrapDumpPath = path.join(process.cwd(), SCRAP_DUMP_FOLDER, domainFolderName);
    const files: string[] = await fs.readdir(scrapDumpPath);

    const jsonFiles = files.filter((fileName) => fileName.endsWith('.json'));

    if (options?.limit && options.limit > 0) {
      return jsonFiles.slice(0, options.limit);
    }

    return jsonFiles;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error occurred when getting folder content of ${domainFolderName}: ${errorMessage}`);
    return [];
  }
};

export const readScrapedFileContent = async (
  fileName: string,
  domainFolderName: string
): Promise<ScrapedPageData | null> => {
  try {
    const filePath = path.join(process.cwd(), SCRAP_DUMP_FOLDER, domainFolderName, fileName);
    const rawContent = await fs.readFile(filePath, 'utf-8');
    const parsedContent = JSON.parse(rawContent);
    return parsedContent as ScrapedPageData;
  } catch {
    return null;
  }
};
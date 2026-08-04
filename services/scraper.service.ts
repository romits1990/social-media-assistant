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
  images: string[]
};

export type GetFilesOptions = {
  limit?: number
};

/**
 * Extracts, scores, and prioritizes image URLs from a web page document.
 * Places the absolute best candidate for an Instagram post at index 0.
 * 
 * @param $dom The loaded Cheerio DOM instance
 * @param baseUrl The source URL of the webpage to resolve relative paths
 */
const extractAndRankImages = ($dom: cheerio.CheerioAPI, baseUrl: string): string[] => {
  const uniqueCandidates = new Map<string, number>();

  // 1. Extract High-Fidelity Social OpenGraph / Twitter Banner declarations
  const metaHeroImage =
    $dom('meta[property="og:image"]').attr('content')?.trim() ||
    $dom('meta[name="twitter:image"]').attr('content')?.trim() ||
    $dom('link[rel="image_src"]').attr('href')?.trim();

  if (metaHeroImage) {
    try {
      const absoluteMeta = new URL(metaHeroImage, baseUrl).toString();
      uniqueCandidates.set(absoluteMeta, 100); // Top tier starting baseline
    } catch { /* Suppress malformed meta strings */ }
  }

  // 2. Scan standard HTML body image tags
  $dom('img').each((_, el) => {

    // WORDPRESS FIX: Look for actual image paths inside lazy-load variables first
    const src =
      $dom(el).attr('data-src')?.trim() ||       // Common JS Lazy Loaders
      $dom(el).attr('data-lazy-src')?.trim() ||  // WP Rocket / Optimization plugins
      $dom(el).attr('data-original')?.trim() ||  // Older lazy loaders
      $dom(el).attr('src')?.trim();              // Standard fallback

    if (!src) return;

    // Instantly exclude analytical tracking elements, spacers, and heavy base64 configurations
    if (
      src.startsWith('data:') ||
      src.includes('pixel') ||
      src.includes('spacer') ||
      src.includes('loading') ||
      src.includes('analytics')
    ) {
      return;
    }

    try {
      // Resolve relative path parameters into fully qualified absolute web addresses
      const absoluteUrl = new URL(src, baseUrl).toString();

      // If already captured and prioritized by OpenGraph tags, skip evaluation
      if (uniqueCandidates.has(absoluteUrl)) return;

      let currentScore = 0;
      const lowerUrl = absoluteUrl.toLowerCase();

      // High Probability Article Content Keywords
      if (lowerUrl.includes('featured') || lowerUrl.includes('hero')) currentScore += 50;
      if (lowerUrl.includes('banner') || lowerUrl.includes('main')) currentScore += 30;
      if (lowerUrl.includes('/uploads/') || lowerUrl.includes('/media/') || lowerUrl.includes('/wp-content/')) currentScore += 20;

      // Low Probability Layout Artifact Keywords (Template assets)
      if (lowerUrl.includes('logo')) currentScore -= 80;
      if (lowerUrl.includes('avatar') || lowerUrl.includes('user') || lowerUrl.includes('profile')) currentScore -= 60;
      if (lowerUrl.includes('icon') || lowerUrl.includes('badge') || lowerUrl.includes('button')) currentScore -= 50;
      if (lowerUrl.includes('theme') || lowerUrl.includes('asset') || lowerUrl.includes('bg-')) currentScore -= 30;

      // Parse design dimension hints if embedded directly in attributes
      const explicitWidth = parseInt($dom(el).attr('width') || '0', 10);
      const explicitHeight = parseInt($dom(el).attr('height') || '0', 10);

      if (explicitWidth > 400 && explicitHeight > 400) currentScore += 40;
      if (explicitWidth > 0 && explicitWidth < 80) currentScore -= 50;

      uniqueCandidates.set(absoluteUrl, currentScore);
    } catch (err) {
      console.log(err);
      /* Suppress runtime URL build conversion errors */
}
  });

  // Compile, filter out complete layout trash, and sort descending by score
  return Array.from(uniqueCandidates.entries())
    .filter(([_, score]) => score > -30)
    .sort((a, b) => b[1] - a[1]) // Fixed: explicitly extracts and subtracts the numeric scores
    .map(([candidateUrl]) => candidateUrl);
};

export const scrapePage = async (url: string): Promise<ScrapedPageData | null> => {
  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    const $dom = cheerio.load(html);

    // 1. Process image logic first before we run destructive tag removals
    const prioritizedImages = extractAndRankImages($dom, url);

    // 2. Clear out heavy layout containers that pollute clean core body text text strings
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
      images: prioritizedImages
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
  await fs.writeFile(
    fullFilePath,
    JSON.stringify(content, null, 2),
    'utf-8'
  );
};

export const getScrapedPageFiles = async (
  domainFolderName: string,
  options?: GetFilesOptions
): Promise<string[]> => {
  try {
    const scrapDumpPath = path.join(process.cwd(), SCRAP_DUMP_FOLDER, domainFolderName);
    const files: string[] = await fs.readdir(scrapDumpPath);

    // 1. Filter for JSON files first
    const jsonFiles = files.filter(fileName => fileName.endsWith('.json'));

    // 2. Apply limit if provided and valid (> 0)
    if (options?.limit && options.limit > 0) {
      return jsonFiles.slice(0, options.limit);
    }

    return jsonFiles;
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error occurred when getting folder content of ${domainFolderName}: ${errorMessage}`);
    return [];
  }
};

export const readScrapedFileContent = async (fileName: string, domainFolderName: string): Promise<ScrapedPageData | null> => {
  try {
    const filePath = path.join(process.cwd(), SCRAP_DUMP_FOLDER, domainFolderName, fileName);
    const rawContent = await fs.readFile(filePath, 'utf-8');
    const parsedContent = JSON.parse(rawContent);
    return parsedContent as ScrapedPageData;
  }
  catch (error) {
    return null;
  }
};

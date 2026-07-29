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
}

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

    $dom('script, style, noscript, iframe, svg, nav, footer, header').remove();

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
      textContent
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

export const getScrapedPageFiles = async (domainFolderName: string): Promise<string[]> => {
    try {
        const scrapDumpPath = path.join(process.cwd(), SCRAP_DUMP_FOLDER, domainFolderName);
        const files: string[] = await fs.readdir(scrapDumpPath);
        return files.filter(fileName => fileName.endsWith('.json'));
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

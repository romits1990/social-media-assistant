import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedPageData {
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

    const textContent = bodyContainer
      .text()
      .replace(/\s+/g, ' ')
      .trim();

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

import { getValidUrlDetails } from "@/lib/url.helper";
import { processSitemapUrl } from "@/services/sitemap-parser.service";

export const extractPageUrls = async (rootSitemapUrl: string): Promise<string[]> => {
    const pageUrls: string[] = await processSitemapUrl(rootSitemapUrl);
    return pageUrls.filter(url => getValidUrlDetails(url).isValid);
};
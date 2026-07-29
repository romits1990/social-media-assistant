import { parseArgs } from 'node:util';
import { getValidUrlDetails } from "@/lib/url.helper";
import { extractPageUrls } from "@/services/crawler.service";
import { scrapePage, createScrapDumpDirectory, deleteScrapDumpDirectory, writeScrapedContentToFile } from '@/services/scrapper.service';

const argsSchema = {
    options: {
        sitemapUrl: { type: 'string', short: 'u' }
    }
} as const;

const run = async () => {
    try {
        const { values } = parseArgs(argsSchema);
        const { isValid, url: rootUrl, hostname } = getValidUrlDetails(values?.sitemapUrl);
        if (!isValid) {
            console.error('Error: --sitemapUrl (-u) must be a valid http or https web address.');
            process.exit(1);
        }
        
        console.log(`Starting crawl for sitemap: ${rootUrl}`);

        const pageUrls = await extractPageUrls(rootUrl!);
        if(pageUrls.length == 0) {
            console.error('Error: Page urls are empty.');
            process.exit(1);
        }

        const outputDir = await createScrapDumpDirectory(hostname!);

        let processedPageCount = 0;
        for(const url of pageUrls) {
            const scrapeResults = await scrapePage(url);
            if (scrapeResults && scrapeResults.textContent) {
                console.log(`[Success] Extracted ${scrapeResults.textContent.length} characters.`);
                await writeScrapedContentToFile(scrapeResults, url, outputDir);
                processedPageCount++;
            }
        }
        if(processedPageCount == 0) {
            console.log("No Page processed.");
            await deleteScrapDumpDirectory(outputDir);
        }

        console.log('Page content download completed successfully.');
        process.exit(0);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Execution failed: ${errorMessage}`);
        process.exit(1);
    }
};

run();


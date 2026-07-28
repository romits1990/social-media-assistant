import { parseArgs } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { getValidUrlDetails } from "@/lib/url.helper";
import { extractPageUrls } from "@/services/crawler.service";
import { scrapePage } from '@/services/scrapper.service';
import { SCRAP_DUMP_FOLDER } from '@/constants/scrap.constants';

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

        const outputDir = path.join(process.cwd(), SCRAP_DUMP_FOLDER, hostname!);
        await fs.mkdir(outputDir, { recursive: true });

        let processedPageCount = 0;
        for(const url of pageUrls) {
            const scrapeResults = await scrapePage(url);
            if (scrapeResults && scrapeResults.textContent) {
                console.log(`[Success] Extracted ${scrapeResults.textContent.length} characters.`);
                const fileName = createHash('sha256').update(url).digest('hex') + '.json';
                const fullFilePath = path.join(outputDir, fileName);
                await fs.writeFile(
                    fullFilePath, 
                    JSON.stringify(scrapeResults, null, 2),
                    'utf-8'
                );
                processedPageCount++;
            }
        }
        if(processedPageCount == 0) {
            console.log("No Page processed.");
            await fs.rmdir(outputDir);
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

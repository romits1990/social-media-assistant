import { parseArgs } from 'node:util';
import pLimit from 'p-limit';
import { getValidUrlDetails } from "@/lib/url.helper";
import { getScrapedPageFiles, readScrapedFileContent, ScrapedPageData } from "@/services/scrapper.service";
import { cleanTextContent } from '@/lib/embedding.helper';

const limit = pLimit(3);

const argsSchema = {
    options: {
        url: { type: 'string', short: 'u' }
    }
} as const;

const run = async () => {
    try {
        const { values } = parseArgs(argsSchema);
        const { isValid, hostname } = getValidUrlDetails(values?.url);
        if (!isValid) {
            console.error('Error: --url (-u) must be a valid http or https web address.');
            process.exit(1);
        }

        const jsonFiles = await getScrapedPageFiles(hostname!);
        if (jsonFiles.length === 0) {
            console.warn(`No scraped JSON files found in directory: ${hostname}`);
            process.exit(0);
        }

        console.log(`Starting ingestion for website: ${hostname}`);


        console.log(`Found ${jsonFiles.length} files to ingest. Processing...`);

        const pipelineTasks = jsonFiles.map((fileName) => {
            return limit(async () => {
                const pageData: ScrapedPageData | null = await readScrapedFileContent(fileName, hostname!);
                if(!pageData) {
                    return;
                }

                const cleanedPageContent = cleanTextContent(pageData.textContent);
                console.log(`[Processing] File: ${fileName} | Chars: ${pageData.textContent.length} | AfterCleanupChars: ${cleanedPageContent.length}`);
            });
        });

        await Promise.all(pipelineTasks);

        console.log('Ingestion process completed successfully.');
        process.exit(0);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Execution failed: ${errorMessage}`);
        process.exit(1);
    }
};

run();

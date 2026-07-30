import { parseArgs } from 'node:util';
import { getValidUrlDetails } from "@/lib/utils/url.helper";
import { getScrapedPageFiles, readScrapedFileContent, ScrapedPageData } from "@/services/scraper.service";
import { processAndEmbedPageContent } from '@/services/embedding.service';
import { executeConcurrentPipeline } from '@/lib/utils/pipeline.helper';
import { closeDbConnection } from '@/lib/db';

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

        const ingestionTask = async (fileName: string) => {
            try {
                const pageData: ScrapedPageData | null = await readScrapedFileContent(fileName, hostname!);
                if (!pageData) {
                    return;
                }

                await processAndEmbedPageContent(pageData);
            } catch (taskError) {
                const msg = taskError instanceof Error ? taskError.message : 'Unknown task error';
                console.error(`❌ [Task Failed] Error processing file "${fileName}": ${msg}`);
            }
        };

        const pipelineTasks = jsonFiles.map((fileName) => {
            return async () => ingestionTask(fileName);
        });

        await executeConcurrentPipeline(pipelineTasks, { concurrency: 3 });

        console.log('Ingestion process completed successfully.');
        process.exitCode = 0;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Execution failed: ${errorMessage}`);
        process.exitCode = 1;
    } finally {
        await closeDbConnection();
        process.exit(process.exitCode || 0);
    }
};

run();

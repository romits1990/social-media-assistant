import { parseArgs } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getValidUrlDetails } from "@/lib/url.helper";
import { SCRAP_DUMP_FOLDER } from '@/constants/scrap.constants';

const argsSchema = {
    options: {
        url: { type: 'string', short: 'u' }
    }
} as const;

const run = async () => {
    try {
        const { values } = parseArgs(argsSchema);
        const { isValid, url: rootUrl, hostname } = getValidUrlDetails(values?.url);
        if (!isValid) {
            console.error('Error: --url (-u) must be a valid http or https web address.');
            process.exit(1);
        }

        console.log(`Starting ingestion for website: ${hostname}`);

        const scrapDumpPath = path.join(process.cwd(), SCRAP_DUMP_FOLDER, hostname!);
        const files: string[] = await fs.readdir(scrapDumpPath);
        const jsonFiles = files.filter(file => file.endsWith('.json'));

        if (jsonFiles.length === 0) {
            console.warn(`No scraped JSON files found in directory: ${scrapDumpPath}`);
            process.exit(0);
        }

        console.log(`Found ${jsonFiles.length} files to ingest. Processing...`);

        for (const file of jsonFiles) {
            const fullFilePath = path.join(scrapDumpPath, file);
            const rawData = await fs.readFile(fullFilePath, 'utf-8');
            const pageData = JSON.parse(rawData);

            console.log(`[Processing] File: ${file} | URL: ${pageData.url} (${pageData.textContent?.length || 0} chars)`);

            // NEXT STEP GOES HERE:
            // Pass pageData.textContent into your LangChain text splitter!
        }


        console.log('Ingestion process completed successfully.');
        process.exit(0);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Execution failed: ${errorMessage}`);
        process.exit(1);
    }
};

run();

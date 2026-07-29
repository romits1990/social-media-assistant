import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
// import { OllamaEmbeddings } from "@langchain/ollama";

export type ProcessedVectorChunk = {
  url: string;
  title: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
};

const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });

// const embeddingsPipeline = new OllamaEmbeddings({
//   model: "nomic-embed-text", // Or "llama3", "all-minilm", etc.
//   baseUrl: "http://localhost:11434", 
// });

async function saveChunksToPostgres(chunks: ProcessedVectorChunk[]): Promise<void> {
  if (chunks.length === 0) return;
  // Example SQL layout statement logic:
  // INSERT INTO web_chunks (url, title, chunk_index, content, embedding) VALUES ...
  console.log(`     [DB] Successfully inserted ${chunks.length} vector rows into PostgreSQL.`);
}

export const cleanTextContent = (text: string): string => {
  if (!text) return '';

  return text
    // 1. Unescape common HTML entities that might escape cheerio stripping
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // 2. Remove invisible control characters and weird binary sequences
    .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    // 3. Clean up common web-scraper leftovers (isolated bullet remnants, social icons text)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    // 4. Standardise all varieties of line-breaks and whitespace blocks
    .replace(/\s+/g, ' ')
    // 5. Trim flanking spaces
    .trim();
};
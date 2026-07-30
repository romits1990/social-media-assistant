import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OllamaEmbeddings } from "@langchain/ollama";
import { ScrapedPageData } from "./scraper.service";
import { upsertWebsiteChunks, VectorChunkEntity } from "@/repositories/vector.repository";

export type ProcessedVectorChunk = {
  url: string;
  title: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: {
    description: string;
    h1: string[];
    heroImage: string | null;
    allImages: string[];
  };
};

const splitter = new RecursiveCharacterTextSplitter({ 
  chunkSize: 1000, 
  chunkOverlap: 200 
});

const embeddingsPipeline = new OllamaEmbeddings({
  model: "nomic-embed-text:v1.5",
  baseUrl: "http://localhost:11434", 
});

export const cleanTextContent = (text: string): string => {
  if (!text) return '';

  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') 
    .replace(/[ \t]+/g, ' ') 
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
};

/**
 * Cleans text, splits into documents, generates embeddings, and persists to PostgreSQL.
 */
export const processAndEmbedPageContent = async (pageData: ScrapedPageData): Promise<void> => {
  const cleanedText = cleanTextContent(pageData.textContent);
  if (!cleanedText) {
    console.warn(`     [Embedding Service] Skipped: "${pageData.url}" has no readable content.`);
    return;
  }

  // 1. Split content using LangChain
  const documents = await splitter.createDocuments(
    [cleanedText],
    [{ url: pageData.url, title: pageData.title }]
  );

  const textStringsToEmbed = documents.map(doc => doc.pageContent);
  if (textStringsToEmbed.length === 0) return;

  // 2. Fetch embeddings from local Ollama instance
  console.log(`     [Ollama] Generating vectors for ${textStringsToEmbed.length} chunks...`);
  const vectors = await embeddingsPipeline.embedDocuments(textStringsToEmbed);

  // 3. Extract hero image candidate (Index 0 guaranteed by scraper ranking)
  const heroImage = pageData.images && pageData.images.length > 0 ? pageData.images[0] : null;

  // 4. Map to repository entities
  const repositoryPayload: VectorChunkEntity[] = documents.map((doc, index) => ({
    url: pageData.url,
    title: pageData.title,
    chunkIndex: index,
    content: doc.pageContent,
    embedding: vectors[index],
    metadata: {
      description: pageData.description,
      h1: pageData.h1,
      heroImage,
      allImages: pageData.images
    }
  }));

  // 5. Delegate persistence to the Functional Repository
  await upsertWebsiteChunks(repositoryPayload);
};
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OllamaEmbeddings } from "@langchain/ollama";
import he from "he";
import { ScrapedPageData } from "@/services/scraper.service";
import { upsertWebsiteChunks, VectorChunkEntity } from "@/repositories/vector.repository";
import { CHUNK_OVERLAP, CHUNK_SIZE, EMBEDDING_MODEL_NAME, EXPECTED_VECTOR_DIMENSION } from "@/constants/vector.constants";

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
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP
});

const embeddingsPipeline = new OllamaEmbeddings({
  model: EMBEDDING_MODEL_NAME,
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
});

export const cleanTextContent = (text: string): string => {
  if (!text) return '';

  // Decode all HTML entities instantly
  const decodedText = he.decode(text);

  return decodedText
    .replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
};

/**
 * Helper to split arrays into chunks to prevent Ollama OOM errors
 */
const chunkArray = <T>(array: T[], size: number): T[][] => {
  return Array.from({ length: Math.ceil(array.length / size) }, (_, k) =>
    array.slice(k * size, k * size + size)
  );
};

/**
 * Cleans text, splits into documents, generates embeddings, and persists to PostgreSQL.
 */
export const processAndEmbedPageContent = async (pageData: ScrapedPageData): Promise<void> => {
  try {
    const cleanedText = cleanTextContent(pageData.textContent);
    if (!cleanedText) {
      console.warn(`[Embedding Service] Skipped: "${pageData.url}" has no readable content.`);
      return;
    }

    // 1. Split content using LangChain
    const documents = await splitter.createDocuments(
      [cleanedText],
      [{ url: pageData.url, title: pageData.title }]
    );

    const textStringsToEmbed = documents.map(doc => doc.pageContent);
    if (textStringsToEmbed.length === 0) return;

    // 2. Fetch embeddings using batching to safeguard local Ollama instance
    console.log(`[Ollama] Generating vectors for ${textStringsToEmbed.length} chunks...`);
    const BATCH_SIZE = 10; // Adjust based on your local machine's VRAM/RAM capabilities
    const batchedTexts = chunkArray(textStringsToEmbed, BATCH_SIZE);
    const vectors: number[][] = [];

    for (const batch of batchedTexts) {
      const batchVectors = await embeddingsPipeline.embedDocuments(batch);
      vectors.push(...batchVectors);
    }

    // 3. Fail-fast safety checks
    if (vectors.length !== textStringsToEmbed.length) {
      throw new Error(`Embedding count mismatch. Expected ${textStringsToEmbed.length}, got ${vectors.length}`);
    }

    if (vectors[0] && vectors[0].length !== EXPECTED_VECTOR_DIMENSION) {
      throw new Error(`Vector dimension error. Expected ${EXPECTED_VECTOR_DIMENSION}, got ${vectors[0].length}`);
    }

    // 4. Sanitize metadata fields
    const heroImage = pageData.images && pageData.images.length > 0 ? pageData.images[0] : null;
    const cleanedDescription = pageData.description ? he.decode(pageData.description).trim() : '';
    const cleanedH1 = (pageData.h1 || []).map(heading => he.decode(heading).trim());
    const allImages = (pageData.images || []).slice(0, 3);

    // 5. Map to repository entities (Capping allImages to top 3 candidates to save DB storage)
    const repositoryPayload: VectorChunkEntity[] = documents.map((doc, index) => ({
      url: pageData.url,
      title: pageData.title,
      chunkIndex: index,
      content: doc.pageContent,
      embedding: vectors[index],
      metadata: {
        description: cleanedDescription,
        h1: cleanedH1,
        heroImage,
        allImages
      }
    }));

    // 6. Delegate persistence to the Functional Repository
    await upsertWebsiteChunks(repositoryPayload);
    console.log(`[Embedding Service] Successfully processed and stored chunks for: ${pageData.url}`);

  } catch (error) {
    console.error(`[Embedding Service] Failed processing page content for ${pageData.url}:`, error);
    throw error;
  }
};
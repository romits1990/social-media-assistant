import { OllamaEmbeddings } from "@langchain/ollama";
import { findSimilarChunks } from "@/repositories/vector.repository";
import { EMBEDDING_MODEL_NAME } from "@/constants/vector.constants";
import { AgentState } from "../agent.state";

const embeddingsPipeline = new OllamaEmbeddings({
  model: EMBEDDING_MODEL_NAME,
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
});

/**
 * Node 1: Fetches context chunks from Postgres pgvector using cosine distance.
 */
export const retrieverNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  try {
    console.log(`🤖 [Retriever Agent] Processing topic: "${state.targetTopic}"...`);

    // 1. Fetch top 10 candidate chunks across vector space
    const queryVector = await embeddingsPipeline.embedQuery(state.targetTopic);
    const rawChunks = await findSimilarChunks(queryVector, 10, 0.65);

    if (rawChunks.length === 0) {
      console.warn(`⚠️ [Retriever Agent] No relevant context found for: "${state.targetTopic}"`);
      return { status: "WRITING", contextSummary: "No relevant content found." };
    }

    // 2. Identify the single best-matching URL (Index 0 is the highest vector match)
    const targetUrl = rawChunks[0].url;

    // 3. Filter retrieved chunks to ONLY keep those from the winning URL
    const pageChunks = rawChunks
      .filter((c) => c.url === targetUrl)
      .sort((a, b) => a.chunkIndex - b.chunkIndex); // Sort in natural reading order

    // 4. Extract page metadata from the top chunk
    const primaryTitle = pageChunks[0].title;
    const primaryHeroImage = pageChunks[0].metadata?.heroImage || null;

    // 5. Build context summary exclusively for this single page
    const contextSummary = pageChunks.map((c) => c.content).join("\n\n");

    console.log(`✅ [Retriever Agent] Successfully retrieved ${pageChunks.length} contextual chunks.`);

    return {
      retrievedChunks: pageChunks,
      selectedHeroImage: primaryHeroImage,
      contextSummary: `[Source: ${primaryTitle} (${targetUrl})]\n\n${contextSummary}`,
      status: "WRITING",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error in retriever node";
    console.error(`❌ [Retriever Agent Error]: ${msg}`);
    return {
      status: "FAILED",
      errorMessage: msg,
    };
  }
};
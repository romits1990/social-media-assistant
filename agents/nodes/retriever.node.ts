import { OllamaEmbeddings } from "@langchain/ollama";
import { findSimilarChunks } from "@/repositories/vector.repository";
import { EMBEDDING_MODEL_NAME } from "@/constants/vector.constants";
import { AgentState } from "@/agents/agent.state";

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
      return { 
        retrievedChunks: [],
        selectedHeroImage: null,
        contextSummary: "No relevant internal content found.", 
        status: "WRITING" 
      };
    }

    // 2. Identify the single best-matching URL (Index 0 is the highest vector match)
    const targetUrl = rawChunks[0].url;

    // 3. Filter retrieved chunks to ONLY keep those from the winning URL
    const pageChunks = rawChunks
      .filter((c) => c.url === targetUrl)
      .sort((a, b) => a.chunkIndex - b.chunkIndex); // Sort in natural reading order

    // 4. Extract page metadata safely from the top chunk
    const primaryChunk = pageChunks[0];
    const primaryTitle = primaryChunk.title || "Untitled Page";
    const primaryDescription = primaryChunk.metadata?.description || "";
    const primaryH1 = Array.isArray(primaryChunk.metadata?.h1) 
      ? primaryChunk.metadata.h1.join(", ") 
      : "";
    const primaryHeroImage = primaryChunk.metadata?.heroImage || null;

    // 5. Build full body content text from sorted chunks
    const chunksContent = pageChunks.map((c) => c.content).join("\n\n");

    // 6. Construct framed context summary for the Writer LLM (clean whitespace)
    const contextOverviewHeader = [
      `[SOURCE PAGE OVERVIEW]`,
      `Source URL: ${targetUrl}`,
      `Page Title: ${primaryTitle}`,
      primaryDescription ? `Meta Description: ${primaryDescription}` : null,
      primaryH1 ? `Main Headings: ${primaryH1}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const contextSummary = `${contextOverviewHeader}\n\n[DETAILED CONTENT CHUNKS]\n${chunksContent}`;

    console.log(`✅ [Retriever Agent] Successfully retrieved ${pageChunks.length} contextual chunks for ${targetUrl}`);

    return {
      retrievedChunks: pageChunks,
      selectedHeroImage: primaryHeroImage,
      contextSummary,
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
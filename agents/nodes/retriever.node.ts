import { OllamaEmbeddings } from "@langchain/ollama";
import { findSimilarChunks, VectorSearchResult } from "@/repositories/vector.repository";
import { EMBEDDING_MODEL_NAME } from "@/constants/vector.constants";
import { AgentState } from "@/agents/agent.state";

const embeddingsPipeline = new OllamaEmbeddings({
  model: EMBEDDING_MODEL_NAME,
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
});

const getHighestRankedTargetUrl = (rawChunks: VectorSearchResult[]) => {
  const urlScoreMap = new Map<string, { totalSimilarity: number; count: number }>();

  for (const chunk of rawChunks) {
    const current = urlScoreMap.get(chunk.url) || { totalSimilarity: 0, count: 0 };
    urlScoreMap.set(chunk.url, {
      totalSimilarity: current.totalSimilarity + chunk.similarity,
      count: current.count + 1,
    });
  }

  let targetUrl = rawChunks[0].url;
  let highestAvgScore = -1;
  urlScoreMap.forEach((stats, url) => {
    const avgScore = stats.totalSimilarity / stats.count;
    if (avgScore > highestAvgScore) {
      highestAvgScore = avgScore;
      targetUrl = url;
    }
  });

  return { targetUrl, highestAvgScore };
};

export const retrieverNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  if (state.status === "FAILED") return {};

  try {
    console.log(
      `🔍 [Retriever Agent] Vectorizing topic "${state.targetTopic}" ${
        state.targetDomain ? `[Scoped Domain: ${state.targetDomain}]` : ""
      }...`
    );

    const queryEmbedding = await embeddingsPipeline.embedQuery(state.targetTopic);

    // 1. Similarity query scoped by optional targetDomain
    const rawChunks = await findSimilarChunks(
      queryEmbedding,
      0.45,
      10,
      state.targetDomain
    );

    if (!rawChunks || rawChunks.length === 0) {
      console.warn(
        `⚠️ [Retriever Agent] No vector matches found for topic: "${state.targetTopic}" under domain "${
          state.targetDomain || "ALL"
        }"`
      );
      return {
        status: "EMPTY_CHUNKS",
        errorMessage: `No relevant content found matching topic: "${state.targetTopic}".`,
        retrievedChunks: [],
      };
    }

    // 2. Identify top parent document
    const { targetUrl, highestAvgScore } = getHighestRankedTargetUrl(rawChunks);
    const pageChunks = rawChunks
      .filter((c) => c.url === targetUrl)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    // 3. Extract metadata
    const primaryTitle = pageChunks[0].title || "Knowledge Article";
    const primaryDescription = pageChunks[0].metadata?.description || "";
    const primaryH1 = pageChunks[0].metadata?.h1?.join(", ") || "";
    const primaryHeroImage =
      pageChunks.find((c) => c.metadata?.heroImage)?.metadata?.heroImage ?? null;

    // 4. Validate Instagram Hero Image requirement
    if (state.platform === "instagram" && !primaryHeroImage) {
      console.warn(`⚠️ [Retriever Agent] Skipping Instagram post: No hero image on source page.`);
      return {
        status: "FAILED",
        errorMessage: "Instagram post requires a valid hero image, but none was found on the source page.",
      };
    }

    // 5. Context construction
    const chunksContent = pageChunks.map((c) => c.content).join("\n\n");
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

    console.log(
      `✅ [Retriever Agent] Retrieved ${pageChunks.length} chunks for ${targetUrl} ` +
      `(Avg Sim: ${(highestAvgScore * 100).toFixed(1)}%)`
    );

    return {
      retrievedChunks: pageChunks,
      selectedHeroImage: primaryHeroImage,
      contextSummary,
      status: "WRITING",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Retriever execution failed";
    console.error(`❌ [Retriever Agent Error]: ${msg}`);
    return {
      status: "FAILED",
      errorMessage: `Retriever error: ${msg}`,
    };
  }
};
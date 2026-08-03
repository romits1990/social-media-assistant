import { OllamaEmbeddings } from "@langchain/ollama";
import { checkTopicDeduplication } from "@/repositories/post.repository";
import { EMBEDDING_MODEL_NAME } from "@/constants/vector.constants";
import { AgentState } from "@/agents/agent.state";

const embeddingsPipeline = new OllamaEmbeddings({
    model: EMBEDDING_MODEL_NAME,
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
});

/**
 * Node 0 (Deduplicator): Checks if target topic was recently posted.
 * Rejects workflow execution early if similarity > 0.85.
 */
export const deduplicatorNode = async (state: AgentState): Promise<Partial<AgentState>> => {
    try {
        console.log(`🔍 [Deduplicator Agent] Checking semantic similarity for topic: "${state.targetTopic}"...`);

        // 1. Embed target topic
        const topicVector = await embeddingsPipeline.embedQuery(state.targetTopic);

        // 2. Perform Cosine Similarity query against social_posts table
        const { isDuplicate, highestSimilarity, matchedTopic } = await checkTopicDeduplication(
            topicVector,
            0.85 // Similarity threshold (85% similarity = distance <= 0.15)
        );

        if (isDuplicate) {
            console.warn(
                `⛔ [Deduplicator Agent] Topic REJECTED! Matches previously posted topic: "${matchedTopic}" ` +
                `(${(highestSimilarity * 100).toFixed(1)}% similarity)`
            );

            return {
                topicEmbedding: topicVector,
                isDuplicateTopic: true,
                status: "REJECTED_DUPLICATE",
                errorMessage: `Duplicate topic detected. Matches previously created post: "${matchedTopic}".`,
            };
        }

        console.log(`✅ [Deduplicator Agent] Topic approved for generation (Unique content).`);

        return {
            topicEmbedding: topicVector,
            isDuplicateTopic: false,
            status: "RETRIEVING",
        };
    } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error in deduplicator node";
        console.error(`❌ [Deduplicator Agent Error]: ${msg}`);
        return {
            status: "FAILED",
            errorMessage: msg,
        };
    }
};
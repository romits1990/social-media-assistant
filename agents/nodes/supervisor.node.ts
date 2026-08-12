import { AgentState } from "@/agents/agent.state";
import { saveSocialPost } from "@/repositories/post.repository";

/**
 * Node 4: Determines approval routing and persists draft post to Neon PostgreSQL.
 */
export const supervisorNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  if (state.status === "FAILED" || !state.draftPost) {
    console.warn(`⚠️ [Supervisor Node] Skipping persistence: Pipeline failed or draft post is missing.`);
    return {};
  }

  try {
    const targetStatus = state.autoPublishEnabled ? "PUBLISHED" : "AWAITING_APPROVAL";

    if (state.autoPublishEnabled) {
      console.log(`🚀 [Supervisor Node] Auto-Publish is ENABLED. Routing to Social Publisher...`);
    } else {
      console.log(`⏸️ [Supervisor Node] Auto-Publish is DISABLED. Queueing for Admin Review...`);
    }

    // Defensive check: Fallback empty vector if topicEmbedding was not provided
    const topicEmbedding = state.topicEmbedding || [];

    // Persist to social_posts table
    const persistedPostId = await saveSocialPost({
      topic: state.targetTopic,
      sourceUrl: state.retrievedChunks[0].url,
      topicEmbedding,
      platform: state.platform,
      title: state.draftPost.title,
      content: state.draftPost.content,
      hashtags: state.draftPost.hashtags,
      heroImage: state.draftPost.suggestedHeroImage,
      status: targetStatus,
    });

    console.log(`💾 [Supervisor Node] Post draft successfully persisted to DB with ID: ${persistedPostId}`);

    return {
      status: targetStatus,
      persistedPostId
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to persist post to database";
    console.error(`❌ [Supervisor Node Error]: ${msg}`);
    return {
      status: "FAILED",
      errorMessage: msg,
    };
  }
};
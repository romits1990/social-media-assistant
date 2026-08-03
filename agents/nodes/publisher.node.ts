import { AgentState } from "@/agents/agent.state";
import { getPublisherForPlatform } from "@/services/publishers/publisher.factory";

/**
 * Node 4: Invokes external social platform APIs for auto-publishing.
 */
export const publisherNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  if (!state.draftPost || state.status === "FAILED") return {};

  try {
    console.log(`📢 [Publisher Agent] Auto-publishing post to platform: ${state.platform.toUpperCase()}...`);

    const publisher = getPublisherForPlatform(state.platform);
    if(!publisher) {
      throw new Error(`Failed to publish to ${state.platform}: Publisher not found`);
    }
    
    const result = await publisher.publish({
      title: state.draftPost.title,
      content: state.draftPost.content,
      hashtags: state.draftPost.hashtags,
      heroImage: state.draftPost.suggestedHeroImage,
    });

    if (!result.success) {
      throw new Error(`Failed to publish to ${state.platform}: ${result.error}`);
    }

    console.log(`🎉 [Publisher Agent] Post live! External Post ID: ${result.externalPostId}`);

    return {
      status: "PUBLISHED",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Publishing error";
    console.error(`❌ [Publisher Agent Error]: ${msg}`);
    return {
      status: "FAILED",
      errorMessage: msg,
    };
  }
};
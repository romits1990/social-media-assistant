"use server";

import { socialAssistantGraph } from "@/agents/social.workflow";
import { SocialPlatform } from "@/agents/agent.state";
import { getSocialPostById, updatePostStatusAndContent } from "@/repositories/post.repository";
import { getPublisherForPlatform } from "@/services/publishers/publisher.factory";
import { revalidatePath } from "next/cache";

export type GenerateCustomPostPayload = {
  targetTopic: string;
  platform: SocialPlatform;
  autoPublishEnabled: boolean;
};

/**
 * Server Action: Generates a new post draft or auto-publishes on-demand using custom topic
 */
export async function generateCustomPostAction(payload: GenerateCustomPostPayload) {
  try {
    const result = await socialAssistantGraph.invoke({
      targetTopic: payload.targetTopic,
      platform: payload.platform,
      autoPublishEnabled: payload.autoPublishEnabled,
      retryCount: 0,
      maxRetries: 1, // Skip auto-retrying on custom user queries
    });

    if (result.status === "FAILED" || result.status === "REJECTED_DUPLICATE" || result.status === "EMPTY_CHUNKS") {
      return {
        success: false,
        error: result.errorMessage || `Workflow stopped with status: ${result.status}`,
      };
    }

    revalidatePath("/dashboard/posts");

    return {
      success: true,
      postId: result.persistedPostId,
      status: result.status,
      draftPost: result.draftPost,
      heroImage: result.selectedHeroImage,
      platform: payload.platform,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Generation failed";
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Publishes an existing AWAITING_APPROVAL or FAILED post
 */
export async function publishOrRetryPostAction(postId: string, updatedContent?: string, updatedHashtags?: string[]) {
  try {
    const post = await getSocialPostById(postId);

    if (!post) {
      return { success: false, error: "Post record not found in database." };
    }

    const contentToPublish = updatedContent ?? post.content;
    const hashtagsToPublish = updatedHashtags ?? post.hashtags ?? [];

    // 1. Invoke platform-specific publisher directly (no LLM generation needed!)
    const publisher = getPublisherForPlatform(post.platform);
    const publishResult = await publisher.publish({
      title: post.title,
      content: contentToPublish,
      hashtags: hashtagsToPublish,
      heroImage: post.heroImage,
    });

    if (!publishResult.success) {
      // Mark post as FAILED if external API call errored out
      await updatePostStatusAndContent(postId, "FAILED");
      revalidatePath("/dashboard/posts");
      return { success: false, error: publishResult.error || "Social API publishing failed." };
    }

    // 2. Mark post as PUBLISHED upon success
    await updatePostStatusAndContent(postId, "PUBLISHED", contentToPublish, hashtagsToPublish);
    revalidatePath("/dashboard/posts");

    return { success: true, externalPostId: publishResult.externalPostId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Publish action failed";
    return { success: false, error: msg };
  }
}
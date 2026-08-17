"use server";

import { socialAssistantGraph } from "@/agents/social.workflow";
import { SocialPlatform } from "@/agents/agent.state";
import { getSocialPostById, updatePostStatusAndContent } from "@/repositories/post.repository";
import { fetchDistinctDomains } from "@/repositories/vector.repository";
import { getPublisherForPlatform } from "@/services/publishers/publisher.factory";
import { revalidatePath } from "next/cache";

export type GenerateCustomPostPayload = {
  targetTopic: string;
  platform: SocialPlatform;
  targetDomain?: string;
  autoPublishEnabled: boolean;
};

/**
 * Server Action: Fetches distinct ingested website domains for dropdown filtering
 */
export async function getAvailableDomainsAction() {
  try {
    const domains = await fetchDistinctDomains();
    return { success: true, domains };
  } catch (error) {
    return { success: false, domains: [] };
  }
}

/**
 * Server Action: Generates a new post draft or auto-publishes on-demand using custom topic
 */
export async function generateCustomPostAction(payload: GenerateCustomPostPayload) {
  try {
    const result = await socialAssistantGraph.invoke({
      targetTopic: payload.targetTopic,
      platform: payload.platform,
      targetDomain: payload.targetDomain && payload.targetDomain !== "ALL" ? payload.targetDomain : undefined,
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
    const msg = error instanceof Error ? error.message : "Custom post generation failed";
    console.error(`❌ [Generate Custom Post Action Error]: ${msg}`);
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Server Action: Publishes or retries an existing post directly via social API
 */
export async function publishOrRetryPostAction(
  postId: string,
  editedContent?: string,
  editedHashtags?: string[]
) {
  try {
    const post = await getSocialPostById(postId);

    if (!post) {
      return { success: false, error: "Post record not found in database." };
    }

    const contentToPublish = editedContent ?? post.content;
    const hashtagsToPublish = editedHashtags ?? post.hashtags ?? [];

    const publisher = getPublisherForPlatform(post.platform);
    const publishResult = await publisher.publish({
      title: post.title,
      content: contentToPublish,
      hashtags: hashtagsToPublish,
      heroImage: post.heroImage,
    });

    if (!publishResult.success) {
      await updatePostStatusAndContent(postId, "FAILED");
      revalidatePath("/dashboard/posts");
      return { success: false, error: publishResult.error || "Social API publishing failed." };
    }

    await updatePostStatusAndContent(postId, "PUBLISHED", contentToPublish, hashtagsToPublish);
    revalidatePath("/dashboard/posts");

    return { success: true, externalPostId: publishResult.externalPostId };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Publish action failed";
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Fetches a single post draft by ID for inspection/preview
 */
export async function getPostPreviewAction(postId: string) {
  try {
    const post = await getSocialPostById(postId);
    if (!post) {
      return { success: false, error: "Post record not found." };
    }
    return { success: true, post };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to fetch post preview.";
    return { success: false, error: msg };
  }
}
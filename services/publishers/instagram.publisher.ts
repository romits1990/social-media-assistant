import { ISocialPublisher, PublishPayload, PublishResult } from "@/services/publishers/publisher.types";

export class InstagramPublisher implements ISocialPublisher {
  platform = "instagram" as const;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID;

    // Dry Run Fallback for Dev Environment
    if (!accessToken || !instagramAccountId) {
      console.log(`📡 [Instagram Publisher (DRY-RUN)] Credentials missing. Mock publishing:`);
      console.log(`    Caption length: ${payload.content.length} chars`);
      console.log(`    Image attached: ${payload.heroImage || "None"}`);
      return {
        success: true,
        externalPostId: `mock-instagram-${Date.now()}`,
      };
    }

    try {
      // Instagram Business API requires an image URL
      if (!payload.heroImage) {
        throw new Error("Instagram Graph API requires a valid, publicly accessible image URL.");
      }

      const caption = `${payload.content}\n\n${payload.hashtags.join(" ")}`;

      // ─────────────────────────────────────────────────────────────
      // STEP 1: Create Item Container
      // ─────────────────────────────────────────────────────────────
      const createContainerUrl = `https://graph.facebook.com/v19.0/${instagramAccountId}/media`;
      const containerResponse = await fetch(createContainerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: payload.heroImage,
          caption: caption,
          access_token: accessToken,
        }),
      });

      if (!containerResponse.ok) {
        const errorData = await containerResponse.json();
        throw new Error(`Instagram Container Creation Error: ${JSON.stringify(errorData)}`);
      }

      const containerData = await containerResponse.json();
      const creationId = containerData.id;

      // ─────────────────────────────────────────────────────────────
      // STEP 2: Publish Item Container
      // ─────────────────────────────────────────────────────────────
      const publishUrl = `https://graph.facebook.com/v19.0/${instagramAccountId}/media_publish`;
      const publishResponse = await fetch(publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: creationId,
          access_token: accessToken,
        }),
      });

      if (!publishResponse.ok) {
        const errorData = await publishResponse.json();
        throw new Error(`Instagram Container Publish Error: ${JSON.stringify(errorData)}`);
      }

      const publishData = await publishResponse.json();

      return {
        success: true,
        externalPostId: publishData.id,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Instagram publish failed";
      return { success: false, error: msg };
    }
  }
}
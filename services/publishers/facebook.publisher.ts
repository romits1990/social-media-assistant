import { ISocialPublisher, PublishPayload, PublishResult } from "@/services/publishers/publisher.types";

export class FacebookPublisher implements ISocialPublisher {
  platform = "facebook" as const;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    // Dry Run Fallback for Dev Environment
    if (!pageAccessToken || !pageId) {
      console.log(`📡 [Facebook Publisher (DRY-RUN)] Credentials missing. Mock publishing:`);
      console.log(`    Headline: ${payload.title}`);
      console.log(`    Content length: ${payload.content.length} chars`);
      console.log(`    Image attached: ${payload.heroImage || "None"}`);
      return {
        success: true,
        externalPostId: `mock-facebook-${Date.now()}`,
      };
    }

    try {
      const fullMessage = `${payload.title}\n\n${payload.content}\n\n${payload.hashtags.join(" ")}`;

      // Construct Meta Graph API URL for Page feed
      const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;

      const requestBody: Record<string, any> = {
        message: fullMessage,
        access_token: pageAccessToken,
      };

      // Attach image link if available
      if (payload.heroImage) {
        requestBody.link = payload.heroImage;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Facebook API Error: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      return {
        success: true,
        externalPostId: data.id, // Form: {page_id}_{post_id}
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Facebook publish failed";
      return { success: false, error: msg };
    }
  }
}
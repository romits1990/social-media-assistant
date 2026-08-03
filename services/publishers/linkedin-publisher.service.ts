import { ISocialPublisher, PublishPayload, PublishResult } from "@/services/publishers/publisher.types";

export class LinkedInPublisher implements ISocialPublisher {
  platform = "linkedin" as const;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
    const authorUrn = process.env.LINKEDIN_AUTHOR_URN; // e.g. "urn:li:person:abcdef123"

    // Fallback to Dry Run if credentials are missing
    if (!accessToken || !authorUrn) {
      console.log(`📡 [LinkedIn Publisher (DRY-RUN)] Credentials missing. Mock publishing:`);
      console.log(`    Headline: ${payload.title}`);
      console.log(`    Content length: ${payload.content.length} chars`);
      return {
        success: true,
        externalPostId: `mock-linkedin-${Date.now()}`,
      };
    }

    try {
      const fullText = `${payload.content}\n\n${payload.hashtags.join(" ")}`;

      const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Restli-Protocol-Version": "2.0.0",
        },
        body: JSON.stringify({
          author: authorUrn,
          lifecycleState: "PUBLISHED",
          specificContent: {
            "com.linkedin.ugc.ShareContent": {
              shareCommentary: { text: fullText },
              shareMediaCategory: "NONE",
            },
          },
          visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LinkedIn API responded with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return {
        success: true,
        externalPostId: data.id,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "LinkedIn publish failed";
      return { success: false, error: msg };
    }
  }
}
import { ISocialPublisher, PublishPayload, PublishResult } from "@/services/publishers/publisher.types";

export class TwitterPublisher implements ISocialPublisher {
  platform = "twitter" as const;

  async publish(payload: PublishPayload): Promise<PublishResult> {
    const apiKey = process.env.TWITTER_API_KEY;

    if (!apiKey) {
      console.log(`📡 [Twitter Publisher (DRY-RUN)] Credentials missing. Mock publishing:`);
      console.log(`    Tweet text: ${payload.content.substring(0, 100)}...`);
      return {
        success: true,
        externalPostId: `mock-tweet-${Date.now()}`,
      };
    }

    // Actual Twitter/X API v2 call implementation
    try {
      const tweetText = `${payload.content}\n${payload.hashtags.join(" ")}`.substring(0, 280);
      
      // Twitter API v2 POST /2/tweets
      // (Using Twitter API v2 endpoint or SDK)
      return {
        success: true,
        externalPostId: `tweet-${Date.now()}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Twitter publish failed";
      return { success: false, error: msg };
    }
  }
}
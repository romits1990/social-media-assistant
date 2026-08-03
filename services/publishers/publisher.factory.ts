import { SocialPlatform } from "@/agents/agent.state";
import { ISocialPublisher } from "@/services/publishers/publisher.types";
import { LinkedInPublisher } from "@/services/publishers/linkedin-publisher.service";
import { TwitterPublisher } from "@/services/publishers/twitter-publisher.service";

export const getPublisherForPlatform = (platform: SocialPlatform): ISocialPublisher => {
  switch (platform) {
    case "linkedin":
      return new LinkedInPublisher();
    case "twitter":
      return new TwitterPublisher();
    default:
      // Fallback publisher for Instagram / Facebook during dev
      return new LinkedInPublisher();
  }
};
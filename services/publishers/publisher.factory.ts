import { SocialPlatform } from "@/agents/agent.state";
import { ISocialPublisher } from "@/services/publishers/publisher.types";
import { LinkedInPublisher } from "@/services/publishers/linkedin-publisher.service";
import { TwitterPublisher } from "@/services/publishers/twitter-publisher.service";
import { FacebookPublisher } from "@/services/publishers/facebook.publisher";
import { InstagramPublisher } from "@/services/publishers/instagram.publisher";

export const getPublisherForPlatform = (platform: SocialPlatform): ISocialPublisher => {
  switch (platform) {
    case "linkedin":
      return new LinkedInPublisher();
    case "twitter":
      return new TwitterPublisher();
    case "facebook": 
      return new FacebookPublisher();
    case "instagram":
      return new InstagramPublisher();
    default:
      throw new Error(`Unsupported social publishing platform: ${platform}`);
  }
};
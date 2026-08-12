import { SocialPlatform } from "@/agents/agent.state";

export type PublishPayload = {
  title: string;
  content: string;
  hashtags: string[];
  heroImage: string | null | undefined;
};

export type PublishResult = {
  success: boolean;
  externalPostId?: string;
  error?: string;
};

export interface ISocialPublisher {
  platform: SocialPlatform;
  publish(payload: PublishPayload): Promise<PublishResult>;
}
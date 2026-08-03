// src/repositories/post.repository.ts
import { db } from "@/lib/db";
import { SocialPlatform } from "@/agents/agent.state";

export type SocialPostEntity = {
  id?: string;
  topic: string;
  topicEmbedding: number[];
  platform: SocialPlatform;
  title: string;
  content: string;
  hashtags: string[];
  heroImage: string | null;
  status: "AWAITING_APPROVAL" | "PUBLISHED" | "REJECTED_DUPLICATE";
};

export type DeduplicationResult = {
  isDuplicate: boolean;
  highestSimilarity: number;
  matchedTopic?: string;
};

/**
 * Checks whether an incoming topic vector is semantically identical 
 * to any previously persisted post in social_posts.
 */
export const checkTopicDeduplication = async (
  topicVector: number[],
  similarityThreshold = 0.85
): Promise<DeduplicationResult> => {
  const maxDistance = 1 - similarityThreshold;

  const query = `
    SELECT 
      topic,
      (1 - (topic_embedding <=> $1::vector)) AS similarity
    FROM social_posts
    WHERE (topic_embedding <=> $1::vector) <= $2
    ORDER BY topic_embedding <=> $1::vector ASC
    LIMIT 1;
  `;

  const { rows } = await db.query(query, [
    JSON.stringify(topicVector),
    maxDistance,
  ]);

  if (rows.length === 0) {
    return { isDuplicate: false, highestSimilarity: 0 };
  }

  return {
    isDuplicate: true,
    highestSimilarity: parseFloat(rows[0].similarity),
    matchedTopic: rows[0].topic,
  };
};

/**
 * Persists a generated draft post 
 */
export const saveSocialPost = async (
  post: SocialPostEntity
): Promise<string> => {
  const query = `
    INSERT INTO social_posts (
      topic, 
      topic_embedding, 
      platform, 
      title, 
      content, 
      hashtags, 
      hero_image, 
      status
    )
    VALUES ($1, $2::vector, $3, $4, $5, $6, $7, $8)
    RETURNING id;
  `;

  const values = [
    post.topic,
    JSON.stringify(post.topicEmbedding),
    post.platform,
    post.title,
    post.content,
    post.hashtags,
    post.heroImage,
    post.status,
  ];

  const { rows } = await db.query(query, values);
  return rows[0].id;
};
import { db } from "@/lib/db";
import { SocialPlatform } from "@/agents/agent.state";

export type SocialPostStatus = 
  | "AWAITING_APPROVAL" 
  | "PUBLISHED" 
  | "FAILED" 
  | "REJECTED_DUPLICATE";

export type SocialPostEntity = {
  id?: string;
  topic: string;
  sourceUrl?: string | null;
  topicEmbedding?: number[];
  platform: SocialPlatform;
  title: string;
  content: string;
  hashtags: string[];
  heroImage?: string | null;
  status: SocialPostStatus;
  createdAt?: Date | string;
  updatedAt?: Date | string;
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
 * Persists a generated draft post to Neon PostgreSQL.
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
      status,
      source_url
    )
    VALUES ($1, $2::vector, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id;
  `;

  const values = [
    post.topic,
    JSON.stringify(post.topicEmbedding || []),
    post.platform,
    post.title,
    post.content,
    post.hashtags || [],
    post.heroImage ?? null,
    post.status,
    post.sourceUrl ?? null,
  ];

  const { rows } = await db.query(query, values);
  return rows[0].id;
};

/**
 * Fetches all posts filtered by optional status for Next.js Admin Dashboard
 */
export const getSocialPosts = async (
  statusFilter?: SocialPostStatus | "ALL"
): Promise<SocialPostEntity[]> => {
  let query = `
    SELECT 
      id, 
      topic, 
      platform, 
      title, 
      content, 
      hashtags, 
      hero_image AS "heroImage", 
      source_url AS "sourceUrl", 
      status, 
      created_at AS "createdAt", 
      updated_at AS "updatedAt"
    FROM social_posts
  `;
  const params: any[] = [];

  if (statusFilter && statusFilter !== "ALL") {
    query += ` WHERE status = $1`;
    params.push(statusFilter);
  }

  query += ` ORDER BY created_at DESC LIMIT 50;`;

  const { rows } = await db.query(query, params);
  return rows;
};

/**
 * Fetches a single social post by UUID
 */
export const getSocialPostById = async (
  postId: string
): Promise<SocialPostEntity | null> => {
  const query = `
    SELECT 
      id, 
      topic, 
      platform, 
      title, 
      content, 
      hashtags, 
      hero_image AS "heroImage", 
      source_url AS "sourceUrl", 
      status, 
      created_at AS "createdAt", 
      updated_at AS "updatedAt"
    FROM social_posts 
    WHERE id = $1;
  `;

  const { rows } = await db.query(query, [postId]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Updates post status and optionally content/hashtags if edited prior to publishing
 */
export const updatePostStatusAndContent = async (
  postId: string,
  status: string,
  content?: string,
  hashtags?: string[]
): Promise<void> => {
  let query = `
    UPDATE social_posts 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
  `;
  const params: any[] = [status, postId];

  if (content !== undefined && hashtags !== undefined) {
    query = `
      UPDATE social_posts 
      SET status = $1, content = $3, hashtags = $4, updated_at = CURRENT_TIMESTAMP
    `;
    params.push(content, hashtags);
  }

  query += ` WHERE id = $2;`;

  await db.query(query, params);
};
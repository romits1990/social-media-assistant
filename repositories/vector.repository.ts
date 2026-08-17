import { db } from "@/lib/db";

export type VectorChunkEntity = {
  url: string;
  title: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  metadata: {
    description: string;
    h1: string[];
    heroImage: string | null;
    allImages: string[];
  };
};

export type VectorSearchResult = {
  id: string;
  url: string;
  title: string;
  content: string;
  chunkIndex: number;
  metadata: {
    description?: string;
    h1?: string[];
    heroImage?: string | null;
    allImages?: string[];
  };
  similarity: number;
};

/**
 * Idempotently saves a batch of vector chunks for a specific URL.
 * Clears existing chunks for the target URL before performing a bulk insert.
 */
export const upsertWebsiteChunks = async (chunks: VectorChunkEntity[]): Promise<void> => {
  if (chunks.length === 0) return;

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // 1. Delete existing stale vector chunks for this URL
    await client.query("DELETE FROM website_chunks WHERE url = $1", [chunks[0].url]);

    // 2. Build multi-row parameter placeholders dynamically
    const values: any[] = [];
    const placeholders: string[] = [];

    chunks.forEach((chunk, index) => {
      const offset = index * 6;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`
      );
      values.push(
        chunk.url,
        chunk.title,
        chunk.chunkIndex,
        chunk.content,
        chunk.metadata ? JSON.stringify(chunk.metadata) : null,
        JSON.stringify(chunk.embedding)
      );
    });

    const insertQuery = `
      INSERT INTO website_chunks (url, title, chunk_index, content, metadata, embedding)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (url, chunk_index) 
      DO UPDATE SET 
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        metadata = EXCLUDED.metadata,
        embedding = EXCLUDED.embedding,
        created_at = CURRENT_TIMESTAMP;
    `;

    await client.query(insertQuery, values);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Fetch distinct hostnames/domains present in the vector store
 */
export const fetchDistinctDomains = async (): Promise<string[]> => {
  const query = `
    SELECT DISTINCT 
      SUBSTRING(url FROM 'https?://([^/]+)') AS domain
    FROM website_chunks
    WHERE url IS NOT NULL
    ORDER BY domain ASC;
  `;
  const { rows } = await db.query(query);
  return rows.map((r) => r.domain).filter(Boolean);
};

/**
 * Similarity search supporting optional domain filtering
 */
export const findSimilarChunks = async (
  queryVector: number[],
  maxDistance: number = 0.5,
  limit: number = 10,
  domainFilter?: string
): Promise<VectorSearchResult[]> => {
  const params: any[] = [JSON.stringify(queryVector), maxDistance];
  let domainClause = "";

  if (domainFilter && domainFilter !== "ALL") {
    params.push(`%://${domainFilter}%`);
    domainClause = `AND url ILIKE $${params.length}`;
  }

  params.push(limit);
  const limitIndex = params.length;

  const query = `
    SELECT 
      id,
      url,
      title,
      content,
      chunk_index,
      metadata,
      1 - (embedding <=> $1::vector) AS similarity
    FROM website_chunks
    WHERE 1 - (embedding <=> $1::vector) > $2
    ${domainClause}
    ORDER BY similarity DESC
    LIMIT $${limitIndex};
  `;

  const { rows } = await db.query(query, params);
  return rows;
};
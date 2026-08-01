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
        await client.query('BEGIN');

        // 1. Delete existing stale vector chunks for this URL
        await client.query('DELETE FROM website_chunks WHERE url = $1', [chunks[0].url]);

        // 2. Build multi-row parameter placeholders dynamically
        // Each row needs 6 parameters: ($1, $2, $3, $4, $5::vector, $6)
        const VALUES_PER_ROW = 6;
        const valuePlaceholders: string[] = [];
        const flatQueryParams: any[] = [];

        chunks.forEach((chunk, index) => {
            const offset = index * VALUES_PER_ROW;

            // Creates: ($1, $2, $3, $4, $5::vector, $6), ($7, $8, $9, $10, $11::vector, $12)...
            valuePlaceholders.push(
                `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::vector, $${offset + 6})`
            );

            flatQueryParams.push(
                chunk.url,
                chunk.title,
                chunk.chunkIndex,
                chunk.content,
                JSON.stringify(chunk.embedding),
                JSON.stringify(chunk.metadata)
            );
        });

        // 3. Single Bulk Query Execution
        const bulkInsertQuery = `
        INSERT INTO website_chunks (url, title, chunk_index, content, embedding, metadata)
        VALUES ${valuePlaceholders.join(', ')}
        `;

        await client.query(bulkInsertQuery, flatQueryParams);

        await client.query('COMMIT');
        console.log(`     [Repository] Persisted ${chunks.length} vector rows for: ${chunks[0].url}`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`     [Repository Error] Transaction rolled back for ${chunks[0].url}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Executes a vector similarity search against PostgreSQL using pgvector HNSW index.
 * * @param queryVector 768-dimension float array from Ollama
 * @param limit Maximum chunks to retrieve (Default: 5)
 * @param similarityThreshold Minimum similarity score between 0.0 and 1.0 (Default: 0.65)
 */
export const findSimilarChunks = async (
    queryVector: number[],
    limit = 5,
    similarityThreshold = 0.65
): Promise<VectorSearchResult[]> => {
    // Convert similarity threshold to max distance threshold: Distance = 1 - Similarity
    const maxDistance = 1 - similarityThreshold;

    const query = `
    SELECT 
      id, 
      url, 
      title, 
      content, 
      metadata,
      chunk_index AS "chunkIndex"
      (1 - (embedding <=> $1::vector)) AS similarity
    FROM website_chunks
    WHERE (embedding <=> $1::vector) <= $2
    ORDER BY embedding <=> $1::vector ASC
    LIMIT $3;
  `;

    const { rows } = await db.query<VectorSearchResult>(query, [
        JSON.stringify(queryVector),
        maxDistance,
        limit,
    ]);

    return rows;
};
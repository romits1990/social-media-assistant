-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For gen_random_uuid()

-- 2. Drop existing table to ensure a clean slate
DROP TABLE IF EXISTS website_chunks CASCADE;

-- 3. Create website_chunks Table with Composite UNIQUE Constraint
CREATE TABLE website_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url VARCHAR(2048) NOT NULL,
    title TEXT,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 🎯 CRITICAL: Enables ON CONFLICT (url, chunk_index) for idempotent upserts
    CONSTRAINT uq_website_chunks_url_chunk_index UNIQUE (url, chunk_index)
);

-- 4. HNSW Cosine Distance Index for fast approximate nearest neighbor vector search
CREATE INDEX website_chunks_embedding_hnsw_idx 
ON website_chunks USING hnsw (embedding vector_cosine_ops);

-- 5. GIN Index on metadata for general JSONB querying
CREATE INDEX website_chunks_metadata_gin_idx 
ON website_chunks USING GIN (metadata);

-- 6. B-Tree Expression Index for fast O(1) domain filtering
CREATE INDEX idx_website_chunks_domain_btree 
ON website_chunks ((metadata->>'domain'));
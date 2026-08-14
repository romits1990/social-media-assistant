CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS website_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url VARCHAR(2048) NOT NULL,
    title TEXT,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS website_chunks_embedding_hnsw_idx 
ON website_chunks USING hnsw (embedding vector_cosine_ops);
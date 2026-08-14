CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    source_url TEXT NOT NULL,
    topic_embedding vector(768) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    hashtags TEXT[] DEFAULT '{}',
    hero_image TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'AWAITING_APPROVAL', -- 'AWAITING_APPROVAL', 'PUBLISHED', 'REJECTED_DUPLICATE'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create HNSW Cosine Index for O(log N) similarity deduplication checks
CREATE INDEX IF NOT EXISTS social_posts_topic_embedding_hnsw_idx 
ON social_posts 
USING hnsw (topic_embedding vector_cosine_ops);
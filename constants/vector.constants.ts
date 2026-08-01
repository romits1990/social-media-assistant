export const EMBEDDING_MODEL_NAME = process.env.EMBEDDING_MODEL || "nomic-embed-text:v1.5";
export const EXPECTED_VECTOR_DIMENSION = 768; // Change this single value if switching models
export const CHUNK_SIZE = 1000;
export const CHUNK_OVERLAP = 200;
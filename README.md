# 🤖 Autonomous AI Social Media Assistant

An end-to-end, locally-hosted Agentic RAG system that crawls sitemaps, embeds webpage content into PostgreSQL via `pgvector`, and uses multi-agent LangChain workflows to generate and publish social media content dynamically.

### 🌟 Key Technical Features
- **Sitemap & Web Crawler:** Recursive sitemap parsing (`cheerio` + `axios`) with media/hero-image scoring.
- **Local Vector Processing:** Text chunking via LangChain and embedding via local Ollama (`nomic-embed-text`).
- **Postgres + pgvector:** Custom Data Access Layer (DAL) featuring raw atomic transactions, bulk `VALUES` inserts, and HNSW vector similarity search.
- **Deduplication Engine:** Cosine similarity checks against previously generated topics to prevent repeated posts.
- **Multi-Agent Workflow:** LangGraph orchestration for context retrieval, platform-tailored post drafting, and publication routing (Auto-Publish vs. Admin Review).
- **Tech Stack:** Next.js (App Router), TypeScript (`tsx`), PostgreSQL (`pgvector`), Ollama, LangChain/LangGraph.
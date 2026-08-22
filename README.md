# 🤖 Autonomous AI Social Media Marketing Assistant

An autonomous, **100% locally hosted, zero-cloud-cost** AI social media assistant built with **Next.js (App Router)**, **LangGraph**, **Ollama**, and **PostgreSQL (`pgvector`)**.

> **Educational Project Note:** This project was developed as a hands-on technical Proof of Concept (POC) and educational learning initiative. It explores Agentic RAG workflows, vector databases, and system orchestration using standard open-source tools and free AI assistants without commercial code-generation subscriptions.
> 
> 

---

## 🌟 The Problem & Real-World Use Case

### The Problem

Running social media channels is essential for small businesses to drive organic traffic, but keeping accounts active is difficult.
Small businesses (such as local travel agencies, clinics, consultancies, and boutique shops) often have rich content sitting on their websites (tour packages, service descriptions, and blog articles). However:

* **High Marketing Costs:** Hiring a full-time social media manager to manually write posts every week is expensive for small businesses.


* **Repetitive Work:** A business (such as a travel & tour agency, local clinic, or boutique consultancy) often has dozens of detailed service pages, tour packages, or blog articles already sitting on their website. Manually repurposing these pages into social posts across LinkedIn, X (Twitter), Instagram, and Facebook takes hours every week.


* **Idle Content:** Valuable pages remain undiscovered unless actively shared to social feeds.



### The Solution

This tool operates as an **in-house, autonomous marketing engine**:

1. **Reads Web Content:** Ingests content via an XML sitemap or direct page URLs, cleaning and structuring it directly on your machine.


2. **Local Vector Storage:** Generates 768-dimensional embeddings (`nomic-embed-text:v1.5`) stored in a local PostgreSQL database with an HNSW cosine distance index (`pgvector`).


3. **Discovers Unposted Topics:** Autonomous agents check database history to identify fresh, unposted content.


4. **Single-Page Context Isolation:** Focuses each post on a single webpage to preserve narrative flow and align the exact hero image.


5. **Drafts & Publishes on a Schedule:** Uses a local generative model (`llama3.2:3b` or `qwen2.5:3b`) to draft platform-tailored copy with hashtags and CTAs on a recurring cron schedule, ready for automated publishing or manual review.



---

## 🏛️ System & Multi-Agent Architecture

```
[ 1. Ingestion Layer (Local Disk + PostgreSQL) ]
Target URL / Sitemap ──► BFS Sitemap Parser ──► HTML Scraper (Cheerio)
                                                       │
                                                       ▼
PostgreSQL (pgvector)  ◄── Idempotent Bulk Upsert ◄── Local JSON Dump Files
 (HNSW Cosine Index)        (Ollama Embeddings)       (Structured Disk Cache)
        │
        │ Semantic Search (<=>)
        ▼
[ 2. LangGraph Multi-Agent Workflow ]
      ┌─────────────────────────────────────────────────────────────┐
      │  START                                                      │
      │    │                                                        │
      │    ▼                                                        │
      │ [Topic Generator] ──► Selects unposted candidate from DB    │
      │    │                                                        │
      │    ▼                                                        │
      │ [Retriever Node]  ──► HNSW pgvector similarity search (<=>) │
      │    │                  Isolates single-page context & media  │
      │    ▼                                                        │
      │ [Writer Node]     ──► Platform prompt formatting            │
      │    │                  Strict JSON schema generation         │
      │    ▼                                                        │
      │ [Publisher Node]  ──► Persists post & updates last-run logs │
      │    │                                                        │
      │    ▼                                                        │
      │   END                                                       │
      └─────────────────────────────────────────────────────────────┘
        ▲
        │ Automated Ticks (node-cron) / On-Demand UI Triggers
[ Next.js Server & Background Scheduler Daemon ]

```

---

## 🔬 Key Engineering Implementations

* **Local Disk Staging (`scrap_dump/`):** Scrapes webpage content to structured local JSON files before vectorization, enabling offline inspection, caching, and debugging.


* **Zero Cloud Costs:** Operates entirely on local hardware via [Ollama](https://ollama.com/) for both embeddings (`nomic-embed-text:v1.5`) and generative drafting (`llama3.2:3b` / `qwen2.5:3b`), requiring zero paid API keys or cloud infrastructure.


* **BFS Sitemap Parser:** Recursively traverses XML sitemap indexes using a FIFO queue with early exit conditions, preventing infinite loops on large enterprise sitemaps.


* **Transactional DAL with Idempotent Upserts:** Executes atomic SQL transactions (`BEGIN ... COMMIT`) for vector insertions to ensure duplicate crawls overwrite stale data cleanly.


* **Single-Page Isolation Strategy:** Resolves the multi-page RAG context problem by isolating retrieved chunks to the single highest-scoring URL, ensuring 1:1 image alignment and narrative consistency.


* **Domain-Partitioned Multi-Tenant Vector Space:** Segregates embeddings using domain metadata, supported by PostgreSQL B-Tree and GIN indexes for fast filtered searches.



---

## 🛠️ Step-by-Step Setup Guide

### 1. Environment Configuration (`.env.local`)

Create a `.env.local` file in the project root:

```env
# PostgreSQL connection string (Local or Neon DB)
DATABASE_URL="postgres://postgres:postgres@localhost:5432/social_assistant"

# Local Ollama settings
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text:v1.5
OLLAMA_WRITER_MODEL=qwen2.5:3b

# Facebook Page Credentials
FACEBOOK_PAGE_ACCESS_TOKEN="EAA..."
FACEBOOK_PAGE_ID="1234567890"

# Instagram Business Credentials
INSTAGRAM_ACCESS_TOKEN="EAA"
INSTAGRAM_ACCOUNT_ID="1234567890"

```

### 2. Pull Local AI Models (Ollama)

Ensure [Ollama](https://ollama.com/) is installed and running locally:

```bash
# Pull 768-dimensional text embedding model
ollama pull nomic-embed-text:v1.5

# Pull structured drafting model
ollama pull qwen2.5:3b

```

### 3. Run Database Migration

Execute the automated migration script using the single package script:

```bash
npm run command:migrate

```

*(Applies vector extensions, table definitions, and HNSW cosine distance indexes for `website_chunks`, `social_posts`, `ingestion_jobs`, and `recurring_schedules`)*.

### 4. Run the Application

```bash
# Install dependencies
npm install

# Start Next.js development server
npm run dev

```

---

## 🧰 CLI Command Suite

Test and run individual pipeline components directly from your terminal:

* **Run Database Migration:**
```bash
npm run command:migrate

```



* **Test Web Crawler / Sitemap Extraction:**
```bash
npm run command:crawl

```



* **Run Local Disk Vectorization & DB Ingestion:**
```bash
npm run command:ingest

```



* **Test LangGraph Agent Execution Pipeline:**
```bash
npm run command:agent-test

```



* **Test Social Media Publisher Logic:**
```bash
npm run command:publisher-test

```



---

## 🖥️ UI Navigation & Features

* **Post Management (`/dashboard/posts`):** Review, edit, approve, or retry drafted social posts.


* **Custom Post Generator (`/dashboard/create`):** Trigger on-demand generation for custom topics and target platforms.


* **Ingestion Tracker (`/dashboard/jobs`):** Monitor web scraping, chunking, and embedding progress.


* **Sitemap & Single Page Ingest (`/dashboard/sources`):** Ingest entire domains via XML sitemaps or single URLs.


* **Recurring Schedules (`/dashboard/schedules`):** Configure active cron schedules, domain filters, and auto-publishing settings.



---

## 📌 Project Status & Roadmap

* [x] BFS Sitemap discovery and HTML content scraper


* [x] Local disk JSON staging and transactional vector storage


* [x] LangGraph Multi-Agent RAG workflow with single-page context isolation


* [x] Next.js App Router dashboard with optimistic UI updates


* [x] Background cron scheduler lifecycle integration


* [ ] **Direct Social API Integrations:** Native OAuth2 publishing handlers for LinkedIn, X/Twitter, Meta Graph API (Instagram/Facebook)
* [ ] **Automated Multi-Image Carousels:** Parsing multiple article images for carousel posts
* [ ] **Analytics Feedback Loop:** Ingesting post engagement metrics to optimize future topic selection

---

## 📄 License

MIT License. Free for personal, educational, and open-source exploration.
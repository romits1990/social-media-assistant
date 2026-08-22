import { OLLAMA_WRITER_MODEL } from "@/constants/agent.constants";
import { EMBEDDING_MODEL_NAME } from "@/constants/vector.constants";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

/**
 * Sends a lightweight ping to Ollama to preload weights into VRAM/RAM
 */
async function preloadModel(modelName: string, endpoint: "generate" | "embeddings"): Promise<void> {
  const url = `${OLLAMA_BASE_URL}/api/${endpoint}`;
  const body =
    endpoint === "generate"
      ? { model: modelName, prompt: "", keep_alive: "5m" }
      : { model: modelName, prompt: "warmup", keep_alive: "5m" };

  const startTime = performance.now();
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Failed to load ${modelName}: HTTP ${res.status}`);
  }

  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`🧠 [Ollama Warmer] Preloaded ${modelName} in ${duration}s`);
}

/**
 * Warms up all required local AI models
 */
export async function warmOllamaModels(): Promise<void> {
  console.log("🔥 [Ollama Warmer] Initializing model pre-warming...");

  try {
    // 1. Warm up the 768D Embedding Model
    await preloadModel(EMBEDDING_MODEL_NAME, "embeddings");

    // 2. Warm up the Generative Drafting Model
    await preloadModel(OLLAMA_WRITER_MODEL, "generate");

    console.log("✨ [Ollama Warmer] All local AI models resident in memory.");
  } catch (error) {
    console.warn(
      "⚠️ [Ollama Warmer] Model warmup skipped or failed (Ensure Ollama is running):",
      error instanceof Error ? error.message : error
    );
  }
}
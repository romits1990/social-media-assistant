declare global {
  var _isShutdownHandlerRegistered: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { initializeAllSchedules, stopAllSchedules } = await import(
        "@/services/scheduler.service"
      );
      const { warmOllamaModels } = await import("@/lib/ollama-warmer");

      // 1. Asynchronously bootstrap database cron schedules
      initializeAllSchedules().catch((err) => {
        console.error("❌ [Instrumentation] Async scheduler init failed:", err);
      });

      // 2. Asynchronously pre-warm Ollama models into memory (RAM/VRAM)
      warmOllamaModels().catch((err) => {
        console.warn("⚠️ [Instrumentation] Ollama warmup error:", err);
      });

      // 3. Register Process Signal Listeners strictly once
      if (!global._isShutdownHandlerRegistered) {
        global._isShutdownHandlerRegistered = true;

        const handleShutdown = (signal: string) => {
          console.log(`\n🛑 [Server Shutdown] Caught ${signal}. Cleaning up in-memory tasks...`);
          try {
            stopAllSchedules();
          } catch (err) {
            console.error("❌ [Shutdown Error]:", err);
          } finally {
            process.exit(0);
          }
        };

        process.once("SIGTERM", () => handleShutdown("SIGTERM"));
        process.once("SIGINT", () => handleShutdown("SIGINT"));
      }
    } catch (error) {
      console.error("❌ [Instrumentation] Failed to bootstrap application hooks:", error);
    }
  }
}
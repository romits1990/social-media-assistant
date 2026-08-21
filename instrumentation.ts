declare global {
  var _isShutdownHandlerRegistered: boolean | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { initializeAllSchedules, stopAllSchedules } = await import(
        "@/services/scheduler.service"
      );

      // 1. Initialize in background without blocking Next.js server startup
      initializeAllSchedules().catch((err) => {
        console.error("❌ [Instrumentation] Async scheduler init failed:", err);
      });

      // 2. Register Signal Handlers strictly once
      if (!global._isShutdownHandlerRegistered) {
        global._isShutdownHandlerRegistered = true;

        const handleShutdown = (signal: string) => {
          console.log(`\n🛑 [Server Shutdown] Caught ${signal}. Cleaning up in-memory tasks...`);
          try {
            stopAllSchedules();
          } catch (err) {
            console.error("❌ [Shutdown Error]:", err);
          } finally {
            // 🎯 Required: Terminates the process once cleanup is complete
            process.exit(0);
          }
        };

        process.once("SIGTERM", () => handleShutdown("SIGTERM"));
        process.once("SIGINT", () => handleShutdown("SIGINT"));
      }
    } catch (error) {
      console.error("❌ [Instrumentation] Failed to bootstrap schedule manager:", error);
    }
  }
}
import { socialAssistantGraph } from "@/agents/social.workflow";
import { closeDbConnection } from "@/lib/db";

const run = async () => {
  try {
    console.log("=================================================");
    console.log("🧪 RUNNING MULTI-AGENT PUBLISHER & ROUTING TESTS");
    console.log("=================================================\n");

    // -----------------------------------------------------------------
    // TEST 1: Auto-Publish Mode (autoPublishEnabled = true)
    // -----------------------------------------------------------------
    const topic2 = `Museum ${Date.now()}`;
    console.log(`\n▶️ TEST 2: Executing Path B (Auto-Publish ENABLED) for topic: "${topic2}"...`);

    const result2 = await socialAssistantGraph.invoke({
      targetTopic: topic2,
      platform: "instagram",
      autoPublishEnabled: true,
    });

    console.log(`   Final Status: ${result2.status}`);

    if (result2.status === "PUBLISHED") {
      console.log("   ✅ TEST 2 PASSED: Successfully routed to publisher node and published.");
    } else {
      console.error(`   ❌ TEST 2 FAILED: Expected PUBLISHED but got ${result2.status}`);
    }

  } catch (error) {
    console.error("❌ Test Runner Failed with Error:", error);
  } finally {
    await closeDbConnection();
    process.exit(0);
  }
};

run();
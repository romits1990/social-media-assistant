import { socialAssistantGraph } from "@/agents/social.workflow";
import { closeDbConnection } from "@/lib/db";

const run = async () => {
  try {
    console.log("🔥 Starting Multi-Agent Social Media Workflow Test...\n");

    const finalState = await socialAssistantGraph.invoke({
      targetTopic: "Fine Arts",
      platform: "linkedin",
      autoPublishEnabled: false, // Set to true to test direct publishing
    });

    console.log("\n================ Workflow Execution Result ================");
    console.log(`Status: ${finalState.status}`);
    console.log(`Retrieved Context Chunks: ${finalState.retrievedChunks.length}`);
    
    if (finalState.draftPost) {
      console.log("\n📝 Generated Post Draft:");
      console.log(`Headline: ${finalState.draftPost.title}`);
      console.log(`Content:\n${finalState.draftPost.content}`);
      console.log(`Hashtags: ${finalState.draftPost.hashtags.join(" ")}`);
      console.log(`Suggested Image: ${finalState.draftPost.suggestedHeroImage || "None"}`);
    }

  } catch (error) {
    console.error("Workflow Execution Failed:", error);
  } finally {
    await closeDbConnection();
    process.exit(0);
  }
};

run();
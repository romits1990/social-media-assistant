import { AgentState } from "@/agents/agent.state";

/**
 * Node 3: Routing logic based on Admin settings.
 */
export const supervisorNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  if (state.status === "FAILED" || !state.draftPost) return {};

  if (state.autoPublishEnabled) {
    console.log(`🚀 [Supervisor Node] Auto-Publish is ENABLED. Routing to Social Publisher...`);
    return {
      status: "PUBLISHED",
    };
  } else {
    console.log(`⏸️ [Supervisor Node] Auto-Publish is DISABLED. Queueing for Admin Review.`);
    return {
      status: "AWAITING_APPROVAL",
    };
  }
};
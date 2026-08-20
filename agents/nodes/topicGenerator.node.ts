import { AgentState } from "@/agents/agent.state";
import { fetchCandidateTopic } from "@/repositories/topic.repository";

/**
 * Node 0: Automatically selects a candidate topic if none is provided,
 * or selects a fresh alternative during retry loops.
 */
export const topicGeneratorNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  const hasProvidedTopic = Boolean(state.targetTopic && state.targetTopic.trim());
  const isFirstRun = state.retryCount === 0;

  // Case 1: Topic is explicitly supplied on initial run
  if (hasProvidedTopic && isFirstRun && !state.attemptedTopics.includes(state.targetTopic!)) {
    console.log(`🎯 [Topic Generator] Using provided seed topic: "${state.targetTopic}"`);
    return {
      attemptedTopics: [state.targetTopic!],
      status: "IDLE",
    };
  }

  // Case 2: Fetch a fresh unposted candidate topic from DB (domain-aware)
  const newTopic = await fetchCandidateTopic(state.attemptedTopics, state.targetDomain);

  // If this is a retry triggered by duplicate rejection or empty chunks, increment retryCount
  const nextRetryCount = isFirstRun && !hasProvidedTopic ? 0 : state.retryCount + 1;

  console.log(
    `🔄 [Topic Generator] Auto-selected topic (Attempt ${nextRetryCount + 1}/${state.maxRetries}): "${newTopic}"`
  );

  return {
    targetTopic: newTopic,
    retryCount: nextRetryCount,
    attemptedTopics: [newTopic],
    status: "IDLE",
  };
};
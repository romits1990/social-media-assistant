import { AgentState } from "@/agents/agent.state";
import { fetchCandidateTopic } from "@/repositories/topic.repository";

/**
 * Node 0: Automatically selects a candidate topic if none is provided,
 * or selects a fresh alternative during retry loops.
 */
export const topicGeneratorNode = async (state: AgentState): Promise<Partial<AgentState>> => {
    // If topic is already set and this is the first attempt, proceed directly
    if (state.targetTopic && state.retryCount === 0 && !state.attemptedTopics.includes(state.targetTopic)) {
        console.log(`🎯 [Topic Generator] Using provided topic: "${state.targetTopic}"`);
        return {
            attemptedTopics: [state.targetTopic],
            status: "IDLE",
        };
    }

    // Fetch a fresh unposted candidate topic from DB
    const newTopic = await fetchCandidateTopic(state.attemptedTopics);
    const nextRetryCount = state.targetTopic ? state.retryCount + 1 : state.retryCount;

    console.log(`🔄 [Topic Generator] Selected fresh topic candidate (Attempt ${nextRetryCount + 1}/${state.maxRetries}): "${newTopic}"`);

    return {
        targetTopic: newTopic,
        retryCount: nextRetryCount,
        attemptedTopics: [newTopic],
        status: "IDLE",
    };
};
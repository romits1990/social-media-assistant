import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation, AgentState } from "@/agents/agent.state";
import { topicGeneratorNode } from "@/agents/nodes/topicGenerator.node";
import { deduplicatorNode } from "@/agents/nodes/deduplicator.node";
import { retrieverNode } from "@/agents/nodes/retriever.node";
import { writerNode } from "@/agents/nodes/writer.node";
import { supervisorNode } from "@/agents/nodes/supervisor.node";
import { publisherNode } from "@/agents/nodes/publisher.node";

// 1. Route after Deduplication Check
const routeAfterDeduplication = (state: AgentState): "retriever" | "topicGenerator" | typeof END => {
  if (state.status === "REJECTED_DUPLICATE") {
    if (state.retryCount < state.maxRetries) {
      console.log(`🔁 [Workflow Router] Duplicate detected. Retrying with alternate topic...`);
      return "topicGenerator";
    }
    return END;
  }
  if (state.status === "FAILED") return END;
  return "retriever";
};

// 2. Route after Context Retrieval Check (Retry Loop!)
const routeAfterRetriever = (state: AgentState): "writer" | "topicGenerator" | typeof END => {
  if (state.status === "EMPTY_CHUNKS" || state.status === "FAILED") {
    if (state.retryCount < state.maxRetries) {
      console.log(`🔁 [Workflow Router] Chunks missing or failed. Retrying with alternate topic...`);
      return "topicGenerator";
    }
    console.error(`❌ [Workflow Router] Max retries (${state.maxRetries}) reached. Terminating workflow.`);
    return END;
  }
  return "writer";
};

// 3. Route after Supervisor Approval Check
const routeAfterSupervisor = (state: AgentState): "publisher" | typeof END => {
  if (state.autoPublishEnabled && state.status !== "FAILED") {
    return "publisher";
  }
  return END;
};

// Build Complete Graph with Automated Retry Loop
export const socialAssistantGraph = new StateGraph(AgentStateAnnotation)
  .addNode("topicGenerator", topicGeneratorNode)
  .addNode("deduplicator", deduplicatorNode)
  .addNode("retriever", retrieverNode)
  .addNode("writer", writerNode)
  .addNode("supervisor", supervisorNode)
  .addNode("publisher", publisherNode)

  // Entry Point
  .addEdge(START, "topicGenerator")
  .addEdge("topicGenerator", "deduplicator")

  // Conditional Routing
  .addConditionalEdges("deduplicator", routeAfterDeduplication, {
    retriever: "retriever",
    topicGenerator: "topicGenerator",
    [END]: END,
  })
  .addConditionalEdges("retriever", routeAfterRetriever, {
    writer: "writer",
    topicGenerator: "topicGenerator",
    [END]: END,
  })
  .addEdge("writer", "supervisor")
  .addConditionalEdges("supervisor", routeAfterSupervisor, {
    publisher: "publisher",
    [END]: END,
  })
  .addEdge("publisher", END)

  .compile();
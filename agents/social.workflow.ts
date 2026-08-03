// src/agents/social.workflow.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation, AgentState } from "@/agents/agent.state";
import { deduplicatorNode } from "@/agents/nodes/deduplicator.node";
import { retrieverNode } from "@/agents/nodes/retriever.node";
import { writerNode } from "@/agents/nodes/writer.node";
import { supervisorNode } from "@/agents/nodes/supervisor.node";
import { publisherNode } from "@/agents/nodes/publisher.node";

/**
 * Conditional router: Bypasses retriever and writer if deduplicator rejects topic.
 */
const routeAfterDeduplication = (state: AgentState): "retriever" | typeof END => {
  if (state.status === "REJECTED_DUPLICATE" || state.status === "FAILED") {
    return END;
  }
  return "retriever";
};

const routeAfterRetrieval = (state: AgentState): "writer" | typeof END => {
  if (state.status === "EMPTY_CHUNKS" || state.status === "FAILED") {
    return END;
  }
  return "writer";
};

const routeAfterSupervisor = (state: AgentState): "publisher" | typeof END => {
  if (state.autoPublishEnabled && state.status !== "FAILED") {
    return "publisher";
  }
  return END;
};

// Build StateGraph with Method Chaining
export const socialAssistantGraph = new StateGraph(AgentStateAnnotation)
  // 1. Register Nodes
  .addNode("deduplicator", deduplicatorNode)
  .addNode("retriever", retrieverNode)
  .addNode("writer", writerNode)
  .addNode("supervisor", supervisorNode)
  .addNode("publisher", publisherNode)

  // 2. Connect Entry Edge
  .addEdge(START, "deduplicator")

  // 3. Conditional Edge: Route based on deduplication status
  .addConditionalEdges("deduplicator", routeAfterDeduplication, {
    retriever: "retriever",
    [END]: END,
  })

  // 4. Conditional Edge: Route based on non empty query results
  .addConditionalEdges("retriever", routeAfterRetrieval, {
    writer: "writer",
    [END]: END
  })
  .addEdge("writer", "supervisor")

  // 5.  Conditional Edge: Route based on autoPublishEnabled status
  .addConditionalEdges("supervisor", routeAfterSupervisor, {
    publisher: "publisher",
    [END]: END,
  })
  .addEdge("publisher", END)

  // 5. Compile final graph
  .compile();
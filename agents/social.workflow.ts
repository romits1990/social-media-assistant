// src/agents/social.workflow.ts
import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation, AgentState } from "@/agents/agent.state";
import { deduplicatorNode } from "@/agents/nodes/deduplicator.node";
import { retrieverNode } from "@/agents/nodes/retriever.node";
import { writerNode } from "@/agents/nodes/writer.node";
import { supervisorNode } from "@/agents/nodes/supervisor.node";

/**
 * Conditional router: Bypasses retriever and writer if deduplicator rejects topic.
 */
const routeAfterDeduplication = (state: AgentState): "retriever" | typeof END => {
  if (state.status === "REJECTED_DUPLICATE" || state.status === "FAILED") {
    return END;
  }
  return "retriever";
};

// Build StateGraph with Method Chaining
export const socialAssistantGraph = new StateGraph(AgentStateAnnotation)
  // 1. Register Nodes
  .addNode("deduplicator", deduplicatorNode)
  .addNode("retriever", retrieverNode)
  .addNode("writer", writerNode)
  .addNode("supervisor", supervisorNode)

  // 2. Connect Entry Edge
  .addEdge(START, "deduplicator")

  // 3. Conditional Edge: Route based on deduplication status
  .addConditionalEdges("deduplicator", routeAfterDeduplication, {
    retriever: "retriever",
    [END]: END,
  })

  // 4. Sequential Execution Edges
  .addEdge("retriever", "writer")
  .addEdge("writer", "supervisor")
  .addEdge("supervisor", END)

  // 5. Compile final graph
  .compile();
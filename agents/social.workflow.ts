import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation } from "@/agents/agent.state";
import { retrieverNode } from "@/agents/nodes/retriever.node";
import { writerNode } from "@/agents/nodes/writer.node";
import { supervisorNode } from "@/agents/nodes/supervisor.node";

// 2. Build and Compile Graph using Method Chaining
export const socialAssistantGraph = new StateGraph(AgentStateAnnotation)
  // Register Nodes (Chaining propagates node key generics)
  .addNode("retriever", retrieverNode)
  .addNode("writer", writerNode)
  .addNode("supervisor", supervisorNode)
  // Define Execution Edges (Connect START -> retriever -> writer -> supervisor -> END)
  .addEdge(START, "retriever")
  .addEdge("retriever", "writer")
  .addEdge("writer", "supervisor")
  .addEdge("supervisor", END)
  // Compile final graph executable
  .compile();
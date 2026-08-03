import { Annotation } from "@langchain/langgraph";
import { VectorSearchResult } from "@/repositories/vector.repository";

export type SocialPlatform = "linkedin" | "twitter" | "instagram" | "facebook";

export type DraftPost = {
  title: string;
  content: string;
  hashtags: string[];
  suggestedHeroImage: string | null;
};

export type AgentStatus =
  | "IDLE"
  | "RETRIEVING"
  | "WRITING"
  | "REJECTED_DUPLICATE"
  | "AWAITING_APPROVAL"
  | "PUBLISHED"
  | "COMPLETED"
  | "FAILED";

export interface AgentState {
  // Inputs
  targetTopic: string;
  topicEmbedding?: number[];
  platform: SocialPlatform;
  autoPublishEnabled: boolean;

  // Intermediate Agent Outputs
  retrievedChunks: VectorSearchResult[];
  isDuplicateTopic: boolean;
  contextSummary: string;
  selectedHeroImage: string | null;

  // Draft Outputs
  draftPost: DraftPost | null;

  // Workflow Control Flags
  status: AgentStatus;
  errorMessage?: string;
}

/**
 * LangGraph Annotation Definition
 */
export const AgentStateAnnotation = Annotation.Root({
  targetTopic: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  topicEmbedding: Annotation<number[] | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
  platform: Annotation<SocialPlatform>({
    reducer: (x, y) => y ?? x,
    default: () => "linkedin",
  }),
  autoPublishEnabled: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  retrievedChunks: Annotation<AgentState["retrievedChunks"]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  isDuplicateTopic: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  contextSummary: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  selectedHeroImage: Annotation<string | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  draftPost: Annotation<AgentState["draftPost"]>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  status: Annotation<AgentState["status"]>({
    reducer: (x, y) => y ?? x,
    default: () => "IDLE",
  }),
  errorMessage: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
});
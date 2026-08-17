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
  | "FAILED"
  | "EMPTY_CHUNKS";

export interface AgentState {
  // Inputs
  targetTopic: string;
  topicEmbedding?: number[];
  platform: SocialPlatform;
  targetDomain?: string;
  autoPublishEnabled: boolean;

  // Retry Control Flags
  retryCount: number;
  maxRetries: number;
  attemptedTopics: string[];

  // Intermediate Agent Outputs
  retrievedChunks: VectorSearchResult[];
  isDuplicateTopic: boolean;
  contextSummary: string;
  selectedHeroImage: string | null;

  // Draft & Database Outputs
  draftPost: DraftPost | null;
  persistedPostId?: string;

  // Pipeline Status & Diagnostics
  status: AgentStatus;
  errorMessage?: string;
}

export const AgentStateAnnotation = Annotation.Root({
  targetTopic: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
  topicEmbedding: Annotation<number[] | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
  platform: Annotation<SocialPlatform>(({
    reducer: (x, y) => y ?? x,
    default: () => "linkedin",
  })),
  targetDomain: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
  autoPublishEnabled: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
  retryCount: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),
  maxRetries: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 3,
  }),
  attemptedTopics: Annotation<string[]>({
    reducer: (x, y) => (y ? [...x, ...y] : x),
    default: () => [],
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
  draftPost: Annotation<DraftPost | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  persistedPostId: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
  status: Annotation<AgentStatus>({
    reducer: (x, y) => y ?? x,
    default: () => "IDLE",
  }),
  errorMessage: Annotation<string | undefined>({
    reducer: (x, y) => y ?? x,
    default: () => undefined,
  }),
});
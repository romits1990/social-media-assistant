import { ChatOllama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { AgentState } from "@/agents/agent.state";
import { OLLAMA_WRITER_MODEL } from "@/constants/agent.constants";

// Initialize generative model for drafting
const writerLlm = new ChatOllama({
  model: OLLAMA_WRITER_MODEL, 
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  temperature: 0.7,
  format: "json", // Forces Ollama to strictly output valid JSON
});

const WRITER_PROMPT = PromptTemplate.fromTemplate(`
You are an expert Social Media Content Strategist. Your task is to generate an engaging post for **{platform}**.

### CONTEXT INFORMATION:
{contextSummary}

### USER TOPIC / GOAL:
{targetTopic}

### PLATFORM FORMATTING RULES:
- **LinkedIn**: Professional tone, insightful hooks, structured bullet points, clear Call to Action (CTA), 3-5 relevant hashtags.
- **Twitter**: Concise, punchy, under 280 characters, highly engaging, 1-2 hashtags.
- **Instagram**: Visual narrative style, engaging opening hook, line breaks, emojis, 5-10 hashtags at the bottom.
- **Facebook**: Conversational, community-focused, questions to drive engagement.

### REQUIRED OUTPUT FORMAT:
Respond strictly in valid JSON format matching this structure:
{{
  "title": "Internal Post Headline",
  "content": "The actual post text tailored for {platform}",
  "hashtags": ["#tag1", "#tag2", "#tag3"]
}}
`);

/**
 * Extracts valid JSON payload from raw LLM text response using regex boundary checks
 */
const extractJsonPayload = (text: string): Record<string, any> => {
  try {
    return JSON.parse(text);
  } catch {
    // Fallback: extract substring between first '{' and last '}'
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not find valid JSON boundaries in model output.");
    }
    return JSON.parse(jsonMatch[0]);
  }
};

export const writerNode = async (state: AgentState): Promise<Partial<AgentState>> => {
  if (state.status === "FAILED") return {};

  try {
    console.log(`✍️ [Writer Agent] Drafting content for platform: ${state.platform.toUpperCase()}...`);

    const formattedPrompt = await WRITER_PROMPT.format({
      platform: state.platform,
      contextSummary: state.contextSummary,
      targetTopic: state.targetTopic,
    });

    const response = await writerLlm.invoke(formattedPrompt);
    const rawContent = typeof response.content === "string" ? response.content : JSON.stringify(response.content);

    // Extract and parse JSON safely
    const parsedDraft = extractJsonPayload(rawContent);

    // 1. Direct consumption of selectedHeroImage from retriever node
    // 2. Fallback check on retrievedChunks metadata if state.selectedHeroImage was undefined
    const heroImage =
      state.selectedHeroImage ??
      state.retrievedChunks.find((c) => c.metadata?.heroImage)?.metadata?.heroImage ??
      null;

    console.log(`✅ [Writer Agent] Post draft generated successfully for platform: ${state.platform}`);

    return {
      draftPost: {
        title: parsedDraft.title || state.targetTopic,
        content: parsedDraft.content,
        hashtags: parsedDraft.hashtags || [],
        suggestedHeroImage: heroImage,
      },
      status: "WRITING",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to parse generated LLM draft";
    console.error(`❌ [Writer Agent Error]: ${msg}`);
    return {
      status: "FAILED",
      errorMessage: `Draft generation failed: ${msg}`,
    };
  }
};
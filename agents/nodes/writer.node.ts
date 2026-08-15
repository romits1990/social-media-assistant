import { ChatOllama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { AgentState } from "@/agents/agent.state";
import { OLLAMA_WRITER_MODEL } from "@/constants/agent.constants";

// Initialize generative model for drafting
const writerLlm = new ChatOllama({
  model: OLLAMA_WRITER_MODEL,
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  temperature: 0.75,
  format: "json", // Forces Ollama to strictly output valid JSON
});

const WRITER_PROMPT = PromptTemplate.fromTemplate(`
You are an expert Social Media Copywriter creating an engaging, original post for **{platform}**.

### SOURCE CONTEXT:
{contextSummary}

### TARGET TOPIC:
{targetTopic}

### STRICT COPYWRITING RULES:
1. **100% Original Words**: Do NOT reuse sentences or idiosyncratic phrases from the context. Translate the core message into your own fresh perspective.
2. **Captivating Hook**: Start with an intriguing hook or relatable question.
3. **Value & Emotion**: Explain why this topic matters to the audience today.
4. **Platform Specifics**:
   - **LinkedIn**: Professional takeaway, clear paragraph breaks, 3-4 industry hashtags.
   - **Instagram**: Expressive storytelling, clean spacing, 3-5 emojis, 5-8 relevant hashtags.
   - **Twitter / X**: Punchy, high-impact, under 250 characters, 1-2 hashtags.
   - **Facebook**: Warm, community tone with an engaging question at the end.
5. **No HTML**: Use ONLY plain text with double newlines (\\n\\n). No tags.
6. **Dynamic Hashtags**: Generate real, relevant hashtags based on the actual content. Do NOT output placeholder words like 'tag1' or 'tag2'.

### REQUIRED JSON SCHEMA:
{{
  "title": "Short Internal Headline",
  "content": "Original caption text crafted specifically for {platform}",
  "hashtags": ["#TopicSpecific", "#IndustryNiche", "#CommunityTag"]
}}
`);

/**
 * Extracts valid JSON payload from raw LLM text response using regex boundary checks
 */
const extractJsonPayload = (text: string): Record<string, any> => {
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not find valid JSON boundaries in model output.");
    }
    return JSON.parse(jsonMatch[0]);
  }
};

/**
 * Strips residual or hallucinated HTML tags and converts paragraph tags to clean newlines
 */
const sanitizeHtmlToPlainText = (text: string): string => {
  if (!text) return "";
  return text
    .replace(/<br\s*\/?>/gi, "\n")      // Convert <br> or <br/> to actual newlines
    .replace(/<\/p>/gi, "\n\n")          // Convert closing </p> to double newlines
    .replace(/<[^>]*>/g, "")             // Strip all remaining HTML tags
    .replace(/[ \t]+/g, " ")             // Collapse redundant inline tabs/spaces
    .replace(/\n\s*\n/g, "\n\n")         // Normalize multiple blank lines
    .trim();
};

/**
 * Normalizes hashtags, cleans whitespace, and discards placeholder tags
 */
const getNormalizedTags = (hashtags: unknown): string[] => {
  const rawTags = Array.isArray(hashtags)
    ? hashtags
    : typeof hashtags === "string"
      ? hashtags.split(",").map((t) => t.trim())
      : [];

  const placeholderPattern = /^#?tag\d+$/i;

  return rawTags
    .filter((t) => typeof t === "string" && t.trim().length > 0)
    .map((tag) => {
      const clean = tag.trim().replace(/\s+/g, "");
      return clean.startsWith("#") ? clean : `#${clean}`;
    })
    .filter((tag) => !placeholderPattern.test(tag));
};

/**
 * Node 3: Create the actual post, draft it for publishing
 **/
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

    // 1. Safe JSON extraction
    const parsedDraft = extractJsonPayload(rawContent);

    // 2. Validate required payload attributes
    if (!parsedDraft.content || typeof parsedDraft.content !== "string") {
      throw new Error("Model generated JSON without a valid string 'content' field.");
    }

    // 3. Post-Processing Sanitizer: Strip any residual HTML tags
    const cleanedPostContent = sanitizeHtmlToPlainText(parsedDraft.content);
    const cleanedTitle = sanitizeHtmlToPlainText(parsedDraft.title || state.targetTopic);

    // 4. Normalize hashtags
    const cleanedHashTags = getNormalizedTags(parsedDraft.hashtags);

    // 5. Resolve Hero Image precedence
    const heroImage =
      state.selectedHeroImage ??
      state.retrievedChunks.find((c) => c.metadata?.heroImage)?.metadata?.heroImage ??
      null;

    console.log(`✅ [Writer Agent] Post draft generated successfully for platform: ${state.platform}`);

    return {
      draftPost: {
        title: cleanedTitle,
        content: cleanedPostContent,
        hashtags: cleanedHashTags,
        suggestedHeroImage: heroImage,
      },
      status: "COMPLETED", // Transition state cleanly for Supervisor Node
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to generate LLM draft";
    console.error(`❌ [Writer Agent Error]: ${msg}`);
    return {
      status: "FAILED",
      errorMessage: `Draft generation failed: ${msg}`,
    };
  }
};
import { callGemini } from "./gemini";
import { SEO_ANALYST_SYSTEM_PROMPT } from "./seo-prompts";

export async function analyzeWithAI(prompt: string): Promise<string> {
  return callGemini({
    systemPrompt: SEO_ANALYST_SYSTEM_PROMPT,
    userPrompt: prompt,
    maxOutputTokens: 8000,
    temperature: 0.3,
  });
}

export async function chatWithAnalyst(
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  return callGemini({
    systemPrompt: SEO_ANALYST_SYSTEM_PROMPT,
    userPrompt: conversationText,
    maxOutputTokens: 4000,
    temperature: 0.3,
  });
}

export async function streamAnalysis(
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const result = await analyzeWithAI(prompt);
  onChunk(result);
  return result;
}

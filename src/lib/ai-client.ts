import Anthropic from "@anthropic-ai/sdk";
import { SEO_ANALYST_SYSTEM_PROMPT } from "./seo-prompts";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return client;
}

export async function analyzeWithAI(prompt: string): Promise<string> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8096,
    system: SEO_ANALYST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}

export async function chatWithAnalyst(
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SEO_ANALYST_SYSTEM_PROMPT,
    messages,
  });

  const textBlock = message.content.find((block) => block.type === "text");
  return textBlock?.text ?? "";
}

export async function streamAnalysis(
  prompt: string,
  onChunk: (chunk: string) => void
): Promise<string> {
  const anthropic = getClient();
  let fullResponse = "";

  const stream = anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8096,
    system: SEO_ANALYST_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullResponse += event.delta.text;
      onChunk(event.delta.text);
    }
  }

  return fullResponse;
}

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface GeminiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export async function callGemini(options: GeminiCallOptions): Promise<string> {
  const { systemPrompt, userPrompt, maxOutputTokens = 4000, temperature = 0.2 } = options;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada. Adicione a chave nas variáveis de ambiente.");

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [{
        role: "user",
        parts: [{ text: userPrompt }],
      }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API HTTP ${response.status}: ${errorText.slice(0, 300)}`);
  }

  const data = await response.json();

  // Log full response structure for debugging
  console.error("[gemini] Response candidates:", data.candidates?.length ?? 0);
  console.error("[gemini] Finish reason:", data.candidates?.[0]?.finishReason);

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    const finishReason = data.candidates?.[0]?.finishReason;
    const blockReason = data.promptFeedback?.blockReason;
    console.error("[gemini] Empty response. Full data:", JSON.stringify(data).slice(0, 500));
    if (blockReason) {
      throw new Error(`Gemini bloqueou a resposta: ${blockReason}. Tente reduzir o conteúdo.`);
    }
    throw new Error(`Gemini retornou resposta vazia. Reason: ${finishReason ?? "unknown"}`);
  }

  console.error("[gemini] Response length:", rawText.length, "chars");
  return rawText;
}

export function parseGeminiJSON<T>(rawText: string): T {
  // First try direct parse
  try {
    return JSON.parse(rawText) as T;
  } catch (e) {
    console.error("[gemini] Direct parse failed:", (e as Error).message, "Length:", rawText.length);
  }

  // Strip markdown fences
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\t/g, " ")
    .trim();

  // Try object match
  const objectMatch = stripped.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]) as T;
    } catch (e) {
      console.error("[gemini] Object extract parse failed:", (e as Error).message);
    }
  }

  // Try array match
  const arrayMatch = stripped.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as T;
    } catch (e) {
      console.error("[gemini] Array extract parse failed:", (e as Error).message);
    }
  }

  console.error("[gemini] All parse attempts failed. Raw start:", rawText.slice(0, 300));
  console.error("[gemini] Raw end:", rawText.slice(-200));
  throw new Error("A IA retornou uma resposta inesperada. Tente novamente.");
}

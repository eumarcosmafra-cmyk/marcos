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
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    const finishReason = data.candidates?.[0]?.finishReason;
    throw new Error(`Gemini retornou resposta vazia. Reason: ${finishReason ?? "unknown"}`);
  }

  return rawText;
}

export function parseGeminiJSON<T>(rawText: string): T {
  try {
    return JSON.parse(rawText) as T;
  } catch {
    const stripped = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Gemini JSON parse failed. Raw:", rawText.slice(0, 500));
      throw new Error("A IA retornou uma resposta inesperada. Tente novamente.");
    }

    return JSON.parse(jsonMatch[0]) as T;
  }
}

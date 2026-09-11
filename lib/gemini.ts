import { ApiError, GoogleGenAI } from "@google/genai";

/**
 * Shared Gemini (Google AI Studio free tier) helper for server routes.
 * Returns the model's JSON reply as `unknown` — callers validate the shape.
 */

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
export const DEFAULT_AI_TIMEOUT_MS = 15_000;

/** Thrown for AI outcomes the caller should treat as "use the fallback". */
export class AiUnavailable extends Error {}

export async function generateJson(opts: {
  apiKey: string;
  system: string;
  prompt: string;
  jsonSchema: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<unknown> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const ai = new GoogleGenAI({ apiKey: opts.apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: opts.prompt,
      config: {
        systemInstruction: opts.system,
        responseMimeType: "application/json",
        responseJsonSchema: opts.jsonSchema,
        temperature: 0,
        abortSignal: controller.signal,
      },
    });

    if (response.promptFeedback?.blockReason) {
      throw new AiUnavailable(`AI blocked the request (${response.promptFeedback.blockReason})`);
    }
    const finish = response.candidates?.[0]?.finishReason;
    if (finish === "MAX_TOKENS") throw new AiUnavailable("AI output was cut off");
    const text = response.text;
    if (!text) throw new AiUnavailable(`AI returned no text${finish ? ` (${finish})` : ""}`);

    try {
      return JSON.parse(text);
    } catch {
      throw new AiUnavailable("AI output was not valid JSON");
    }
  } catch (error) {
    if (controller.signal.aborted) throw new AiUnavailable(`AI request timed out after ${timeoutMs / 1000}s`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** One-line, user-safe description of why an AI call didn't produce a result. */
export function describeAiFailure(error: unknown): string {
  if (error instanceof AiUnavailable) return error.message;
  if (error instanceof ApiError) {
    if ([400, 401, 403].includes(error.status) && /api key|permission|unauth/i.test(error.message)) {
      return "GEMINI_API_KEY was rejected";
    }
    if (error.status === 404) return `AI model "${GEMINI_MODEL}" is not available — set GEMINI_MODEL`;
    if (error.status === 429) return "Gemini free-tier rate limit reached";
    return `AI service error (HTTP ${error.status})`;
  }
  if (error instanceof TypeError) return "could not reach the AI service";
  return "unexpected error while calling the AI service";
}

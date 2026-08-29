import { GoogleGenAI } from "@google/genai";

/**
 * Priority list of standard Gemini models to fall back to in case of rate limits or quota issues.
 */
export const DEFAULT_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.7-flash",
];

/**
 * Returns a deduplicated list of model candidate names to try in sequence.
 */
export function getModelCandidateList(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim();
  const list = [primary, ...DEFAULT_MODEL_CANDIDATES].filter(
    (m): m is string => Boolean(m && m.length > 0)
  );
  return Array.from(new Set(list));
}

export interface GeminiFallbackResult {
  text: string;
  modelUsed: string;
}

export interface GeminiApiErrorDetails {
  status?: number;
  message: string;
  isQuotaExceeded: boolean;
  isOverloaded: boolean;
}

/**
 * Parses and classifies an error thrown by the Gemini SDK.
 */
export function parseGeminiError(error: any): GeminiApiErrorDetails {
  const message = error?.message || String(error);
  const status =
    error?.status ||
    error?.error?.code ||
    (message.includes("429") ? 429 : undefined);

  const isQuotaExceeded =
    status === 429 ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("quota") ||
    message.includes("Quota exceeded") ||
    message.includes("rate-limit") ||
    message.includes("free_tier_requests");

  const isOverloaded =
    status === 503 ||
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("UNAVAILABLE");

  return {
    status: status ? Number(status) : undefined,
    message,
    isQuotaExceeded,
    isOverloaded,
  };
}

/**
 * Executes a generateContent call against Gemini, automatically falling back
 * to alternative working models if a 429 quota exhaustion or 503 high demand error occurs.
 */
export async function generateContentWithFallback(
  ai: GoogleGenAI,
  params: {
    contents: any[];
    config?: any;
    label?: string;
  }
): Promise<GeminiFallbackResult> {
  const models = getModelCandidateList();
  const label = params.label || "Gemini Call";
  let lastError: any = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      console.log(
        `[${label}] Attempting generation with model: ${model} (${i + 1}/${models.length})`
      );
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });

      const text = response.text || "";
      if (text.length > 0 || !params.config?.responseMimeType?.includes("json")) {
        console.log(
          `[${label}] Successfully generated content using model: ${model} (${text.length} chars)`
        );
        return { text, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      const parsedErr = parseGeminiError(err);
      console.warn(
        `[${label}] Model ${model} failed (Status: ${parsedErr.status || "unknown"}). Reason: ${parsedErr.message.slice(0, 150)}`
      );

      // If this was a 429 Quota or 503 Overloaded error, try the next model candidate
      if (parsedErr.isQuotaExceeded || parsedErr.isOverloaded) {
        if (i < models.length - 1) {
          console.log(
            `[${label}] Falling back to next candidate model: ${models[i + 1]}...`
          );
          continue;
        }
      } else {
        // If it's a 400 Bad Request (invalid file, schema mismatch) or other fatal error, don't keep churning through all models
        if (parsedErr.status === 400) {
          throw err;
        }
      }
    }
  }

  // If all candidate models failed
  throw lastError || new Error("All Gemini candidate models failed to generate content.");
}

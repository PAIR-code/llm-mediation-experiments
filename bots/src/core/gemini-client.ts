import {GoogleGenAI} from '@google/genai';

/**
 * Check whether a Gemini API key is available in the environment.
 */
export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export interface GeminiStructuredOptions {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  responseSchema?: Record<string, unknown>;
}

/**
 * Make a structured JSON call to the Gemini API using @google/genai.
 */
export async function callGeminiStructured<T>(
  options: GeminiStructuredOptions,
): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  const ai = new GoogleGenAI({apiKey});
  const model = options.model || process.env.GEMINI_MODEL || 'gemini-3.7-flash';

  const config: Record<string, unknown> = {
    responseMimeType: 'application/json',
  };

  if (options.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }

  if (options.responseSchema) {
    config.responseSchema = options.responseSchema;
  }

  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config,
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini API returned an empty response.');
      }

      try {
        return JSON.parse(text) as T;
      } catch (err) {
        throw new Error(
          `Failed to parse Gemini structured JSON response: ${(err as Error).message}\nRaw text: ${text}`,
        );
      }
    } catch (err: unknown) {
      lastError = err;
      const errMsg = (err as Error)?.message || '';
      const isTransient =
        errMsg.includes('503') ||
        errMsg.includes('429') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE');

      if (isTransient && attempt < maxRetries) {
        const delayMs = attempt * 2000;
        console.warn(
          `[WARN] Gemini call encountered transient error (${errMsg.slice(0, 100)}...). Retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      break;
    }
  }

  throw lastError;
}

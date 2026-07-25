// Gemini/Mistral AI wrapper used by the agent layer.
// Both Gemini and Mistral expose an OpenAI-compatible REST API, so we use the `openai` npm
// package pointed at their respective endpoints.
//
// Exported interface is identical to the former OpenAI version so agents.ts,
// orchestrator.ts etc. need zero import or call-site changes.

import OpenAI from "openai";

const apiKey = process.env.GEMINI_API_KEY || process.env.MISTRAL_API_KEY || "";
export const MODEL = process.env.GEMINI_MODEL || process.env.MISTRAL_MODEL || (process.env.GEMINI_API_KEY ? "gemini-2.5-flash" : "mistral-small-latest");
export const hasOpenAI = Boolean(apiKey); // kept for backward compat (used nowhere externally)

const baseURL = process.env.GEMINI_API_KEY
  ? "https://generativelanguage.googleapis.com/v1beta/openai/"
  : "https://api.mistral.ai/v1";

const client = apiKey
  ? new OpenAI({
      apiKey,
      baseURL,
    })
  : null;

/**
 * Ask Mistral for a JSON object matching the described shape.
 * Returns `fallback` if the API is unavailable or the response can't be parsed.
 */
export async function jsonCompletion<T>(opts: {
  system: string;
  user: string;
  fallback: T;
}): Promise<T> {
  if (!client) return opts.fallback;
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return opts.fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error("[openai-compatible] jsonCompletion failed:", err);
    return opts.fallback;
  }
}

/** Plain-text completion (used for the executive summary). */
export async function textCompletion(opts: {
  system: string;
  user: string;
  fallback: string;
}): Promise<string> {
  if (!client) return opts.fallback;
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.4,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    });
    return res.choices[0]?.message?.content?.trim() || opts.fallback;
  } catch (err) {
    console.error("[openai-compatible] textCompletion failed:", err);
    return opts.fallback;
  }
}

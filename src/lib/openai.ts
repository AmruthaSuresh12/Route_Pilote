// Google Gemini wrapper with automatic Mistral AI fallback.
// Keep Google Gemini as the primary model and automatically fallback
// to Mistral Small 4 (mistral-small-2603) if Gemini fails.

import OpenAI from "openai";
import { AsyncLocalStorage } from "node:async_hooks";

export interface AIContext {
  modelUsed: "Google Gemini" | "Mistral Fallback";
}

export const aiContext = new AsyncLocalStorage<AIContext>();

// Global fallback in case context is not wrapped
let globalLastModelUsed: "Google Gemini" | "Mistral Fallback" = "Google Gemini";

export function getActiveModelUsed(): "Google Gemini" | "Mistral Fallback" {
  const store = aiContext.getStore();
  if (store) return store.modelUsed;
  return globalLastModelUsed;
}

export function setActiveModelUsed(model: "Google Gemini" | "Mistral Fallback") {
  const store = aiContext.getStore();
  if (store) {
    store.modelUsed = model;
  }
  globalLastModelUsed = model;
}

// Credentials
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY || "";
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-small-2603";

// Clients
const geminiClient = GEMINI_API_KEY
  ? new OpenAI({
      apiKey: GEMINI_API_KEY,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    })
  : null;

const mistralClient = MISTRAL_API_KEY
  ? new OpenAI({
      apiKey: MISTRAL_API_KEY,
      baseURL: "https://api.mistral.ai/v1",
    })
  : null;

export const hasOpenAI = Boolean(GEMINI_API_KEY || MISTRAL_API_KEY);

/**
 * Ask primary Google Gemini for a JSON object.
 * Automatically falls back to Mistral Small 4 if Gemini errors/times out.
 */
export async function jsonCompletion<T>(opts: {
  system: string;
  user: string;
  fallback: T;
}): Promise<T> {
  // 1. Try Gemini
  if (geminiClient) {
    try {
      const res = await geminiClient.chat.completions.create({
        model: MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      });
      const raw = res.choices[0]?.message?.content;
      if (raw) {
        return JSON.parse(raw) as T;
      }
    } catch (err) {
      console.warn("[openai.ts] Gemini jsonCompletion failed, attempting Mistral fallback:", err);
      setActiveModelUsed("Mistral Fallback");
    }
  } else {
    // No Gemini key configured, use Mistral
    setActiveModelUsed("Mistral Fallback");
  }

  // 2. Fallback to Mistral
  if (mistralClient) {
    try {
      const res = await mistralClient.chat.completions.create({
        model: MISTRAL_MODEL,
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
      console.error("[openai.ts] Mistral fallback jsonCompletion failed:", err);
      return opts.fallback;
    }
  }

  return opts.fallback;
}

/**
 * Plain-text completion.
 * Automatically falls back to Mistral Small 4 if Gemini errors/times out.
 */
export async function textCompletion(opts: {
  system: string;
  user: string;
  fallback: string;
}): Promise<string> {
  // 1. Try Gemini
  if (geminiClient) {
    try {
      const res = await geminiClient.chat.completions.create({
        model: MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      });
      const content = res.choices[0]?.message?.content?.trim();
      if (content) return content;
    } catch (err) {
      console.warn("[openai.ts] Gemini textCompletion failed, attempting Mistral fallback:", err);
      setActiveModelUsed("Mistral Fallback");
    }
  } else {
    // No Gemini key configured, use Mistral
    setActiveModelUsed("Mistral Fallback");
  }

  // 2. Fallback to Mistral
  if (mistralClient) {
    try {
      const res = await mistralClient.chat.completions.create({
        model: MISTRAL_MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      });
      return res.choices[0]?.message?.content?.trim() || opts.fallback;
    } catch (err) {
      console.error("[openai.ts] Mistral fallback textCompletion failed:", err);
      return opts.fallback;
    }
  }

  return opts.fallback;
}

/**
 * Chat completion helper for AI Copilot.
 * Supports conversational history and automatically falls back to Mistral Small 4.
 */
export async function chatCompletion(opts: {
  system: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  fallback: string;
}): Promise<string> {
  // 1. Try Gemini
  if (geminiClient) {
    try {
      const res = await geminiClient.chat.completions.create({
        model: MODEL,
        temperature: 0.5,
        messages: [
          { role: "system", content: opts.system },
          ...opts.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
      });
      const content = res.choices[0]?.message?.content?.trim();
      if (content) return content;
    } catch (err) {
      console.warn("[openai.ts] Gemini chatCompletion failed, attempting Mistral fallback:", err);
      setActiveModelUsed("Mistral Fallback");
    }
  } else {
    // No Gemini key configured, use Mistral
    setActiveModelUsed("Mistral Fallback");
  }

  // 2. Fallback to Mistral
  if (mistralClient) {
    try {
      const res = await mistralClient.chat.completions.create({
        model: MISTRAL_MODEL,
        temperature: 0.5,
        messages: [
          { role: "system", content: opts.system },
          ...opts.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
      });
      return res.choices[0]?.message?.content?.trim() || opts.fallback;
    } catch (err) {
      console.error("[openai.ts] Mistral fallback chatCompletion failed:", err);
      return opts.fallback;
    }
  }

  return opts.fallback;
}

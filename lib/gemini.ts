/**
 * lib/gemini.ts
 *
 * Server-side only Gemini integration for OfficeFlow AI.
 *
 * IMPORTANT: This file must NEVER be imported by client-side code.
 * The GEMINI_API_KEY is server-only and must never reach the browser.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { Tool, FunctionDeclaration, GenerateContentConfig } from "@google/genai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeminiToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export interface GeminiToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiStructuredResponse<T = unknown> {
  text: string | null;
  toolCalls: GeminiToolCall[];
  parsed: T | null;
}

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. This must be a server-side environment variable."
    );
  }
  return new GoogleGenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Model config
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toGeminiTool(tool: GeminiToolDefinition): FunctionDeclaration {
  const properties: Record<string, object> = {};

  for (const [key, val] of Object.entries(tool.parameters.properties)) {
    const prop: Record<string, unknown> = {
      type: val.type.toUpperCase() as unknown,
      description: val.description,
    };
    if (val.enum) {
      prop.enum = val.enum;
    }
    properties[key] = prop;
  }

  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: Type.OBJECT,
      properties,
      required: tool.parameters.required ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Core: generate with tool calling support + retries
// ---------------------------------------------------------------------------

/**
 * Call Gemini with optional tool declarations and automatic retry on transient
 * errors. The LLM may only interact with the application through the
 * explicitly declared tools list — it never receives direct DB access.
 */
export async function generateWithTools(
  systemPrompt: string,
  userMessage: string,
  tools: GeminiToolDefinition[] = [],
  model: string = DEFAULT_MODEL
): Promise<GeminiStructuredResponse> {
  const client = getGeminiClient();

  const functionDeclarations: FunctionDeclaration[] = tools.map(toGeminiTool);

  const config: GenerateContentConfig = {
    systemInstruction: systemPrompt,
  };

  if (functionDeclarations.length > 0) {
    config.tools = [{ functionDeclarations }] as Tool[];
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        config,
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        throw new Error("No candidates returned from Gemini.");
      }

      // Collect tool/function calls
      const toolCalls: GeminiToolCall[] = [];
      let text: string | null = null;

      for (const part of candidate.content?.parts ?? []) {
        if (part.functionCall) {
          toolCalls.push({
            name: part.functionCall.name ?? "",
            args: (part.functionCall.args ?? {}) as Record<string, unknown>,
          });
        }
        if (part.text) {
          text = (text ?? "") + part.text;
        }
      }

      return { text, toolCalls, parsed: null };
    } catch (err) {
      lastError = err;
      const isTransient =
        err instanceof Error &&
        (err.message.includes("503") ||
          err.message.includes("429") ||
          err.message.includes("timeout") ||
          err.message.toLowerCase().includes("overloaded"));

      if (!isTransient || attempt === MAX_RETRIES) {
        break;
      }

      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(
    `Gemini API error after ${MAX_RETRIES} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

// ---------------------------------------------------------------------------
// Core: generate with structured JSON output (no tool calling)
// ---------------------------------------------------------------------------

/**
 * Call Gemini requesting a structured JSON response.
 * Uses response_mime_type to guarantee JSON output without text-parsing hacks.
 */
export async function generateStructured<T = unknown>(
  systemPrompt: string,
  userMessage: string,
  model: string = DEFAULT_MODEL
): Promise<T> {
  const client = getGeminiClient();

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
        },
      });

      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error("Empty response from Gemini structured output.");
      }

      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err;
      const isTransient =
        err instanceof Error &&
        (err.message.includes("503") ||
          err.message.includes("429") ||
          err.message.includes("timeout") ||
          err.message.toLowerCase().includes("overloaded"));

      if (!isTransient || attempt === MAX_RETRIES) {
        break;
      }

      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(
    `Gemini structured API error after ${MAX_RETRIES} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`
  );
}

// ---------------------------------------------------------------------------
// Agentic loop: multi-turn tool calling
// ---------------------------------------------------------------------------

export interface ToolExecutor {
  (name: string, args: Record<string, unknown>): Promise<unknown>;
}

/**
 * Run a full agentic loop: send message → Gemini calls tools → we execute
 * them → feed results back → repeat until Gemini produces a final text reply.
 *
 * `toolExecutor` is a callback that receives a tool name + args and returns
 * the structured tool result. The LLM can only call tools that are in the
 * `tools` list — no arbitrary access.
 */
export async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  tools: GeminiToolDefinition[],
  toolExecutor: ToolExecutor,
  model: string = DEFAULT_MODEL,
  maxTurns: number = 10
): Promise<string> {
  const client = getGeminiClient();

  const functionDeclarations: FunctionDeclaration[] = tools.map(toGeminiTool);
  const geminiTools: Tool[] = functionDeclarations.length > 0
    ? [{ functionDeclarations }]
    : [];

  const contents: object[] = [
    { role: "user", parts: [{ text: userMessage }] },
  ];

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: systemPrompt,
        tools: geminiTools as Tool[],
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("No candidate in agentic loop response.");

    const parts = candidate.content?.parts ?? [];

    // Collect any function calls in this turn
    const functionCalls = parts.filter((p) => p.functionCall);
    const textParts = parts.filter((p) => p.text);

    if (functionCalls.length === 0) {
      // No more tool calls — return the final text response
      return textParts.map((p) => p.text).join("") || "";
    }

    // Add model turn to history
    contents.push({ role: "model", parts });

    // Execute each tool and collect results
    const toolResultParts = await Promise.all(
      functionCalls.map(async (part) => {
        const name = part.functionCall!.name ?? "";
        const args = (part.functionCall!.args ?? {}) as Record<string, unknown>;
        let result: unknown;
        try {
          result = await toolExecutor(name, args);
        } catch (err) {
          result = {
            error: err instanceof Error ? err.message : String(err),
          };
        }
        return {
          functionResponse: {
            name,
            response: { output: result },
          },
        };
      })
    );

    // Feed tool results back
    contents.push({ role: "user", parts: toolResultParts });
  }

  throw new Error(`Agent loop exceeded maximum turns (${maxTurns}).`);
}

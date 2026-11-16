import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { PatchResponseSchema, type PatchResponse } from "@/lib/patch-schema";
import type { ActionItem } from "@/lib/types";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in .env.local");
  }

  return new GoogleGenAI({ apiKey });
}

const SYSTEM_PROMPT = `You are a real-time Voice-to-Action-Items assistant.
You are given:
1. The CURRENT list of action items (with their IDs).
2. The speaker's RECENT voice transcript (newest words at the end).

Return ONLY the patch operations needed to keep the list accurate:
- ADD: Only for brand-new tasks not already on the list.
- UPDATE: When the speaker clarifies, specifies, or corrects an earlier item.
  * Example: List has "Buy chocolate", speaker says "make it milk chocolate not regular" -> UPDATE that item's targetId to "Buy milk chocolate". Do NOT create a second item.
  * Example: List has "Buy 5 cups", speaker says "no 7 cups" -> UPDATE that item's targetId to text="Buy 7 cups", quantity=7, correctionNote="5 cups -> 7 cups".
- REMOVE: When the speaker cancels an earlier item (e.g., "scratch that", "forget the cups").
- NO_OP: When the speaker is just thinking out loud or repeating something already on the list.

Always include the quantity inside 'text' when there is one (like "Buy 7 cups").`;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateVoicePatches(params: {
  currentItems: ActionItem[];
  recentTranscript: string;
  currentTitle: string;
}): Promise<PatchResponse> {
  const ai = getGeminiClient();

  const simplifiedItems = params.currentItems.map((item) => ({
    id: item.id,
    text: item.text,
    quantity: item.quantity,
    category: item.category,
  }));

  const userMessage = JSON.stringify({
    currentSessionTitle: params.currentTitle,
    currentActionItems: simplifiedItems,
    recentTranscript: params.recentTranscript,
  });

  // Try fast lite model first, then retry or fall back to standard flash on 503/429 spikes
  const modelsToTry = ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite", "gemini-3.5-flash"];

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];

    try {
      const response = await ai.models.generateContent({
        model,
        contents: userMessage,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseJsonSchema: z.toJSONSchema(PatchResponseSchema),
        },
      });

      if (!response.text) {
        return { sessionTitle: null, operations: [] };
      }

      const parsedJson = JSON.parse(response.text);
      return PatchResponseSchema.parse(parsedJson);
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      const isTemporarySpike =
        errorText.includes("503") ||
        errorText.includes("429") ||
        errorText.includes("UNAVAILABLE");

      // If it's a temporary spike and we still have retries left, wait briefly and try again
      if (isTemporarySpike && i < modelsToTry.length - 1) {
        await wait(600 * (i + 1));
        continue;
      }

      throw error;
    }
  }

  return { sessionTitle: null, operations: [] };
}
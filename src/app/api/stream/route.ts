import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseClient } from "@/server/supabase";
import { generateVoicePatches } from "@/server/gemini-patcher";
import { saveChangesToSupabase } from "@/server/sync-items";
import { applyPatchOperations } from "@/lib/patch-reducer";
import type { ActionItem } from "@/lib/types";

const streamRequestSchema = z.object({
  sessionId: z.string().uuid(),
  workspaceId: z.string().min(4),
  fullTranscript: z.string().max(50000),
  recentTranscript: z.string().min(1).max(5000),
});

// Helper to format a Server-Sent Event message
function formatSSE(eventName: string, data: unknown) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  // 1. Validate the incoming JSON body before opening the stream
  let parsedBody: z.infer<typeof streamRequestSchema>;

  try {
    const rawBody = await request.json();
    const result = streamRequestSchema.safeParse(rawBody);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid stream payload" }, { status: 400 });
    }
    parsedBody = result.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  // 2. Open an SSE ReadableStream to send live updates back to React
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(eventName: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(formatSSE(eventName, data)));
        } catch {
          // Ignore if client closed the browser tab early
        }
      }

      const startTime = Date.now();

      try {
        sendEvent("status", {
          stage: "loading",
          message: "Loading current session state...",
        });

        const supabase = getSupabaseClient();

        // Fetch the session & its current items from Supabase
        const { data: session, error: sessionError } = await supabase
          .from("sessions")
          .select("id, title, action_items(*)")
          .eq("id", parsedBody.sessionId)
          .eq("workspace_id", parsedBody.workspaceId)
          .single();

        if (sessionError || !session) {
          sendEvent("error", { message: "Session not found" });
          controller.close();
          return;
        }

        const currentItems = (session.action_items ?? []) as ActionItem[];

        sendEvent("status", {
          stage: "analyzing",
          message: "Checking speech for new items & self-corrections...",
        });

        // Ask Gemini for incremental ADD / UPDATE / REMOVE operations
        const patchResult = await generateVoicePatches({
          currentItems,
          recentTranscript: parsedBody.recentTranscript,
          currentTitle: session.title,
        });

        // Apply patches using our tested reducer
        const { nextItems, appliedChanges } = applyPatchOperations(
          currentItems,
          patchResult.operations,
          parsedBody.sessionId
        );

        // Persist updated items, transcript, and title to Supabase
        const finalTitle = await saveChangesToSupabase({
          sessionId: parsedBody.sessionId,
          workspaceId: parsedBody.workspaceId,
          fullTranscript: parsedBody.fullTranscript,
          newTitle: patchResult.sessionTitle,
          currentTitle: session.title,
          appliedChanges,
        });

        const latencyMs = Date.now() - startTime;

        // Push the final patch results down the SSE stream
        sendEvent("patches", {
          appliedChanges,
          items: nextItems,
          sessionTitle: finalTitle,
          latencyMs,
        });

        sendEvent("done", { latencyMs });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        sendEvent("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
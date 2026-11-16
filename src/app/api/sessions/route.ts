import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseClient } from "@/server/supabase";


const createSessionSchema = z.object({
  workspaceId: z.string().min(4),
  title: z.string().min(1).max(120).optional(),
});

// GET /api/sessions?workspaceId=abc123
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId || workspaceId.length < 4) {
      return NextResponse.json(
        { error: "Please provide a valid workspaceId" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Fetch sessions along with each session's action items
    const { data, error } = await supabase
      .from("sessions")
      .select("*, action_items(*)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .order("created_at", { referencedTable: "action_items", ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sessions: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load sessions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/sessions
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = createSessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request data" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        workspace_id: result.data.workspaceId,
        title: result.data.title ?? "Untitled Voice Session",
        transcript: "",
      })
      .select("*, action_items(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
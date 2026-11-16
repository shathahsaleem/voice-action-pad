import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseClient } from "@/server/supabase";


const updateSessionSchema = z.object({
  workspaceId: z.string().min(4),
  title: z.string().min(1).max(120).optional(),
  transcript: z.string().max(50000).optional(),
});

// PATCH /api/sessions/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js passes dynamic route params as a Promise
    const { id } = await params;
    const body = await request.json();
    const result = updateSessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
    }

    const updates: { title?: string; transcript?: string } = {};
    if (result.data.title !== undefined) updates.title = result.data.title;
    if (result.data.transcript !== undefined) updates.transcript = result.data.transcript;

    if (!updates.title && updates.transcript === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("sessions")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", result.data.workspaceId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session: data });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}

// DELETE /api/sessions/[id]?workspaceId=abc123
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
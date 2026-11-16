import { getSupabaseClient } from "@/server/supabase";
import type { AppliedChange } from "@/lib/patch-reducer";

export async function saveChangesToSupabase(params: {
  sessionId: string;
  workspaceId: string;
  fullTranscript: string;
  newTitle: string | null;
  currentTitle: string;
  appliedChanges: AppliedChange[];
}) {
  const supabase = getSupabaseClient();

  // 1. Update the session transcript (and title if it is still untitled)
  const sessionUpdates: { transcript: string; title?: string } = {
    transcript: params.fullTranscript,
  };

  if (params.newTitle && params.currentTitle === "Untitled Voice Session") {
    sessionUpdates.title = params.newTitle;
  }

  const { error: sessionError } = await supabase
    .from("sessions")
    .update(sessionUpdates)
    .eq("id", params.sessionId)
    .eq("workspace_id", params.workspaceId);

  if (sessionError) {
    throw new Error(`Failed to update session: ${sessionError.message}`);
  }

  // 2. Save each ADD, UPDATE, or REMOVE operation to action_items
  for (const change of params.appliedChanges) {
    if (change.op === "ADD") {
      const { error } = await supabase.from("action_items").insert(change.item);
      if (error) throw new Error(`Failed to insert item: ${error.message}`);
    } else if (change.op === "UPDATE") {
      const { error } = await supabase
        .from("action_items")
        .update({
          text: change.item.text,
          previous_text: change.item.previous_text,
          quantity: change.item.quantity,
          category: change.item.category,
          correction_note: change.item.correction_note,
          updated_at: change.item.updated_at,
        })
        .eq("id", change.item.id);

      if (error) throw new Error(`Failed to update item: ${error.message}`);
    } else if (change.op === "REMOVE") {
      const { error } = await supabase
        .from("action_items")
        .delete()
        .eq("id", change.item.id);

      if (error) throw new Error(`Failed to delete item: ${error.message}`);
    }
  }

  return sessionUpdates.title ?? params.currentTitle;
}
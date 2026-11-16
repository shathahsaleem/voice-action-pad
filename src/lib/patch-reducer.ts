import type { ActionItem } from "@/lib/types";
import type { PatchOperation } from "@/lib/patch-schema";

export interface AppliedChange {
  op: "ADD" | "UPDATE" | "REMOVE";
  item: ActionItem;
}

export function applyPatchOperations(
  currentItems: ActionItem[],
  operations: PatchOperation[],
  sessionId: string
) {
  let updatedList = [...currentItems];
  const appliedChanges: AppliedChange[] = [];
  const now = new Date().toISOString();

  for (const patch of operations) {
    // 1. Skip filler speech
    if (patch.op === "NO_OP") {
      continue;
    }

    // 2. Add a brand-new action item
    if (patch.op === "ADD") {
      const cleanText = patch.text?.trim();
      if (!cleanText) continue;

      const newItem: ActionItem = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        text: cleanText,
        previous_text: null,
        quantity: patch.quantity ?? null,
        category: patch.category?.trim() || "General",
        is_completed: false,
        correction_note: null,
        created_at: now,
        updated_at: now,
      };

      updatedList.push(newItem);
      appliedChanges.push({ op: "ADD", item: newItem });
    }

    // 3. Self-correct an existing item in place
    else if (patch.op === "UPDATE") {
      if (!patch.targetId) continue;

      const index = updatedList.findIndex((item) => item.id === patch.targetId);
      if (index === -1) continue; // Ignore if ID doesn't exist

      const existingItem = updatedList[index];
      const newText = patch.text?.trim() || existingItem.text;
      const didTextChange = newText !== existingItem.text;

      const updatedItem: ActionItem = {
        ...existingItem,
        text: newText,
        // Save the old text so the UI can show a strikethrough diff
        previous_text: didTextChange ? existingItem.text : existingItem.previous_text,
        quantity: patch.quantity !== null ? patch.quantity : existingItem.quantity,
        category: patch.category?.trim() || existingItem.category,
        correction_note:
          patch.correctionNote?.trim() ||
          (didTextChange ? `Changed from "${existingItem.text}"` : existingItem.correction_note),
        updated_at: now,
      };

      updatedList[index] = updatedItem;
      appliedChanges.push({ op: "UPDATE", item: updatedItem });
    }

    // 4. Remove a cancelled item ("scratch that")
    else if (patch.op === "REMOVE") {
      if (!patch.targetId) continue;

      const itemToRemove = updatedList.find((item) => item.id === patch.targetId);
      if (!itemToRemove) continue;

      updatedList = updatedList.filter((item) => item.id !== patch.targetId);
      appliedChanges.push({ op: "REMOVE", item: itemToRemove });
    }
  }

  return { nextItems: updatedList, appliedChanges };
}
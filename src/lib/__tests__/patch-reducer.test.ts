import { describe, it, expect } from "vitest";
import { applyPatchOperations } from "@/lib/patch-reducer";
import { PatchResponseSchema } from "@/lib/patch-schema";
import type { ActionItem } from "@/lib/types";

const TEST_SESSION_ID = "00000000-0000-0000-0000-000000000001";

function createTestItem(overrides: Partial<ActionItem> = {}): ActionItem {
  return {
    id: "item-1",
    session_id: TEST_SESSION_ID,
    text: "Buy chocolate",
    previous_text: null,
    quantity: null,
    category: "Shopping",
    is_completed: false,
    correction_note: null,
    created_at: "2026-11-16T00:00:00.000Z",
    updated_at: "2026-11-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("Self-Correction Patch Reducer", () => {
  it("adds a new item", () => {
    const { nextItems, appliedChanges } = applyPatchOperations(
      [],
      [
        {
          op: "ADD",
          targetId: null,
          text: "Buy 5 cups",
          quantity: 5,
          category: "Shopping",
          correctionNote: null,
        },
      ],
      TEST_SESSION_ID
    );

    expect(nextItems).toHaveLength(1);
    expect(nextItems[0].text).toBe("Buy 5 cups");
    expect(nextItems[0].quantity).toBe(5);
    expect(appliedChanges[0].op).toBe("ADD");
  });

  it("self-corrects chocolate and cup count without duplicating items", () => {
    const startingItems = [
      createTestItem({ id: "choc-1", text: "Buy chocolate" }),
      createTestItem({ id: "cups-1", text: "Buy 5 cups", quantity: 5 }),
    ];

    const { nextItems, appliedChanges } = applyPatchOperations(
      startingItems,
      [
        {
          op: "UPDATE",
          targetId: "choc-1",
          text: "Buy milk chocolate",
          quantity: null,
          category: "Shopping",
          correctionNote: "Specified milk chocolate",
        },
        {
          op: "UPDATE",
          targetId: "cups-1",
          text: "Buy 7 cups",
          quantity: 7,
          category: "Shopping",
          correctionNote: "5 cups -> 7 cups",
        },
      ],
      TEST_SESSION_ID
    );

    // Still 2 items, not 4!
    expect(nextItems).toHaveLength(2);

    // Check chocolate correction
    expect(nextItems[0].previous_text).toBe("Buy chocolate");
    expect(nextItems[0].text).toBe("Buy milk chocolate");

    // Check cups correction
    expect(nextItems[1].previous_text).toBe("Buy 5 cups");
    expect(nextItems[1].text).toBe("Buy 7 cups");
    expect(nextItems[1].quantity).toBe(7);
    expect(appliedChanges).toHaveLength(2);
  });

  it("removes a cancelled item", () => {
    const startingItems = [
      createTestItem({ id: "email-1", text: "Email Sarah" }),
      createTestItem({ id: "cups-1", text: "Buy 7 cups", quantity: 7 }),
    ];

    const { nextItems, appliedChanges } = applyPatchOperations(
      startingItems,
      [
        {
          op: "REMOVE",
          targetId: "email-1",
          text: null,
          quantity: null,
          category: null,
          correctionNote: "User cancelled",
        },
      ],
      TEST_SESSION_ID
    );

    expect(nextItems).toHaveLength(1);
    expect(nextItems[0].id).toBe("cups-1");
    expect(appliedChanges[0].op).toBe("REMOVE");
  });

  it("safely ignores an unknown targetId", () => {
    const startingItems = [createTestItem({ id: "item-1", text: "Buy milk chocolate" })];

    const { nextItems, appliedChanges } = applyPatchOperations(
      startingItems,
      [
        {
          op: "UPDATE",
          targetId: "fake-id-999",
          text: "Should not exist",
          quantity: null,
          category: null,
          correctionNote: null,
        },
      ],
      TEST_SESSION_ID
    );

    expect(nextItems).toHaveLength(1);
    expect(nextItems[0].text).toBe("Buy milk chocolate");
    expect(appliedChanges).toHaveLength(0);
  });

  it("rejects invalid operations using Zod", () => {
    const check = PatchResponseSchema.safeParse({
      sessionTitle: null,
      operations: [{ op: "INVALID_OP", targetId: "1" }],
    });

    expect(check.success).toBe(false);
  });
});
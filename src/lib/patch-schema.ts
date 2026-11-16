import { z } from "zod";

// The 4 possible actions Gemini can take on our list
export const PatchOpTypeSchema = z.enum(["ADD", "UPDATE", "REMOVE", "NO_OP"]);

export const PatchOperationSchema = z.object({
  op: PatchOpTypeSchema,
  targetId: z
    .string()
    .nullable()
    .describe("ID of the existing item to UPDATE or REMOVE. Use null for ADD or NO_OP."),
  text: z
    .string()
    .nullable()
    .describe("Clean action item text, e.g. 'Buy 7 cups' or 'Buy milk chocolate'. Null for REMOVE/NO_OP."),
  quantity: z
    .number()
    .int()
    .nullable()
    .describe("Number/quantity if mentioned (like 7), otherwise null."),
  category: z
    .string()
    .nullable()
    .describe("Short 1-word category like Shopping, Work, Calls, or General."),
  correctionNote: z
    .string()
    .nullable()
    .describe("Short note if fixing an earlier item, e.g. '5 cups -> 7 cups'. Otherwise null."),
});

export const PatchResponseSchema = z.object({
  sessionTitle: z
    .string()
    .nullable()
    .describe("Short 3-5 word session title if the session is still 'Untitled Voice Session', otherwise null."),
  operations: z.array(PatchOperationSchema),
});

export type PatchOperation = z.infer<typeof PatchOperationSchema>;
export type PatchResponse = z.infer<typeof PatchResponseSchema>;
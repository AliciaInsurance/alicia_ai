import { z } from "zod";

export const chatRequestSchema = z.object({
  assistant: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  message: z.string().min(1).max(4000),
  sessionId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  channel: z.enum(["widget", "admin_test"]).default("widget"),
  referrerUrl: z.string().url().max(2000).optional(),
});

export type ChatRequestBody = z.infer<typeof chatRequestSchema>;

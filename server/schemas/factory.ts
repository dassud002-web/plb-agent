import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().default(""),
  contentType: z.enum(["video", "image", "text", "audio", "mixed"]).default("video"),
  sourceRef: z.string().optional(),
});

export const projectIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const saveOutputSchema = z.object({
  projectId: z.string().min(1),
  outputType: z.enum(["prompt", "seo", "caption", "hook", "analysis", "other"]),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const listOutputsQuerySchema = z.object({
  projectId: z.string().min(1),
  outputType: z.enum(["prompt", "seo", "caption", "hook", "analysis", "other"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const jobIdParamsSchema = z.object({
  id: z.string().min(1),
});

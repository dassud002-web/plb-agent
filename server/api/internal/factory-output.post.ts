import { z } from "zod";
import { saveOutputForProject, updateJobStatus } from "~~/server/utils/factory";
import { requireInternalApiSecret } from "~~/server/utils/session";

/**
 * Called by the Eve agent (via internal API) to:
 * 1. Save generated content as a factory output
 * 2. Mark the factory job as done or failed
 */
const factoryOutputSchema = z.object({
  jobId: z.string().min(1),
  projectId: z.string().min(1),
  outputType: z.enum(["prompt", "seo", "caption", "hook", "analysis", "other"]),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.string()).default({}),
  status: z.enum(["done", "failed"]).default("done"),
  errorMessage: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  // Internal API — authenticated via shared secret
  await requireInternalApiSecret(event);

  const body = await readValidatedBody(event, factoryOutputSchema.parse);

  // Build result object (errorMessage embedded in result JSON — no errorMessage column in schema)
  const result: Record<string, string> = { content: body.content, outputType: body.outputType };
  if (body.errorMessage) {
    result.errorMessage = body.errorMessage;
  }

  // Both steps in try/catch so a save failure still marks the job failed
  try {
    // Save the output
    await saveOutputForProject(body.projectId, {
      outputType: body.outputType,
      content: body.content,
      metadata: body.metadata,
    });
  } catch (err) {
    // Output save failed — still mark job so it doesn't stay orphaned
    await updateJobStatus(body.jobId, {
      status: "failed",
      result: { ...result, errorMessage: `Output save failed: ${String(err)}` },
    });
    throw createError({ statusCode: 500, statusMessage: "Output save failed" });
  }

  // Output saved successfully — mark job done (or failed if status=failed)
  await updateJobStatus(body.jobId, {
    status: body.status,
    result,
  });

  return { outputType: body.outputType };
});

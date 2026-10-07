import { z } from "zod";
import { jobIdParamsSchema } from "~~/server/schemas/factory";
import { getJobById, updateJobStatus } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";

const patchJobSchema = z
  .object({
    status: z.enum(["pending", "running", "done", "failed"]).optional(),
    result: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((d) => d.status !== undefined || d.result !== undefined, {
    message: "At least one of status or result must be provided",
  });

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, jobIdParamsSchema.parse);
  await requireSessionUserId(event);
  const body = await readValidatedBody(event, patchJobSchema.parse);

  const existing = await getJobById(id);
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "Job not found" });
  }

  const updated = await updateJobStatus(id, {
    status: body.status,
    result: body.result as Record<string, string> | undefined,
  });
  return { job: updated };
});

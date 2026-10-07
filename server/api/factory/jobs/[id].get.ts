import { jobIdParamsSchema } from "~~/server/schemas/factory";
import { getJobById } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, jobIdParamsSchema.parse);
  await requireSessionUserId(event); // auth only — job ID is UUID, not user-scoped
  const job = await getJobById(id);
  if (!job) {
    throw createError({ statusCode: 404, statusMessage: "Job not found" });
  }
  return { job };
});

import { z } from "zod";
import { createJobForProject, getProjectForUser } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";

const createJobSchema = z.object({
  projectId: z.string().min(1),
  jobType: z.string().min(1),
  inputParams: z.record(z.string(), z.unknown()).default({}),
});

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const body = await readValidatedBody(event, createJobSchema.parse);

  // Verify project belongs to user
  const project = await getProjectForUser(userId, body.projectId);
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }

  const job = await createJobForProject(body.projectId, {
    jobType: body.jobType,
    inputParams: body.inputParams as Record<string, string>,
  });

  setResponseStatus(event, 201, '');
  return { job };
});

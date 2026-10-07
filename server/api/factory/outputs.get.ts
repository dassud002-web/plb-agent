import { listOutputsQuerySchema } from "~~/server/schemas/factory";
import { listOutputsForProject, getProjectForUser } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const { projectId, outputType, limit, offset } =
    await getValidatedQuery(event, listOutputsQuerySchema.parse);

  // Verify project belongs to user
  const project = await getProjectForUser(userId, projectId);
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }

  const outputs = await listOutputsForProject(projectId, { outputType, limit, offset });
  return { outputs, count: outputs.length };
});

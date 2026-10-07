import { projectIdParamsSchema } from "~~/server/schemas/factory";
import { getProjectForUser } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, projectIdParamsSchema.parse);
  const userId = await requireSessionUserId(event);
  const project = await getProjectForUser(userId, id);
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }
  return { project };
});

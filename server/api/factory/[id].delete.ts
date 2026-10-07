import { projectIdParamsSchema } from "~~/server/schemas/factory";
import { deleteProjectForUser } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, projectIdParamsSchema.parse);
  const userId = await requireSessionUserId(event);
  const deleted = await deleteProjectForUser(userId, id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }
  setResponseStatus(event, 204, '');
});

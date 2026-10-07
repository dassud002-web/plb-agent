import { getProjectForUser, listProjectsForUser } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const query = getQuery(event);

  // /api/factory?id=... → get single project
  const id = query.id as string | undefined;
  if (id) {
    const project = await getProjectForUser(userId, id);
    if (!project) {
      throw createError({ statusCode: 404, statusMessage: "Project not found" });
    }
    return { project };
  }

  // List all projects for user
  const status = query.status as "active" | "archived" | undefined;
  const projects = await listProjectsForUser(userId, { status });
  return { projects };
});

import { saveOutputSchema } from "~~/server/schemas/factory";
import { saveOutputForProject } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const body = await readValidatedBody(event, saveOutputSchema.parse);

  // Verify project belongs to user (getProjectForUser checks ownership)
  const { getProjectForUser } = await import("~~/server/utils/factory");
  const project = await getProjectForUser(userId, body.projectId);
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }

  const output = await saveOutputForProject(body.projectId, {
    outputType: body.outputType,
    content: body.content,
    metadata: body.metadata as Record<string, string>,
  });

  setResponseStatus(event, 201, '');
  return { output };
});

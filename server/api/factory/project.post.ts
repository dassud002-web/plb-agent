import { createProjectSchema } from "~~/server/schemas/factory";
import { createProjectForUser } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const body = await readValidatedBody(event, createProjectSchema.parse);
  const project = await createProjectForUser(userId, body);
  setResponseStatus(event, 201, '');
  return { project };
});

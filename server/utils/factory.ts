import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@nuxthub/db";
import type { ContentType, JobStatus, OutputType, ProjectStatus } from "../db/schema/factory";

// ── Projects ──────────────────────────────────────────────────────────────────

export async function createProjectForUser(
  userId: string,
  input: {
    id?: string;
    name: string;
    description?: string;
    contentType?: ContentType;
    sourceRef?: string;
  },
) {
  const id = input.id ?? crypto.randomUUID();
  await db.insert(schema.factoryProjects).values({
    id,
    userId,
    name: input.name.slice(0, 255),
    description: input.description ?? "",
    contentType: input.contentType ?? "video",
    sourceRef: input.sourceRef ?? null,
  });
  return getProjectForUser(userId, id);
}

export async function getProjectForUser(userId: string, id: string) {
  const [row] = await db.select()
    .from(schema.factoryProjects)
    .where(and(
      eq(schema.factoryProjects.id, id),
      eq(schema.factoryProjects.userId, userId),
    ))
    .limit(1);
  return row ?? undefined;
}

export async function listProjectsForUser(
  userId: string,
  opts: { status?: ProjectStatus; limit?: number; offset?: number } = {},
) {
  const { status, limit = 50, offset = 0 } = opts;
  const conditions = [eq(schema.factoryProjects.userId, userId)];
  if (status) conditions.push(eq(schema.factoryProjects.status, status));

  const rows = await db.select()
    .from(schema.factoryProjects)
    .where(and(...conditions))
    .orderBy(desc(schema.factoryProjects.updatedAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function deleteProjectForUser(userId: string, id: string) {
  const existing = await getProjectForUser(userId, id);
  if (!existing) return false;
  await db.delete(schema.factoryProjects)
    .where(and(
      eq(schema.factoryProjects.id, id),
      eq(schema.factoryProjects.userId, userId),
    ));
  return true;
}

// ── Outputs ───────────────────────────────────────────────────────────────────

export async function saveOutputForProject(
  projectId: string,
  input: {
    id?: string;
    outputType: OutputType;
    content: string;
    metadata?: Record<string, string>;
  },
) {
  const id = input.id ?? crypto.randomUUID();
  await db.insert(schema.factoryOutputs).values({
    id,
    projectId,
    outputType: input.outputType,
    content: input.content,
    metadata: JSON.stringify(input.metadata ?? {}),
  });
  return getOutputById(id);
}

export async function getOutputById(id: string) {
  const [row] = await db.select()
    .from(schema.factoryOutputs)
    .where(eq(schema.factoryOutputs.id, id))
    .limit(1);
  if (!row) return undefined;
  return {
    ...row,
    metadata: JSON.parse(row.metadata || "{}"),
  };
}

export async function listOutputsForProject(
  projectId: string,
  opts: { outputType?: OutputType; limit?: number; offset?: number } = {},
) {
  const { outputType, limit = 50, offset = 0 } = opts;
  const conditions = [eq(schema.factoryOutputs.projectId, projectId)];
  if (outputType) conditions.push(eq(schema.factoryOutputs.outputType, outputType));

  const rows = await db.select()
    .from(schema.factoryOutputs)
    .where(and(...conditions))
    .orderBy(desc(schema.factoryOutputs.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    ...row,
    metadata: JSON.parse(row.metadata || "{}"),
  }));
}

// ── Jobs ──────────────────────────────────────────────────────────────────────

export async function createJobForProject(
  projectId: string,
  input: {
    id?: string;
    jobType: string;
    inputParams?: Record<string, string | unknown>;
  },
) {
  const id = input.id ?? crypto.randomUUID();
  await db.insert(schema.factoryJobs).values({
    id,
    projectId,
    jobType: input.jobType,
    input: JSON.stringify(input.inputParams ?? {}),
    status: "pending",
  });
  return getJobById(id);
}

export async function getJobById(id: string) {
  const [row] = await db.select()
    .from(schema.factoryJobs)
    .where(eq(schema.factoryJobs.id, id))
    .limit(1);
  if (!row) return undefined;
  return {
    ...row,
    input: JSON.parse(row.input || "{}"),
    result: row.result ? JSON.parse(row.result) : undefined,
  };
}

export async function updateJobStatus(
  id: string,
  patch: {
    status?: JobStatus;
    result?: Record<string, string>;
  },
) {
  await db.update(schema.factoryJobs)
    .set({
      status: patch.status,
      result: patch.result ? JSON.stringify(patch.result) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.factoryJobs.id, id));
  return getJobById(id);
}

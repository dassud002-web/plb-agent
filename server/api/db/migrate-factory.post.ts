import { db } from "@nuxthub/db";

/**
 * One-time migration runner for factory tables.
 * Protected by INTERNAL_API_SECRET. Idempotent — safe to call multiple times.
 * Creates: factory_projects, factory_outputs, factory_jobs
 */
export default defineEventHandler(async (event) => {
  // Authenticate using INTERNAL_API_SECRET
  const authHeader = getHeader(event, "x-internal-api-secret");
  const expectedSecret = useRuntimeConfig(event).internalApiSecret;
  if (!authHeader || authHeader !== expectedSecret) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }

  const sql = db.$client;

  const migrations = [
    // factory_projects
    `CREATE TABLE IF NOT EXISTS "factory_projects" (
      "id" text PRIMARY KEY NOT NULL,
      "user_id" text NOT NULL,
      "name" varchar(255) NOT NULL,
      "description" text NOT NULL DEFAULT '',
      "content_type" varchar(32) NOT NULL DEFAULT 'video',
      "status" varchar(32) NOT NULL DEFAULT 'active',
      "source_ref" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE INDEX IF NOT EXISTS "factory_projects_user_updated_idx" ON "factory_projects" ("user_id", "updated_at")`,

    // factory_outputs
    `CREATE TABLE IF NOT EXISTS "factory_outputs" (
      "id" text PRIMARY KEY NOT NULL,
      "project_id" text NOT NULL,
      "output_type" varchar(32) NOT NULL,
      "content" text NOT NULL,
      "metadata" text NOT NULL DEFAULT '{}',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE INDEX IF NOT EXISTS "factory_outputs_project_idx" ON "factory_outputs" ("project_id")`,

    // factory_jobs
    `CREATE TABLE IF NOT EXISTS "factory_jobs" (
      "id" text PRIMARY KEY NOT NULL,
      "project_id" text NOT NULL,
      "job_type" varchar(64) NOT NULL,
      "status" varchar(32) NOT NULL DEFAULT 'pending',
      "input" text NOT NULL DEFAULT '{}',
      "result" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,

    `CREATE INDEX IF NOT EXISTS "factory_jobs_project_idx" ON "factory_jobs" ("project_id")`,
    `CREATE INDEX IF NOT EXISTS "factory_jobs_status_idx" ON "factory_jobs" ("status")`,

    // Foreign keys (conditional — wrap in DO $$ block)
    `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'factory_jobs_project_id_factory_projects_id_fk'
  ) THEN
    ALTER TABLE "factory_jobs" ADD CONSTRAINT "factory_jobs_project_id_factory_projects_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "factory_projects"("id") ON DELETE cascade;
  END IF;
END$$`,

    `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'factory_outputs_project_id_factory_projects_id_fk'
  ) THEN
    ALTER TABLE "factory_outputs" ADD CONSTRAINT "factory_outputs_project_id_factory_projects_id_fk"
      FOREIGN KEY ("project_id") REFERENCES "factory_projects"("id") ON DELETE cascade;
  END IF;
END$$`,

    `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'factory_projects_user_id_user_id_fk'
  ) THEN
    ALTER TABLE "factory_projects" ADD CONSTRAINT "factory_projects_user_id_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;
  END IF;
END$$`,
  ];

  const results: string[] = [];
  for (const migration of migrations) {
    try {
      await sql.unsafe(migration);
      results.push("OK: " + migration.slice(0, 50));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already exists") || msg.includes("duplicate") || msg.includes("cannot be cast")) {
        results.push("SKIP: " + migration.slice(0, 50));
      } else {
        results.push("ERROR: " + migration.slice(0, 50) + " -- " + msg);
      }
    }
  }

  // Verify tables exist
  let tables_found: string[] = [];
  try {
    const rows = await sql.unsafe(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('factory_projects', 'factory_outputs', 'factory_jobs')
    `);
    tables_found = (rows as unknown[]).map((r: any) => r.tablename).filter(Boolean);
  } catch {
    // ignore
  }

  return {
    success: tables_found.length === 3,
    migrations_run: results.filter((r) => r.startsWith("OK:")).length,
    migrations_skipped: results.filter((r) => r.startsWith("SKIP:")).length,
    errors: results.filter((r) => r.startsWith("ERROR:")),
    tables_found,
  };
});

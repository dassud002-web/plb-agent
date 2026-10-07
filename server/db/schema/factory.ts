import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Content types supported by the creator factory */
export const contentTypes = ["video", "image", "text", "audio", "mixed"] as const;
export type ContentType = (typeof contentTypes)[number];

/** Project status */
export const projectStatuses = ["active", "archived"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

/** Output type variants */
export const outputTypes = ["prompt", "seo", "caption", "hook", "analysis", "other"] as const;
export type OutputType = (typeof outputTypes)[number];

/** Job status */
export const jobStatuses = ["pending", "running", "done", "failed"] as const;
export type JobStatus = (typeof jobStatuses)[number];

export const factoryProjects = pgTable("factory_projects", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull().default(""),
  contentType: varchar("content_type", { length: 32 })
    .notNull()
    .default("video"),
  status: varchar("status", { length: 32 })
    .notNull()
    .default("active"),
  /** Optional source reference (URL, file path, pasted concept) */
  sourceRef: text("source_ref"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("factory_projects_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const factoryProjectRelations = relations(factoryProjects, ({ one, many }) => ({
  user: one(user, { fields: [factoryProjects.userId], references: [user.id] }),
  outputs: many(factoryOutputs),
  jobs: many(factoryJobs),
}));

export const factoryOutputs = pgTable("factory_outputs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => factoryProjects.id, { onDelete: "cascade" }),
  outputType: varchar("output_type", { length: 32 }).notNull(),
  /** Primary generated content (prompt text, caption, hook, etc.) */
  content: text("content").notNull(),
  /** JSON metadata (keywords, hashtags, SEO fields, etc.) */
  metadata: text("metadata").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("factory_outputs_project_idx").on(table.projectId),
]);

export const factoryOutputRelations = relations(factoryOutputs, ({ one }) => ({
  project: one(factoryProjects, {
    fields: [factoryOutputs.projectId],
    references: [factoryProjects.id],
  }),
}));

export const factoryJobs = pgTable("factory_jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => factoryProjects.id, { onDelete: "cascade" }),
  /** "prompt_generation", "seo_workflow", "caption_workflow", "hook_workflow", "content_analysis" */
  jobType: varchar("job_type", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("pending"),
  /** JSON input parameters for the job */
  input: text("input").notNull().default("{}"),
  /** JSON result or error message */
  result: text("result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("factory_jobs_project_idx").on(table.projectId),
  index("factory_jobs_status_idx").on(table.status),
]);

export const factoryJobRelations = relations(factoryJobs, ({ one }) => ({
  project: one(factoryProjects, {
    fields: [factoryJobs.projectId],
    references: [factoryProjects.id],
  }),
}));

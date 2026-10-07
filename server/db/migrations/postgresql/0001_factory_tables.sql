CREATE TABLE "factory_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"job_type" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"input" text DEFAULT '{}' NOT NULL,
	"result" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_outputs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"output_type" varchar(32) NOT NULL,
	"content" text NOT NULL,
	"metadata" text DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_projects" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content_type" varchar(32) DEFAULT 'video' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"source_ref" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "factory_jobs" ADD CONSTRAINT "factory_jobs_project_id_factory_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."factory_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_outputs" ADD CONSTRAINT "factory_outputs_project_id_factory_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."factory_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_projects" ADD CONSTRAINT "factory_projects_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "factory_jobs_project_idx" ON "factory_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "factory_jobs_status_idx" ON "factory_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "factory_outputs_project_idx" ON "factory_outputs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "factory_projects_user_updated_idx" ON "factory_projects" USING btree ("user_id","updated_at");
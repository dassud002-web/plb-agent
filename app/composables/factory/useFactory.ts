// useRequestFetch is Nuxt's built-in — auto-imported

export type ContentType = "video" | "image" | "text" | "audio" | "mixed";
export type OutputType = "prompt" | "seo" | "caption" | "hook" | "analysis" | "other";
export type JobStatus = "pending" | "running" | "done" | "failed";
export type Workflow = ContentType | "story" | "prompt" | "seo" | "caption" | "hook";

export interface FactoryProject {
  id: string;
  name: string;
  description: string;
  contentType: ContentType;
  status: "active" | "archived";
  sourceRef: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FactoryOutput {
  id: string;
  projectId: string;
  outputType: OutputType;
  content: string;
  metadata: Record<string, string>;
  createdAt: Date;
}

export interface FactoryJob {
  id: string;
  projectId: string;
  jobType: string;
  status: JobStatus;
  input: Record<string, string>;
  result?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const workflows: { value: Workflow; label: string; icon: string }[] = [
  { value: "analysis", label: "Analyze", icon: "i-lucide-search" },
  { value: "story", label: "Story", icon: "i-lucide-book-open" },
  { value: "prompt", label: "Prompt", icon: "i-lucide-wand-2" },
  { value: "seo", label: "SEO", icon: "i-lucide-globe" },
  { value: "caption", label: "Caption", icon: "i-lucide-quote" },
  { value: "hook", label: "Hooks", icon: "i-lucide-zap" },
];

export function useFactory() {
  const requestFetch = useRequestFetch();

  const projects = ref<FactoryProject[]>([]);
  const currentProjectId = ref<string | null>(null);
  const outputs = ref<FactoryOutput[]>([]);
  const isLoadingProjects = ref(false);
  const isLoadingOutputs = ref(false);
  const isSaving = ref(false);
  const isGenerating = ref(false);
  const activeJob = ref<FactoryJob | null>(null);

  const currentProject = computed(
    () => projects.value.find((p) => p.id === currentProjectId.value) ?? null
  );

  // ── Projects ────────────────────────────────────────────────────────────────

  async function fetchProjects() {
    isLoadingProjects.value = true;
    try {
      const data = await requestFetch<{ projects: FactoryProject[] }>(
        "/api/factory"
      );
      projects.value = (data?.projects ?? []).map(normalizeProject);
    } finally {
      isLoadingProjects.value = false;
    }
  }

  async function createProject(input: {
    name: string;
    description?: string;
    contentType?: ContentType;
    sourceRef?: string;
  }) {
    const data = await requestFetch<{ project: FactoryProject }>(
      "/api/factory/project",
      { method: "POST", body: input }
    );
    const project = normalizeProject(data.project);
    projects.value.unshift(project);
    currentProjectId.value = project.id;
    return project;
  }

  async function fetchOutputs(projectId: string) {
    isLoadingOutputs.value = true;
    try {
      const data = await requestFetch<{ outputs: FactoryOutput[] }>(
        `/api/factory/outputs?projectId=${projectId}`
      );
      outputs.value = (data?.outputs ?? []).map(normalizeOutput);
    } finally {
      isLoadingOutputs.value = false;
    }
  }

  async function saveOutput(input: {
    projectId: string;
    outputType: OutputType;
    content: string;
    metadata?: Record<string, string>;
  }) {
    isSaving.value = true;
    try {
      const data = await requestFetch<{ output: FactoryOutput }>(
        "/api/factory/outputs",
        { method: "POST", body: input }
      );
      const output = normalizeOutput(data.output);
      outputs.value.unshift(output);
      return output;
    } finally {
      isSaving.value = false;
    }
  }

  // ── Job polling ─────────────────────────────────────────────────────────────

  async function pollJob(jobId: string, intervalMs = 1500): Promise<FactoryJob> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const timer = setInterval(async () => {
        attempts++;
        try {
          const data = await requestFetch<{ job: FactoryJob }>(
            `/api/factory/jobs/${jobId}`
          );
          const job = normalizeJob(data.job);
          activeJob.value = job;
          if (job.status === "done" || job.status === "failed") {
            clearInterval(timer);
            resolve(job);
          } else if (attempts > 40) {
            clearInterval(timer);
            reject(new Error("Job timed out after 60s"));
          }
        } catch {
          clearInterval(timer);
          reject(new Error("Failed to poll job"));
        }
      }, intervalMs);
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function normalizeProject(row: Record<string, unknown>): FactoryProject {
    return {
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string) ?? "",
      contentType: (row.contentType as ContentType) ?? "video",
      status: (row.status as "active" | "archived") ?? "active",
      sourceRef: (row.sourceRef as string | null) ?? null,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  function normalizeOutput(row: Record<string, unknown>): FactoryOutput {
    return {
      id: row.id as string,
      projectId: row.projectId as string,
      outputType: row.outputType as OutputType,
      content: row.content as string,
      metadata: (row.metadata as Record<string, string>) ?? {},
      createdAt: new Date(row.createdAt as string),
    };
  }

  function normalizeJob(row: Record<string, unknown>): FactoryJob {
    return {
      id: row.id as string,
      projectId: row.projectId as string,
      jobType: row.jobType as string,
      status: row.status as JobStatus,
      input: (row.input as Record<string, string>) ?? {},
      result: (row.result as Record<string, string> | undefined) ?? undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  return {
    workflows,
    projects,
    currentProjectId,
    currentProject,
    outputs,
    isLoadingProjects,
    isLoadingOutputs,
    isSaving,
    isGenerating,
    activeJob,
    fetchProjects,
    createProject,
    fetchOutputs,
    saveOutput,
    pollJob,
  };
}

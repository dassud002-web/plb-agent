<script setup lang="ts">
import { useFactory } from "~/composables/factory/useFactory";
import type { ContentType, OutputType, Workflow } from "~/composables/factory/useFactory";

definePageMeta({ layout: "default" });

const {
  workflows,
  projects,
  currentProjectId,
  currentProject,
  outputs,
  isLoadingProjects,
  isSaving,
  isGenerating,
  activeJob,
  fetchProjects,
  createProject,
  fetchOutputs,
  saveOutput,
  generate,
  pollJob,
} = useFactory();

// ── State ───────────────────────────────────────────────────────────────────
const inputMode = ref<"idea" | "url" | "text">("idea");
const inputValue = ref("");
const selectedWorkflow = ref<Workflow>("analysis");
const isShowProjectModal = ref(false);
const newProjectName = ref("");
const newProjectType = ref<ContentType>("video");
const outputContent = ref("");
const toast = useToast();

// ── Init ────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await fetchProjects();
  if (projects.value.length > 0) {
    currentProjectId.value = projects.value[0].id;
    await fetchOutputs(projects.value[0].id);
  }
});

// ── Watchers ────────────────────────────────────────────────────────────────
watch(currentProjectId, async (id) => {
  if (id) {
    await fetchOutputs(id);
    outputContent.value = "";
  }
});

// ── Handlers ────────────────────────────────────────────────────────────────
async function handleSelectProject(id: string) {
  currentProjectId.value = id;
}

async function handleCreateProject() {
  if (!newProjectName.value.trim()) return;
  await createProject({
    name: newProjectName.value.trim(),
    contentType: newProjectType.value,
  });
  newProjectName.value = "";
  isShowProjectModal.value = false;
  toast.add({
    title: "Project created",
    description: `Switched to "${currentProject.value?.name}"`,
    color: "success",
  });
}

async function handleGenerate() {
  if (!inputValue.value.trim()) return;
  if (!currentProjectId.value) {
    toast.add({ title: "Select or create a project first", color: "warning" });
    return;
  }

  outputContent.value = "";
  isGenerating.value = true;
  activeJob.value = null;

  try {
    const job = await generate({
      projectId: currentProjectId.value,
      workflow: selectedWorkflow.value,
      input: inputValue.value.trim(),
      inputMode: inputMode.value,
    });

    activeJob.value = job;

    // Poll until done or failed
    const finalJob = await pollJob(job.id);
    activeJob.value = finalJob;

    if (finalJob.status === "done" && generatedContent.value) {
      outputContent.value = generatedContent.value;
      toast.add({ title: "Generation complete", color: "success" });
      // Refresh outputs list
      await fetchOutputs(currentProjectId.value);
    } else if (finalJob.status === "failed") {
      toast.add({
        title: "Generation failed",
        description: errorMessage.value ?? "Unknown error",
        color: "error",
      });
    }
  } catch (err) {
    toast.add({ title: "Generation failed", description: String(err), color: "error" });
  } finally {
    isGenerating.value = false;
  }
}

/** Computed error message from result JSON (no errorMessage column in schema) */
const errorMessage = computed(() => (activeJob.value?.result as Record<string, string> | undefined)?.errorMessage);

// spinner only animates while pending/running
const isJobActive = computed(
  () => activeJob.value?.status === "pending" || activeJob.value?.status === "running"
);

// result.content is the generated text (populated when done)
const generatedContent = computed(() => (activeJob.value?.result as Record<string, string> | undefined)?.content);

async function handleSaveOutput() {
  if (!currentProjectId.value || !outputContent.value.trim()) return;
  try {
    const outputType: OutputType = selectedWorkflow.value as OutputType;
    await saveOutput({
      projectId: currentProjectId.value,
      outputType,
      content: outputContent.value.trim(),
      metadata: { workflow: selectedWorkflow.value },
    });
    toast.add({ title: "Output saved", color: "success" });
  } catch (err) {
    toast.add({ title: "Failed to save", description: String(err), color: "error" });
  }
}
</script>

<template>
  <div>
    <UDashboardPanel id="factory" class="min-h-0">
    <template #header>
      <AppNavbar />
    </template>

    <template #body>
      <div class="flex h-full flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6">
        <!-- ── Project bar ──────────────────────────────────────────── -->
        <div class="flex flex-wrap items-center gap-3">
          <USelect
            v-model="currentProjectId"
            :items="projects.map((p) => ({ value: p.id, label: p.name }))"
            :loading="isLoadingProjects"
            placeholder="Select project..."
            class="w-48"
            @change="handleSelectProject"
          />
          <UButton
            icon="i-lucide-plus"
            label="New project"
            size="sm"
            color="neutral"
            variant="outline"
            @click="isShowProjectModal = true"
          />
          <span v-if="currentProject" class="ml-auto text-xs text-muted">
            {{ currentProject.contentType }}
          </span>
        </div>

        <!-- ── Input area ───────────────────────────────────────────── -->
        <div class="space-y-3">
          <!-- Mode tabs -->
          <div class="flex gap-1 rounded-lg border border-border p-1">
            <UButton
              v-for="mode in (['idea', 'url', 'text'] as const)"
              :key="mode"
              :label="mode.charAt(0).toUpperCase() + mode.slice(1)"
              size="xs"
              :variant="inputMode === mode ? 'solid' : 'ghost'"
              :color="inputMode === mode ? 'primary' : 'neutral'"
              @click="inputMode = mode"
            />
          </div>

          <!-- Input -->
          <UTextarea
            v-model="inputValue"
            :placeholder="
              inputMode === 'idea'
                ? 'Describe your content idea...'
                : inputMode === 'url'
                  ? 'Paste a URL...'
                  : 'Paste your text...'
            "
            rows="4"
            autoresize
            class="w-full"
          />

          <!-- Workflow selector -->
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="wf in workflows"
              :key="wf.value"
              :icon="wf.icon"
              :label="wf.label"
              size="xs"
              :variant="selectedWorkflow === wf.value ? 'solid' : 'outline'"
              :color="selectedWorkflow === wf.value ? 'primary' : 'neutral'"
              class="rounded-full"
              @click="selectedWorkflow = wf.value"
            />
          </div>

          <!-- Generate -->
          <UButton
            label="Generate"
            icon="i-lucide-sparkles"
            :loading="isGenerating"
            :disabled="!inputValue.trim() || !currentProjectId"
            @click="handleGenerate"
          />
        </div>

        <!-- ── Output panel ────────────────────────────────────────── -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">Output</h3>
            <UButton
              v-if="outputContent"
              label="Save output"
              size="xs"
              icon="i-lucide-save"
              :loading="isSaving"
              @click="handleSaveOutput"
            />
          </div>

          <UTextarea
            v-model="outputContent"
            rows="8"
            autoresize
            placeholder="Generated content will appear here..."
            class="w-full font-mono text-sm"
          />

          <!-- Job status -->
          <div v-if="activeJob" class="flex items-center gap-2 text-xs text-muted">
            <UIcon
              name="i-lucide-loader-2"
              :class="isJobActive ? 'animate-spin' : ''"
            />
            <span>
              Job: {{ activeJob.status }}
              <span v-if="activeJob.status === 'failed' && errorMessage" class="text-red-400">
                — {{ errorMessage }}
              </span>
            </span>
          </div>
        </div>

        <!-- ── Recent outputs ───────────────────────────────────────── -->
        <div v-if="outputs.length > 0" class="space-y-3">
          <h3 class="text-sm font-semibold">Recent outputs</h3>
          <div class="space-y-2">
            <div
              v-for="output in outputs.slice(0, 10)"
              :key="output.id"
              class="group relative cursor-pointer rounded-lg border border-border p-3 hover:bg-elevated"
              @click="outputContent = output.content"
            >
              <div class="flex items-center justify-between">
                <UBadge
                  :label="output.outputType"
                  size="xs"
                  variant="subtle"
                  color="neutral"
                />
                <span class="text-xs text-muted">
                  {{ new Date(output.createdAt).toLocaleDateString() }}
                </span>
              </div>
              <p class="mt-1 line-clamp-2 text-xs text-muted">
                {{ output.content }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!-- ── New project modal ─────────────────────────────────────────────── -->
  <UModal v-model:open="isShowProjectModal" title="New project">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Project name">
          <UInput
            v-model="newProjectName"
            placeholder="My next viral video..."
            @keyup.enter="handleCreateProject"
          />
        </UFormField>
        <UFormField label="Content type">
          <USelect
            v-model="newProjectType"
            :items="[
              { value: 'video', label: 'Video' },
              { value: 'image', label: 'Image' },
              { value: 'text', label: 'Text' },
              { value: 'audio', label: 'Audio' },
              { value: 'mixed', label: 'Mixed' },
            ]"
          />
        </UFormField>
        <div class="flex justify-end gap-2">
          <UButton
            label="Cancel"
            variant="ghost"
            size="sm"
            @click="isShowProjectModal = false"
          />
          <UButton
            label="Create"
            size="sm"
            :disabled="!newProjectName.trim()"
            @click="handleCreateProject"
          />
        </div>
      </div>
    </template>
  </UModal>
  </div>
</template>

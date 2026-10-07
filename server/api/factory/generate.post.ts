import { z } from "zod";
import { createJobForProject, getProjectForUser, updateJobStatus } from "~~/server/utils/factory";
import { requireSessionUserId } from "~~/server/utils/session";
import { appOrigin } from "~~/agent/lib/internal-api";

/**
 * Workflow → skill file mapping.
 * Each skill tells the agent how to produce the structured output.
 */
const WORKFLOW_SKILL: Record<string, { skill: string; outputType: string; systemPrompt: string }> = {
  analysis: {
    skill: "content-analysis",
    outputType: "analysis",
    systemPrompt: `You are a content analyst. When given content, produce a structured analysis with these fields:

Subject: ...
Category: ...
Hook: ...
Story Beats: ...
Visual Details: ...
Audio: ...
Emotion/Payoff: ...
Loop Potential: ...
CTA: ...
Factual Flags: [...]
Notes: ...

Be specific. Preserve uncertainty — do not invent details the user did not provide. Flag any unverified claims as "unverified".`,
  },
  story: {
    skill: "story-generation",
    outputType: "other",
    systemPrompt: `You are a story craft expert. Given a content idea, generate a compelling narrative arc with:
- Opening hook (first 3 seconds)
- Rising action (2-3 beats)
- Climax/peak moment
- Resolution or CTA

Keep each section concise (1-3 sentences). Focus on emotional progression and viewer retention.`,
  },
  prompt: {
    skill: "prompt-generation",
    outputType: "prompt",
    systemPrompt: `You are an AI prompt engineer. Given a content idea, produce a reusable prompt optimized for short-form video or image generation.

Format:
**Subject:** [precise description]
**Setting:** [environment, lighting, mood]
**Action/Pose:** [what the subject is doing cinematically]
**Style:** [photorealistic, cinematic, editorial, etc.]
**Format:** mobile-first vertical (9:16)
**Quality:** high detail, sharp focus, professional lighting

Prioritize photorealism, face visibility, and continuity. Keep it concise (under 200 words).`,
  },
  seo: {
    skill: "seo-workflow",
    outputType: "seo",
    systemPrompt: `You are an SEO specialist. Given a content idea, produce:

## SEO Title
Max 60 chars. Front-load the primary keyword. Include a hook or number.

## Caption (short)
150-250 chars. First line must hook. Include primary keyword naturally.

## Hashtags
3-5 highly relevant + 1 niche + 1 broad. No keyword stuffing.

## Keywords
Primary: [highest volume]
Secondary: [2-3 long-tail]
Supporting: [3-5 related terms]

## Pinned Comment
1-2 sentences. Include a question that invites replies and a CTA.`,
  },
  caption: {
    skill: "caption-workflow",
    outputType: "caption",
    systemPrompt: `You are a social media copywriter. Given a content idea, write a platform-ready caption:

- Lead with a scroll-stopping first line (bold statement or relatable moment)
- Keep it natural and human — not AI-generated-sounding
- Use line breaks. One thought per line.
- Match the platform voice
- No keyword stuffing
- End with a CTA

Format output as the caption text only, no headers or labels.`,
  },
  hook: {
    skill: "hook-workflow",
    outputType: "hook",
    systemPrompt: `You are a hook strategist. Given a content idea, generate 5 distinct hook angles:

1. [Pattern Interrupt] ...
2. [Curiosity Gap] ...
3. [Social Proof] ...
4. [Bold Claim] ...
5. [Relatable Emotion] ...

For each: describe the first 1-3 seconds precisely. Prioritize first-second retention.`,
  },
};

const generateBodySchema = z.object({
  projectId: z.string().min(1),
  workflow: z.enum(["analysis", "story", "prompt", "seo", "caption", "hook"]),
  input: z.string().min(1),
  inputMode: z.enum(["idea", "url", "text"]).default("idea"),
});

export default defineEventHandler(async (event) => {
  const userId = await requireSessionUserId(event);
  const body = await readValidatedBody(event, generateBodySchema.parse);

  // Verify project ownership
  const project = await getProjectForUser(userId, body.projectId);
  if (!project) {
    throw createError({ statusCode: 404, statusMessage: "Project not found" });
  }

  const skillInfo = WORKFLOW_SKILL[body.workflow];

  // Create a pending job
  const job = await createJobForProject(body.projectId, {
    jobType: body.workflow,
    status: "pending",
    inputParams: {
      workflow: body.workflow,
      input: body.input,
      inputMode: body.inputMode,
    },
  });

  // Fire-and-forget: invoke Eve agent with the skill prompt.
  // Eve will call /api/internal/factory-output when done.
  // Forward the Better Auth session cookie so Eve can authenticate the user
  // (same mechanism as the browser-based chat UI uses via useEveAgent).
  const origin = appOrigin();
  const sessionCookie = getHeader(event, "cookie") ?? "";

  void (async () => {
    try {
      // Start a session with Eve
      const sessionRes = await fetch(`${origin}/eve/v1/session`, {
        method: "POST",
        headers: {
          cookie: sessionCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: `${skillInfo.systemPrompt}\n\n---\nContent to analyze:\n${body.input}`,
        }),
      });

      if (!sessionRes.ok) {
        await updateJobStatus(job.id, {
          status: "failed",
          result: { errorMessage: `Eve agent returned ${sessionRes.status}: ${sessionRes.statusText}` },
        });
        return;
      }

      // Read the NDJSON event stream from Eve
      // Events we care about: message.received, turn.failed, session.failed
      const stream = sessionRes.body;
      if (!stream) {
        await updateJobStatus(job.id, {
          status: "failed",
          result: { errorMessage: "Eve returned an empty response stream" },
        });
        return;
      }

      let assistantMessage = "";
      let turnFailed = false;
      let failureMessage = "";

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            // Accumulate assistant text from message.received events
            if (parsed.type === "message.received") {
              const textParts = (parsed.data?.parts ?? [])
                .filter((p: any) => p.type === "text")
                .map((p: any) => p.text)
                .join("\n")
                .trim();
              if (textParts) assistantMessage = textParts;
            }
            if (parsed.type === "turn.failed") {
              turnFailed = true;
              failureMessage = parsed.data?.message ?? "Turn failed";
            }
            if (parsed.type === "session.failed") {
              turnFailed = true;
              failureMessage = parsed.data?.message ?? "Session failed";
            }
          } catch {
            // ignore parse errors for non-JSON lines
          }
        }
      }

      if (turnFailed) {
        await updateJobStatus(job.id, {
          status: "failed",
          result: { errorMessage: failureMessage },
        });
        return;
      }

      // Save the output and mark job done
      const content = assistantMessage || "(no output)";
      await fetch(`${origin}/api/internal/factory-output`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jobId: job.id,
          projectId: body.projectId,
          outputType: skillInfo.outputType,
          content,
          metadata: { workflow: body.workflow, inputMode: body.inputMode },
          status: "done",
        }),
      });
    } catch (err) {
      // Best-effort: update job as failed without throwing
      try {
        await updateJobStatus(job.id, {
          status: "failed",
          result: { errorMessage: String(err) },
        });
      } catch {
        // ignore
      }
    }
  })();

  return { job };
});

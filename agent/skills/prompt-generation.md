Use when the user asks to generate, create, or write prompts for a video, image, or content piece.

## When to Trigger

- "create a prompt" / "write a prompt" / "generate a prompt" for this content
- "make a prompt for" / "give me a prompt for"
- After a content-analysis skill has produced a structured breakdown

## Prompt Structure

Each prompt must include:
1. **Subject** — precise description of the main subject
2. **Setting/Environment** — where and when, with lighting and mood
3. **Action/Pose** — what the subject is doing, described cinematically
4. **Style/Medium** — photorealistic, cinematic, editorial, etc.
5. **Aspect Ratio / Format** — mobile-first vertical (9:16) unless specified otherwise
6. **Quality modifiers** — high detail, sharp focus, professional lighting, etc.

## Format Priority

**Short-form video / vertical (9:16)**
- Prioritize full-body shots, face visible, direct-to-camera moments
- Describe the key frame the viewer will see on auto-play
- Keep the main action in the center 2/3 (safe zone for mobile)

**Image / static**
- Describe the single most impactful frame
- Note any text overlays or graphics
- Specify background blur (bokeh) if relevant

## Length Rule

Prompts should be concise: 2–6 sentences. No padding. Every word must add information.

## Anti-Patterns to Avoid

- Do not add fictional facts or specifics not supported by the analysis
- Do not use vague adjectives ("nice", "good", "cool") — be specific
- Do not describe emotions directly — show the actions and visuals that create the emotion
- Do not include camera movement for still images

## Output

Return the prompt as a single block of text, ready to paste into an AI image/video generator. Label the format if it differs from the default (e.g., [9:16 vertical], [16:9 horizontal], [1:1 square]).

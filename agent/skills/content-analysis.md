Use when the user asks to analyze, break down, or dissect a video, image, URL, or content concept.

## When to Trigger

- "analyze this" / "break this down" / "what's in this"
- "analyze this concept" / "analyze this idea" / "what would make this viral"
- A URL, image, video link, or pasted text describing a concept
- Any content that needs extraction of subject, hook, story beats, or visual details

## What to Extract

Analyze and return the following fields. Mark uncertain or unknown fields as `unknown` — never invent details.

**Subject & Category**
- Main subject or person
- Content type (short-form video, image post, blog, podcast clip, etc.)
- Niche or vertical (fitness, cooking, tech, finance, etc.)

**Hook**
- The opening claim, visual, or tension that stops the scroll
- First 1–3 seconds described precisely
- What emotion or curiosity gap does it create

**Story Beats** (if applicable)
- Sequence of events or visual changes
- Pacing (fast-cut, slow burn, etc.)
- Peak moment or climax

**Visual Details**
- Setting, lighting, camera angle
- Text overlay or captions present
- Key visual elements that carry meaning

**Audio** (if applicable)
- Voice tone and pace
- Music style or genre
- Sound effects or silence

**Emotion & Payoff**
- Primary emotion triggered (curiosity, awe, anger, laughter, etc.)
- What the viewer feels at the end vs. the beginning
- Is there a payoff? Does the hook pay off?

**Loop Potential** (short-form video)
- Does the ending make you want to replay?
- Is there a visual callback or twist at the end?
- Does the hook repeat naturally?

**CTA / Call to Action**
- Explicit ask (like, comment, share, follow, link in bio)
- Implicit CTA embedded in content

**Factual Flags**
- Any claims, statistics, or specific facts mentioned — flag these for verification
- Note what is stated vs. what is assumed

## Output Format

Return a structured analysis. Use this order:

```
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
```

Be specific. "A person dancing" is not useful. "A woman in a neon-lit kitchen doing a quick recipe reveal in 5 seconds" is useful. Preserve uncertainty — do not fill gaps with plausible-sounding details.

import { defineAgent, defineDynamic } from "eve";
import { google } from "@ai-sdk/google";

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": () => ({
        model: google("gemini-2.0-flash"),
        modelContextWindowTokens: 1_000_000,
      }),
    },
  }),
});

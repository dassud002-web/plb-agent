import { defineAgent, defineDynamic } from "eve";
import { google } from "@ai-sdk/google";

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": () => "google/gemini-2.5-flash",
    },
  }),
});

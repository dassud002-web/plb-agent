import { defineAgent, defineDynamic } from "eve";
import { minimax } from "vercel-minimax-ai-provider";

export default defineAgent({
  model: defineDynamic({
    events: {
      "step.started": () => minimax("MiniMax-M2.7"),
    },
  }),
});

import { defineAgent, defineDynamic } from "eve";
import { minimax } from "vercel-minimax-ai-provider";

export default defineAgent({
  model: defineDynamic({
    events: {
      "session.started": () => ({
        model: minimax("MiniMax-M2.7"),
        modelContextWindowTokens: 204_800,
      }),
    },
  }),
});

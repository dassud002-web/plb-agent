import { defineAgent } from "eve";
import { google } from "@ai-sdk/google";

export default defineAgent({
  model: google("gemini-2.5-flash"),
});

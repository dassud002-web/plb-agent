import { defineMemory } from "eve/memory";
import { fileMemory } from "eve/memory/file";
import { vercelBlob } from "eve/memory/file/vercel";
import { byPrincipal } from "eve/memory/scope";

export default defineMemory({
  description: "Stable facts and preferences about the person you are talking to.",
  provider: fileMemory({ backend: vercelBlob() }),
  scope: byPrincipal,
});

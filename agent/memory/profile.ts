import { defineMemory } from "eve/memory";
import { fileMemory, vercelBlob } from "eve/memory/file";
import { byPrincipal } from "eve/memory/scope";

export default defineMemory({
  description: "Stable facts and preferences about the person you are talking to.",
  provider: fileMemory({ backend: vercelBlob() }),
  scope: byPrincipal,
});

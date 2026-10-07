import { defineMemory } from "eve/memory";
import { fileMemory, inMemory } from "eve/memory/file";
import { vercelBlob } from "eve/memory/file/vercel";
import { byPrincipal } from "eve/memory/scope";

// Use in-memory for factory (stateless) context, or vercelBlob when available
function getMemoryBackend() {
  if (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN) {
    return vercelBlob({ storeId: process.env.BLOB_STORE_ID });
  }
  return inMemory();
}

export default defineMemory({
  description: "Stable facts and preferences about the person you are talking to.",
  provider: fileMemory({ backend: getMemoryBackend() }),
  scope: byPrincipal,
});

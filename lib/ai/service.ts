import type { TryOnProvider } from "./provider";
import type { TryOnRequest, TryOnResult } from "./types";
import { MockTryOnProvider } from "./mock-provider";
import { CatVTONProvider } from "./catvton-provider";

const providers: Record<string, TryOnProvider> = {
  mock: new MockTryOnProvider(),
  catvton: new CatVTONProvider(),
};

export async function generateTryOn(
  request: TryOnRequest
): Promise<TryOnResult> {
  const providerName =
    process.env.TRYON_PROVIDER || "mock";

  const provider = providers[providerName];

  if (!provider) {
    return {
      requestId: crypto.randomUUID(),
      status: "failed",
      error: `Unknown AI provider: ${providerName}`,
    };
  }

  return provider.generateTryOn(request);
}

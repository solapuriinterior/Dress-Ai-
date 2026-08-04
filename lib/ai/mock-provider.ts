import type { TryOnProvider } from "./provider";
import type { TryOnRequest, TryOnResult } from "./types";

export class MockTryOnProvider implements TryOnProvider {
  readonly name = "mock";

  async generateTryOn(
    request: TryOnRequest
  ): Promise<TryOnResult> {
    const requestId = crypto.randomUUID();

    if (!request.personImageUrl || !request.garmentImageUrl) {
      return {
        requestId,
        status: "failed",
        provider: this.name,
        error: "Person image and garment image are required.",
      };
    }

    return {
      requestId,
      status: "completed",
      provider: this.name,

      // Abhi testing ke liye person image ko result bana rahe hain.
      // Agle step me ise real CatVTON API result se replace karenge.
      resultImageUrl: request.personImageUrl,
    };
  }
}

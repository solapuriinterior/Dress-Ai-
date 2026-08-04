import { Client, handle_file } from "@gradio/client";

import type { TryOnProvider } from "./provider";
import type {
  GarmentCategory,
  TryOnRequest,
  TryOnResult,
} from "./types";

type GradioFileResult = {
  url?: string;
  path?: string;
};

function convertCategory(category: GarmentCategory): string {
  switch (category) {
    case "upper_body":
      return "upper";

    case "lower_body":
      return "lower";

    case "full_body":
      return "overall";

    default:
      return "upper";
  }
}

async function downloadImage(url: string): Promise<Blob> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Image download failed: ${response.status} ${response.statusText}`
    );
  }

  return response.blob();
}

function getResultUrl(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const file = value as GradioFileResult;

    if (typeof file.url === "string") {
      return file.url;
    }

    if (typeof file.path === "string") {
      return file.path;
    }
  }

  return undefined;
}

export class CatVTONProvider implements TryOnProvider {
  readonly name = "catvton";

  async generateTryOn(
    request: TryOnRequest
  ): Promise<TryOnResult> {
    const requestId = crypto.randomUUID();

    try {
      const catvtonUrl = process.env.CATVTON_URL;

      if (!catvtonUrl) {
        throw new Error(
          "CATVTON_URL is missing in .env.local."
        );
      }

      if (
        !request.personImageUrl ||
        !request.garmentImageUrl
      ) {
        throw new Error(
          "Person image and garment image are required."
        );
      }

      const [personBlob, garmentBlob] =
        await Promise.all([
          downloadImage(request.personImageUrl),
          downloadImage(request.garmentImageUrl),
        ]);

      const client = await Client.connect(catvtonUrl);

const personFile = handle_file(personBlob);

const personEditorValue = {
  background: personFile,
  layers: [],
  composite: personFile,
};
      const prediction = await client.predict(
        "/submit_function",
        [
          personEditorValue,
          handle_file(garmentBlob),
          convertCategory(request.category),
          20,
          1,
          42,
          "result only",
        ]
      );

console.log(
  "CatVTON prediction:",
  JSON.stringify(prediction, null, 2)
);

      const firstResult = Array.isArray(prediction.data)
        ? prediction.data[0]
        : prediction.data;

      const resultImageUrl =
        getResultUrl(firstResult);

      if (!resultImageUrl) {
        throw new Error(
          "CatVTON returned no result image."
        );
      }

      return {
        requestId,
        status: "completed",
        resultImageUrl,
        provider: this.name,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown CatVTON error.";

      console.error("CatVTON provider error:", error);

      return {
        requestId,
        status: "failed",
        provider: this.name,
        error: message,
      };
    }
  }
}

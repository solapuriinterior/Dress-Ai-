import type { TryOnRequest, TryOnResult } from "./types";

export interface TryOnProvider {
  readonly name: string;

  generateTryOn(request: TryOnRequest): Promise<TryOnResult>;
}

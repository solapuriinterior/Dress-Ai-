export type GarmentCategory =
  | "upper_body"
  | "lower_body"
  | "full_body";

export type TryOnRequest = {
  personImageUrl: string;
  garmentImageUrl: string;
  category: GarmentCategory;
  shopId?: string;
  productId?: string;
};

export type TryOnStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed";

export type TryOnResult = {
  requestId: string;
  status: TryOnStatus;
  resultImageUrl?: string;
  error?: string;
  provider?: string;
};

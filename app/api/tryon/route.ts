import { NextResponse } from "next/server";
import { generateTryOn } from "@/lib/ai/service";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const result = await generateTryOn({
      personImageUrl: body.personImageUrl,
      garmentImageUrl: body.garmentImageUrl,
      category: body.category,
      shopId: body.shopId,
      productId: body.productId,
    });

    const statusCode = result.status === "failed" ? 400 : 200;

    return NextResponse.json(result, {
      status: statusCode,
    });
  } catch (error) {
    console.error("Try-on API error:", error);

    return NextResponse.json(
      {
        requestId: crypto.randomUUID(),
        status: "failed",
        error: "Invalid request or internal server error.",
      },
      { status: 500 }
    );
  }
}

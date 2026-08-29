import { NextResponse } from "next/server";
import { analyzeBrandSources, type SourceDescriptor } from "@/lib/brand-analysis";

const acceptedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const body = (await request.json()) as {
    brandName?: string;
    consent?: boolean;
    sources?: SourceDescriptor[];
  };

  if (!body.consent) {
    return NextResponse.json(
      { error: "Explicit rights confirmation is required." },
      { status: 403 },
    );
  }

  const sources = body.sources ?? [];
  if (
    sources.length === 0 ||
    sources.length > 20 ||
    sources.some(
      (source) =>
        !acceptedTypes.has(source.type) ||
        source.size <= 0 ||
        source.size > 15 * 1024 * 1024,
    )
  ) {
    return NextResponse.json(
      { error: "Provide 1–20 valid PNG, JPEG or WEBP source descriptors." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    profile: analyzeBrandSources(sources, body.brandName ?? ""),
    provider: "local-demo-v1",
    retention: "Request metadata is not persisted.",
  });
}

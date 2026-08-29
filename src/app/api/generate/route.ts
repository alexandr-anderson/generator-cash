import { NextResponse } from "next/server";
import { createDirections } from "@/lib/creative";
import type { CreativeBrief, StyleProfile } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    profile?: StyleProfile;
    brief?: CreativeBrief;
  };

  if (!body.profile?.approved) {
    return NextResponse.json(
      { error: "Approve the style profile before generation." },
      { status: 409 },
    );
  }

  if (!body.brief?.topic?.trim()) {
    return NextResponse.json(
      { error: "A content topic is required." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    directions: createDirections(body.profile, body.brief),
    run: {
      provider: "local-demo",
      model: "deterministic-layout-v1",
      costUsd: 0,
      syntheticContent: true,
    },
  });
}

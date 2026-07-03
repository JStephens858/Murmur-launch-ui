import { type NextRequest, NextResponse } from "next/server";

import { getPublicVideos } from "@/lib/murmur-api";

/**
 * Public videos pagination endpoint for the client-side infinite scroll on
 * /videos. GET /api/videos?type=long|short&count=24&cursor=<lastPostId>
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type") === "short" ? "short" : "long";
  const count = Math.min(
    Math.max(Number(params.get("count")) || 24, 1),
    60,
  );
  const cursor = params.get("cursor") || null;

  try {
    const page = await getPublicVideos(
      type === "long"
        ? { longCount: count, shortCount: 0, lastLongPostId: cursor }
        : { longCount: 0, shortCount: count, lastShortPostId: cursor },
    );
    return NextResponse.json(page);
  } catch {
    return NextResponse.json(
      { error: "Failed to load videos" },
      { status: 502 },
    );
  }
}

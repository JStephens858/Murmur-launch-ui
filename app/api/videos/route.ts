import { type NextRequest, NextResponse } from "next/server";

import { getPublicVideos } from "@/lib/murmur-api";

/**
 * Public videos endpoint for the client-side infinite scroll and hashtag
 * filtering on /videos.
 * GET /api/videos?type=long|short|all&count=24&cursor=<lastPostId>&hashtagId=<id>
 * type=all returns both kinds (count each) and ignores cursor — used for the
 * first page of a hashtag-filtered view.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const typeParam = params.get("type");
  const type =
    typeParam === "short" ? "short" : typeParam === "all" ? "all" : "long";
  const count = Math.min(
    Math.max(Number(params.get("count")) || 24, 1),
    60,
  );
  const cursor = params.get("cursor") || null;
  const hashtagId = params.get("hashtagId") || null;

  try {
    const page = await getPublicVideos(
      type === "all"
        ? { longCount: count, shortCount: count, hashtagId }
        : type === "long"
          ? { longCount: count, shortCount: 0, lastLongPostId: cursor, hashtagId }
          : { longCount: 0, shortCount: count, lastShortPostId: cursor, hashtagId },
    );
    return NextResponse.json(page);
  } catch {
    return NextResponse.json(
      { error: "Failed to load videos" },
      { status: 502 },
    );
  }
}

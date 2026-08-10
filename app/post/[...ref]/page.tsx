import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PublicPost from "@/components/legacy/public-post";
import { siteConfig } from "@/config/site";
import { truncateString } from "@/lib/format";
import { parsePostRef } from "@/lib/legacy-urls";
import type { PublicPost as PublicPostData } from "@/lib/murmur-legacy";
import { getPublicPostData, mutationTimeoutMs } from "@/lib/murmur-legacy";

/**
 * The shared-post link, in any of the forms in circulation:
 *
 *   /post/<dashed-uuid>?mc=<magicCookie>
 *   /post/<dashed-uuid>/<magicCookie>
 *   /post/<flat-uuid>/<magicCookie>      <- the app's form, dashes stripped
 *   /post/<flat-uuid>
 *
 * A catch-all segment because the cookie may be a second path segment; see
 * parsePostRef for the grammar and for why the flat id has to be re-dashed before
 * it reaches the API.
 *
 * Replaces legacy's executePublicPostPage, which read a template off disk and
 * substituted OG tags with unescaped string .replace() calls, then handed
 * rendering to the old React shell. Metadata now comes from generateMetadata
 * (escaped by Next) and the post is server-rendered.
 *
 * The cookie gates the content: with it the backend returns the full post,
 * without it only a 100-character excerpt for link previews. So this page must
 * never be cached — a cached render would serve one visitor's gated view to
 * another.
 *
 * /post/* is an AASA universal-link path, so on iOS with the app installed this
 * is never reached. It exists for desktop, Android, and link-preview crawlers.
 */
export const dynamic = "force-dynamic";

/** The preview image legacy fell back to; copied into public/ so links already
 *  shared keep the same card art. */
const FALLBACK_OG_IMAGE = "/Logo-registered-whitebg.png";

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface LoadedPost {
  post: PublicPostData | null;
  /** Canonical dashed id, for a cookie-free og:url regardless of URL form. */
  postId: string | null;
}

async function loadPost(
  params: Promise<{ ref: string[] }>,
  searchParams: Promise<Record<string, string | string[] | undefined>>,
): Promise<LoadedPost> {
  // Both are Promises in Next 16 and must be awaited.
  const { ref: segments } = await params;
  const ref = parsePostRef(segments);
  if (!ref) return { post: null, postId: null };

  // A cookie in the path wins over ?mc=. The two forms come from different
  // clients and never co-occur; when the cookie is a path segment it is part of
  // the resource identity, so it takes precedence.
  const mc = ref.mc ?? firstParam((await searchParams).mc);

  try {
    const post = await getPublicPostData(
      ref.postId,
      mc,
      AbortSignal.timeout(mutationTimeoutMs()),
    );
    return { post, postId: ref.postId };
  } catch {
    // A backend hiccup shouldn't 500 a shared link — fall through to the
    // not-found page, same as legacy's catch did.
    return { post: null, postId: ref.postId };
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { post, postId } = await loadPost(params, searchParams);

  if (!post || post.resultType === "none") {
    return { title: "Post", robots: { index: false, follow: false } };
  }

  // Legacy used the same truncated text for title and description. Preserved so
  // previews already cached by Slack and X don't shift.
  const excerpt = truncateString(post.postText || "", 100);
  const title = excerpt || `Post by @${post.creator.username}`;
  const image = post.mediaPreviewUrl || FALLBACK_OG_IMAGE;
  /*
   * The canonical dashed id with no cookie, whichever form the visitor arrived
   * on. Two reasons: the magic cookie must never travel in metadata that gets
   * shared onward (legacy also stripped it, by splitting the query off), and the
   * flat app-generated form collapses to one canonical URL instead of a second
   * address for the same post.
   */
  const canonicalPath = `/post/${postId}`;

  return {
    title,
    description: excerpt || siteConfig.description,
    // These pages are gated by `mc` and hold member content, so they stay out of
    // search indexes. Crawlers that build link previews still read the OG tags.
    robots: { index: false, follow: false },
    openGraph: {
      type: "article",
      url: canonicalPath,
      title,
      description: excerpt || siteConfig.description,
      siteName: siteConfig.name,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.xHandle,
      title,
      description: excerpt || siteConfig.description,
      images: [image],
    },
  };
}

export default async function PostRoute({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { post } = await loadPost(params, searchParams);

  // resultType "none" covers a bad id and a deleted or unpublished post alike;
  // a null post also covers a segment that isn't a parseable post reference.
  if (!post || post.resultType === "none" || !post.postId) {
    notFound();
  }

  return <PublicPost post={post} />;
}

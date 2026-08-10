import { FileIcon } from "lucide-react";

import AppStoreBadge from "@/components/ui/app-store-badge";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { VideoPlayer } from "@/components/ui/video-player";
import { formatVideoDate } from "@/lib/format";
import type { PublicMediaElement, PublicPost } from "@/lib/murmur-legacy";

import LegacyPage from "./legacy-page";

/**
 * Post media is user-generated, so its host set is unbounded — mostly the
 * company's own S3 bucket, but there are twimg.com URLs in the table too. Plain
 * <img> rather than next/image for exactly that reason: next/image throws on any
 * host missing from next.config's remotePatterns, which would turn one unusual
 * post into a broken page.
 */
/* eslint-disable @next/next/no-img-element */

function MediaElement({ element }: { element: PublicMediaElement }) {
  switch (element.mediaType) {
    case "text":
      return element.mediaText ? (
        <p className="text-foreground/90 leading-relaxed whitespace-pre-line">
          {element.mediaText}
        </p>
      ) : null;

    case "image":
      return (
        <figure className="flex flex-col gap-2">
          {element.mediaUrl && (
            <img
              src={element.mediaUrl}
              alt={element.mediaText || "Post image"}
              loading="lazy"
              className="border-border mx-auto max-h-[70vh] w-auto max-w-full rounded-xl border"
            />
          )}
          {element.mediaText && (
            <figcaption className="text-muted-foreground text-sm">
              {element.mediaText}
            </figcaption>
          )}
        </figure>
      );

    case "video":
      // streamUrl is an HLS manifest; VideoPlayer handles Safari-native vs hls.js.
      return (
        <figure className="flex flex-col gap-2">
          {element.streamUrl ? (
            <div className="border-border overflow-hidden rounded-xl border bg-black">
              <VideoPlayer
                src={element.streamUrl}
                poster={element.mediaPreviewImageUrl ?? undefined}
                className="aspect-video"
              />
            </div>
          ) : (
            element.mediaPreviewImageUrl && (
              <img
                src={element.mediaPreviewImageUrl}
                alt={element.mediaText || "Video preview"}
                loading="lazy"
                className="border-border w-full rounded-xl border"
              />
            )
          )}
          {element.mediaText && (
            <figcaption className="text-muted-foreground text-sm">
              {element.mediaText}
            </figcaption>
          )}
        </figure>
      );

    case "poll": {
      const total = element.pollVotesCast ?? 0;
      return (
        <div className="border-border bg-card/50 flex flex-col gap-3 rounded-xl border p-5">
          {element.mediaText && (
            <p className="font-medium">{element.mediaText}</p>
          )}
          <ul className="flex flex-col gap-2">
            {(element.pollResults ?? []).map((option) => {
              const pct = option.count && total > 0 ? (option.count / total) * 100 : 0;
              return (
                <li key={option.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={option.isWinner ? "font-medium" : undefined}>
                      {option.text}
                    </span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {option.percentStr ?? "0%"}
                    </span>
                  </div>
                  {/* Result bar. Width is data-derived, so it has to be inline. */}
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={
                        option.isWinner ? "bg-brand h-full" : "bg-muted-foreground/40 h-full"
                      }
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-muted-foreground text-xs">
            {total} {total === 1 ? "vote" : "votes"} &middot; results from physicians on
            MurmurMD
          </p>
        </div>
      );
    }

    case "file":
      return (
        <div className="border-border text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm">
          <FileIcon className="size-4 shrink-0" aria-hidden />
          <span>{element.mediaText || "Attachment"} — open in the app to view</span>
        </div>
      );

    default:
      return null;
  }
}

function CreatorRow({ post }: { post: PublicPost }) {
  const { creator } = post;
  // The "og" shape returns an empty displayName and avatar, so the handle has to
  // stand on its own rather than being repeated under a name that isn't there.
  const displayName = creator.displayName?.trim();
  return (
    <div className="flex items-center gap-3">
      {creator.profilePicThumbnailUrl && (
        <img
          src={creator.profilePicThumbnailUrl}
          alt=""
          className="border-border size-10 shrink-0 rounded-full border object-cover"
        />
      )}
      <div className="flex flex-col text-left">
        {displayName && (
          <span className="text-sm font-medium">{displayName}</span>
        )}
        {creator.username && (
          <span
            className={
              displayName
                ? "text-muted-foreground text-xs"
                : "text-sm font-medium"
            }
          >
            @{creator.username}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Public post page, replacing legacy's executePublicPostPage — which injected
 * OG tags into the old React shell with unescaped string .replace() calls and
 * left the rendering to that app. Here the metadata comes from generateMetadata
 * and the post itself is server-rendered.
 *
 * Two shapes, decided by the backend's resultType:
 *  - "full": the link carried a valid `mc`, so the whole post renders.
 *  - "og": no valid `mc`. All that exists is a 100-character excerpt, a preview
 *    image and a username, so the page is a teaser pointing at the app. Note the
 *    backend returns `createdDate` as *now* in this case, so the date is
 *    deliberately not shown.
 *
 * On iOS with the app installed neither is reached: /post/* is an AASA universal
 * link, so the app intercepts it. These pages are for desktop, Android, and the
 * crawlers that build link previews.
 */
export default function PublicPost({ post }: { post: PublicPost }) {
  const isFull = post.resultType === "full";
  const elements = [...post.mediaElements].sort(
    (a, b) => a.indexInPost - b.indexInPost,
  );

  return (
    <LegacyPage>
      <Section className="pb-12 sm:pb-24">
        <article className="mx-auto flex max-w-2xl flex-col gap-6 pt-16">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CreatorRow post={post} />
            {isFull && post.postGroupName && (
              <Badge variant="outline">{post.postGroupName}</Badge>
            )}
          </div>

          {isFull && post.createdDate && (
            <p className="text-muted-foreground text-xs">
              {formatVideoDate(post.createdDate)}
            </p>
          )}

          {post.postText && (
            <p className="text-foreground leading-relaxed whitespace-pre-line">
              {post.postText}
            </p>
          )}

          {isFull ? (
            elements.length > 0 && (
              <div className="flex flex-col gap-6">
                {elements.map((element) => (
                  <MediaElement key={element.mediaElementId} element={element} />
                ))}
              </div>
            )
          ) : (
            /* og shape: a preview image is all the media we're given. */
            post.mediaPreviewUrl && (
              <img
                src={post.mediaPreviewUrl}
                alt=""
                className="border-border mx-auto max-h-[70vh] w-auto max-w-full rounded-xl border"
              />
            )
          )}

          <div className="border-border mt-4 flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-8 text-center">
            <p className="font-medium">
              {isFull
                ? "See the discussion on MurmurMD"
                : "Read this post on MurmurMD"}
            </p>
            <p className="text-muted-foreground max-w-md text-sm">
              {isFull
                ? "Replies, related cases, and the rest of the conversation live in the app. MurmurMD is physicians-only — we verify every member during signup."
                : "This is a preview. The full post, its media, and the discussion around it are in the app, which is physicians-only."}
            </p>
            <AppStoreBadge />
          </div>
        </article>
      </Section>
    </LegacyPage>
  );
}

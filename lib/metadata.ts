import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

/**
 * The two social-share cards, rendered by `npm run og-images` into public/.
 * "default" is the site card; "invite" is for the invite landing pages.
 */
export const SHARE_CARDS = {
  default: {
    url: "/og-default.png",
    alt: "MurmurMD — Built by physicians, powered by collaboration",
  },
  invite: {
    url: "/og-invite.png",
    alt: "You're invited to MurmurMD",
  },
} as const;

export type ShareCard = keyof typeof SHARE_CARDS;

/**
 * OpenGraph and Twitter tags for one route. Spread it into a page's metadata
 * export next to the page's own `title` and `description`.
 *
 * Why every public page needs this: Next merges metadata shallowly, so a page
 * that sets `title` and `description` but not `openGraph` inherits the root
 * layout's entire openGraph block, and the share card ends up with the home
 * page's title, description and URL.
 *
 * Title and description are deliberately absent here. When openGraph and
 * twitter don't set them, Next fills both from the page's resolved title (with
 * the "%s - MurmurMD" template applied) and description, so each page only
 * states them once.
 *
 * @param path  The route's canonical path, used for og:url. Omit it in a
 *              layout, where no single URL applies.
 */
export function shareMetadata(
  path?: string,
  card: ShareCard = "default",
): Pick<Metadata, "openGraph" | "twitter"> {
  const image = SHARE_CARDS[card];
  return {
    openGraph: {
      type: "website",
      locale: "en_US",
      ...(path ? { url: path } : {}),
      siteName: siteConfig.name,
      images: [{ url: image.url, width: 1200, height: 630, alt: image.alt }],
    },
    twitter: {
      card: "summary_large_image",
      site: siteConfig.xHandle,
      creator: siteConfig.xHandle,
    },
  };
}

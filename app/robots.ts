import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * The disallowed paths are the endpoints ported from Murmur-express. Their URLs
 * carry invite codes and verification tokens, so they must not be indexed.
 * next.config.mjs sends a matching X-Robots-Tag, which is the part that works on
 * a crawler that already has the URL.
 *
 * `/post/` is deliberately NOT listed, despite also being gated. Slackbot,
 * Twitterbot and facebookexternalhit all honour robots.txt, so disallowing it
 * would stop them fetching the page and break the link previews those pages
 * exist to produce. Keeping them out of search indexes is handled by
 * `robots: { index: false }` in the route's generateMetadata, which suppresses
 * indexing without blocking the fetch.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/emailVerification/",
        "/acceptReengagementPosts/",
        "/doNotPromote/",
        "/invite/",
        "/invite4/",
        "/appstore/",
      ],
    },
    host: siteConfig.url,
  };
}

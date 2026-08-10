import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d3ngaae513epof.cloudfront.net",
      },
    ],
  },
  async headers() {
    return [
      {
        // Legacy endpoints ported from Murmur-express. These carry invite codes,
        // magic cookies and verification tokens in the path, so they must never
        // enter a search index. See also app/robots.ts.
        source:
          "/:path(emailVerification|acceptReengagementPosts|doNotPromote|invite|invite2|invite3|invite4|invite-qr|appstore)/:rest*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;

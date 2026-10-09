import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root,
  },
  // Dev only: lets a phone on the LAN load the dev server by IP. Without it
  // Next blocks the dev chunks for any host but localhost, the page never
  // hydrates, and nothing client-side works (menus, the sign-in link).
  allowedDevOrigins: ["192.168.*.*"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "d3ngaae513epof.cloudfront.net",
      },
    ],
  },
  async rewrites() {
    return {
      // Proxy /api to the Murmur API on this same host. As a fallback rewrite
      // it only applies when no route here matches, so app/api/* still wins.
      // The target comes from MURMUR_API_SERVER because the API speaks plain
      // HTTP on a dev machine but HTTPS (USE_SSL) on servers, where its cert
      // only covers the server's own hostname, not localhost.
      fallback: process.env.MURMUR_API_SERVER
        ? [
            {
              source: "/api/:path*",
              destination: `${process.env.MURMUR_API_SERVER}/:path*`,
            },
          ]
        : [],
    };
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

# MurmurMD website

The public web presence for [MurmurMD](https://murmurmd.com), the
physicians-only professional community where doctors share cases, compare
outcomes, query their peers, and learn from each other. The site carries the
marketing pages, the public video library, the legal pages, the legacy
endpoints that printed QR codes and already-sent emails point at, and a
signed-in web portal for physicians.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 and
shadcn-style components on Radix primitives. See `DECISIONS.md` for the running
log of product and technical decisions, and `PLAN.md` for the build plan.

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

| Script              | What it does                                                                  |
| ------------------- | ----------------------------------------------------------------------------- |
| `npm run build`     | Production build; prints the deploy reminder below                            |
| `npm run start`     | Serves the last build                                                         |
| `npm run lint`      | ESLint                                                                        |
| `npm test`          | Unit tests (`lib/**/*.test.ts`)                                               |
| `npm run og-images` | Re-renders the social-share cards in `public/` (`scripts/og-images.mjs`)      |
| `npm run icons`     | Re-renders the favicon and touch icon from the wordmark (`scripts/icons.mjs`) |

## Where things live

- `app/` — routes. Public pages at the top level; the signed-in portal under
  `app/(portal)/`; legacy endpoints under their original paths.
- `components/sections/` — page sections (navbar, hero, footer, FAQ, …);
  `components/ui/` — primitives; `components/portal/` — the portal.
- `config/site.ts` — site name, URL, description, App Store links, socials.
- `lib/metadata.ts` — the OpenGraph helper every public page spreads into its
  metadata, so share cards carry the page's own title, description and URL.
- `public/` — static assets, including the legal pages under `public/info/`.
- `scripts/` — dev tooling: a mock portal API, a recording API stub for the
  legacy-URL check, and the image generators above.

## Environment variables

No `.env*` file is committed (see DECISIONS.md). Create `.env.local` in the repo
root on each machine — dev or server — before building:

```bash
# Auth0 (Applications → your Regular Web Application)
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SECRET=          # session-cookie encryption: openssl rand -hex 32
APP_BASE_URL=http://localhost:3000

# MurmurMD GraphQL API (Apollo server)
MURMUR_API_SERVER=http://localhost:4000/api
# AUTH0_AUDIENCE=      # optional: Auth0 API identifier if the API requires it

# Database connection driven by the custom sign-in form at /login.
# Defaults to Username-Password-Authentication; set it if yours is named
# differently. The Auth0 application must have the Password grant enabled
# (Applications -> Advanced Settings -> Grant Types), and the API above must
# allow offline access or no refresh token comes back. See DECISIONS.md.
# AUTH0_DB_CONNECTION=Username-Password-Authentication

# Mixpanel project token (public identifier, not a secret).
# Analytics are disabled entirely when unset. Baked in at build time —
# must be present when `next build` runs.
# NEXT_PUBLIC_MIXPANEL_TOKEN=

# ── Legacy endpoints ported from Murmur-express ──────────────────────────
# Two non-expiring backend service-user tokens. Required by the ported
# endpoints; server-only, never NEXT_PUBLIC_. Renamed from their legacy
# names (AUTH_TOKEN / HEALTH_CHECK_AUTH_TOKEN) because a bare AUTH_TOKEN is
# ambiguous next to the AUTH0_* vars.
MURMUR_SERVICE_AUTH_TOKEN=          # legacy AUTH_TOKEN — invite linkage,
                                    # reengagement accept, admin flag
MURMUR_HEALTH_CHECK_AUTH_TOKEN=     # legacy HEALTH_CHECK_AUTH_TOKEN —
                                    # email verification, health check

# Optional, with defaults:
# MURMUR_XFF_TRUSTED_HOPS=0             # trusted proxy hops when deriving a
#                                       # client IP for logging/rate limiting
# MURMUR_LEGACY_MUTATION_TIMEOUT_MS=2500  # budget for a mutation whose result
#                                         # gates the rendered page
```

### Local dev overrides

`.env.development.local` is read only by `next dev`, and it wins over
`.env.local` (Next's order is `.env.development.local` > `.env.local` >
`.env.development` > `.env`). Keys you leave out fall through, so it is a
partial override, not a replacement. Note that `.env.development` on its own
does _not_ override `.env.local`, which is the trap.

Its one job today is `APP_BASE_URL`. `.env.local` holds the public https URL,
and the Auth0 SDK marks the session cookie `Secure` whenever `APP_BASE_URL` is
https — which a browser then drops on a plain-http origin, so sign-in appears
to work and then bounces straight back to `/login`.

Production is served through the load balancer, which terminates TLS, so the
https base URL is correct there and nothing needs overriding. A dev server is
reached on the box directly (`http://web01.murmurmd.com:<port>`), bypassing the
balancer, and that hop really is plain http — hence the override.
`AUTH0_COOKIE_SECURE=false` is the narrower alternative if you would rather
leave the base URL alone.

Note that a **release build does not read this file** — `next build` and
`next start` see `.env.local` only. That is the intended behaviour: behind the
load balancer the origin is https and the `Secure` cookie is right. It only
becomes a trap if a release build is ever reached over plain http, bypassing
the balancer.

## Deploying

Production is a self-hosted `next start` under systemd (`murmur-site`). After
pulling and running `npm run build`, the service **must be restarted** —
the running process keeps serving the previous `.next` output and, because
Next reads `public/` once at startup, it 404s any file added since it
started. `npm run build` prints the reminder; the command is:

```bash
sudo systemctl restart murmur-site
```

## Legacy endpoints

`/emailVerification`, `/acceptReengagementPosts`, `/doNotPromote`, `/invite/4/…`,
`/invite4/…`, `/appstore/…`, `/health-check`, `/web-health.html`,
`/sendgrid-webhook`, `/info/*` and the Apple app-site-association files are
ported from `Murmur-express/staticServer.js`. Their URLs appear in already-sent
emails and printed QR codes and **cannot change** — `lib/legacy-urls.ts`
transcribes the original `substring()` offsets, with tests in
`lib/legacy-urls.test.ts` (`npm test`).

To check the whole surface against a recording stub:

```bash
# 1. a stub standing in for the GraphQL API, recording every call
STUB_PORT=4555 STUB_LOG=./calls.jsonl node scripts/api-stub.mjs &
# 2. the site pointed at it
MURMUR_API_SERVER=http://localhost:4555/api \
MURMUR_SERVICE_AUTH_TOKEN=test-service-token \
MURMUR_HEALTH_CHECK_AUTH_TOKEN=test-healthcheck-token \
  npm run build && npx next start -p 3111 &
# 3. assert responses AND the exact GraphQL variables sent
BASE=http://localhost:3111 CALLS=./calls.jsonl scripts/verify-legacy-urls.sh
```

## Acknowledgements

The site was started from the [Launch UI](https://launchuicomponents.com)
Next.js template. Its components are used under the MIT licence reproduced in
`LICENSE.md`; everything else in this repository is MurmurMD's.

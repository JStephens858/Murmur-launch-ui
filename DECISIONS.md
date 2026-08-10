# Decision Log

Running log of product, design, and technical decisions for the Murmur company website.
Newest entries at the top. Each entry: what we decided, why, and any alternatives we ruled out.
When a decision is reversed, don't delete it — mark it **Superseded** with a link to the new entry.

Format:

```
## YYYY-MM-DD — Short title
**Decision:** What we chose.
**Why:** The reasoning / constraints.
**Alternatives considered:** What we ruled out and why (optional).
**Status:** Active | Superseded by [entry]
```

---

## 2026-08-10 — `/post/<id>` is server-rendered, with the `mc` cookie deciding how much shows
**Decision:** `/post/<postId>?mc=…` renders in Next rather than injecting tags into the old React shell. `generateMetadata` produces the OG/Twitter card; the page renders the post itself — creator, group, date, and media elements in `indexInPost` order, covering text, image, video (HLS via the existing `VideoPlayer`), poll (with result bars) and file.
**Why the page has two shapes:** the backend's `resultType` decides. With a matching `mc` it returns `"full"` — everything. Without one it returns `"og"`, which it describes as "used for opengraph only": a 100-character excerpt, a preview image and a username, no media, and **`createdDate` set to now rather than the post's real date** — which is why the ungated view deliberately prints no date. `"none"` (unknown, deleted or unpublished post) becomes a 404.
**Details that matter:**
- `og:url` is the bare `/post/<id>` path. The magic cookie must never travel in metadata that gets shared; legacy got this right by splitting the query off first, and the suite now asserts it.
- Title and description both use legacy's `truncateString(postText, 100)`, so previews already cached by Slack and X don't shift. `Logo-registered-whitebg.png` was copied into `public/` for the same reason — it's the fallback card art on posts with no preview image.
- Never cached (`force-dynamic`): a cached render could serve one visitor's gated view to another.
- Post media uses plain `<img>`, not `next/image`. The media hosts are user-generated — mostly the company's S3 bucket, but there are `pbs.twimg.com` URLs in the table — and `next/image` throws on any host missing from `remotePatterns`, which would turn one unusual post into a broken page.
**All four URL forms in circulation are accepted**, via `parsePostRef` in `lib/legacy-urls.ts` and a catch-all route segment:
```
/post/<dashed-uuid>?mc=<cookie>      /post/<dashed-uuid>/<cookie>
/post/<flat-uuid>/<cookie>           /post/<flat-uuid>
```
The flat id is the app's form — dashes stripped — and the cookie may arrive as a second path segment rather than a query parameter. All four were confirmed working against live `murmurmd.com` before porting. A cookie in the path wins over `?mc=`; the two come from different clients and never co-occur.
**The id has to be re-dashed before it reaches the API.** `murmur-uuid-buffer.toBuffer` throws on anything that isn't exactly 36 characters with dashes, so a flat id cannot be passed through — `parsePostRef` normalises it. Mis-parsing is safe: the backend compares the cookie for equality, so a wrong cookie degrades to the excerpt-only `"og"` response rather than granting anything, and an unparseable id fails the query outright. Junk in the cookie position 404s rather than silently rendering a teaser that looks like the cookie merely failed to match.
**Not supported:** the concatenated form `/post/<flat-uuid><cookie>` with no separator. Live returns 200 with an empty `og:title` and the generic logo for it, so it isn't a real shape and inventing support would be guesswork.
**`og:url` is always the canonical dashed, cookie-free path**, whichever form the visitor arrived on — so the flat form doesn't create a second address for the same post, and the cookie can't be republished by a crawler. (The cookie does appear in Next's RSC router payload, a script in the body, but that is only sent to the client that supplied it in the first place, and never reaches the document head.)
**A trap worth remembering:** `/post/` is deliberately **not** in `robots.txt`. Slackbot, Twitterbot and facebookexternalhit all honour robots.txt, so disallowing it would stop them fetching and break the link previews these pages exist to produce. Keeping them out of search is done with `robots: { index: false }` in metadata, which suppresses indexing without blocking the fetch.
**Status:** Active

## 2026-08-10 — `/app/*` added to the AASA, making it live for the first time
**Decision:** `/app/*` joins `/invite/*`, `/post/*` and `/user/*` as a universal-link path, at the owner's request.
**Why this is a change and not a restoration:** `/app/*` existed only in the root `/apple-app-site-association` on the old box, and that file is **invalid JSON** — three missing commas, one immediately before `"/app/*"`. Apple fetches `/.well-known/apple-app-site-association`, which never contained it, and Apple's CDN confirms no device has ever been told about it. `genAASA.js` doesn't emit it, and no `/app/` URL is referenced anywhere in this site, the Express server, or the Apollo backend. Serving it from valid JSON activates it.
**Consequences to watch:** iOS will start intercepting `murmurmd.com/app/...` and handing it to the app. Nothing may be published under `/app/` on this site without app-installed visitors never reaching it; and if the app has no handler for that path, such links may open the app to a default state instead of a page. Worth confirming with the iOS team what, if anything, handles `/app/*`.
**Status:** Active

## 2026-08-10 — The live AASA, not the Murmur-express file, is the source of truth
**Decision:** `lib/aasa.ts` is reconciled against what Apple currently serves for murmurmd.com, which includes a second `webcredentials` app, `6L582Z5SW6.com.murmurmd.murmur-dev`. The verification script pins the exact declaration (paths, components, webcredentials) and reports any drift from Apple's CDN.
**Why:** The AASA deployed on the Express box was hand-edited and never committed — that `-dev` entry appears nowhere in Murmur-express. Porting the repo copy would have silently dropped shared webcredentials for the dev build of the iOS app (breaking password autofill there) with no error anywhere, and Apple caches the file for about a day.
**How to check what production actually declares:** `curl https://app-site-association.cdn-apple.com/a/v1/murmurmd.com` — Apple's own cache of the file, which is what devices see.
**General lesson for this port:** for anything the old box serves, verify against what is live, not what is checked in. The repo and the deployed state have drifted at least here, and `static/trash/` shows they drifted elsewhere too.
**Status:** Active

## 2026-08-07 — Invite codes are 6–9 characters, and only the recorded code is truncated
**Decision:** `isInviteCode` accepts six to nine alphanumeric characters. The full code is what the page displays and what goes into the deep link; `toLinkageCode` trims to six characters for the `createIPInviteLinkage` call and nowhere else.
**Why:** The port initially required exactly six characters, on the assumption that legacy's `substring(n, n+6)` slices reflected the real width. They don't — `generateInviteCode(7)` in Murmur-apollo produces seven characters from `BCDFGHJKLMNPQRSTVWXYZ`, so every genuine `/invite/4/<code>` link 404'd. Separately, `createIPInviteLinkage` rejects any code longer than six outright (`"Who are you?"`), which is why the truncation has to survive somewhere — but a truncated code is not redeemable, so it must never be the code a visitor sees.
**Legacy bug this surfaces:** `/invite4/<code>` truncated on the server and its linkage succeeded, while `/invite/4/<code>` passed the full seven characters and its linkage has been failing silently in production for every generated code. `invite4.html` displayed the correct full code only by accident, because it re-derived it in the browser from `window.location.pathname`.
**Worth fixing upstream:** the six-character cap in `createIPInviteLinkage` predates seven-character codes. Until it moves, `inviteCodeToIPLinks` stores six-character prefixes, so attribution joins on a prefix rather than a whole code.
**Status:** Active

## 2026-08-06 — Port the legacy Express endpoints natively; retire the Murmur-express dependency
**Decision:** The endpoints `Murmur-express/staticServer.js` serves on murmurmd.com are reimplemented in this app rather than proxied to the old box: `/emailVerification`, `/acceptReengagementPosts`, `/doNotPromote`, `/invite/4/…`, `/invite4/…`, `/appstore/…`, `/health-check*`, `/web-health.html`, `/sendgrid-webhook`, `/info/*`, and the Apple app-site-association files.
**Why:** Each is roughly twenty lines, and this repo already has the primitive they need (`fetchMurmurAPI` in `lib/murmur-api.ts` against `MURMUR_API_SERVER`). Proxying would mean running the 2021 Express/Apollo stack indefinitely, and since the new site is on a different box it would also need its own public hostname and TLS.
**Alternatives considered:** Proxy every legacy path to the untouched Express box (lowest-risk cutover, but two servers forever); split the new site onto a subdomain (breaks universal links, which point at murmurmd.com paths).
**Out of scope:** `/tools/*` (moved to its own machine), the old `static/` CRA site (replaced by this one), and `PUT /videoUpload/*` — which is broken today anyway, writing to a `testUploads/` directory that does not exist. Streaming uploads to disk is a poor fit for `next start`; leave it on Express or rebuild it as a signed S3 PUT.
**Status:** Active

## 2026-08-06 — Legacy URLs are parsed by their original substring offsets, not by route params
**Decision:** `lib/legacy-urls.ts` derives every value from the pathname using the exact `substring()` offsets from `staticServer.js`. Route files supply the shape only; `params` never feeds a GraphQL variable.
**Why:** These URLs are baked into already-sent emails and printed QR codes, so the grammar is frozen. Next decodes dynamic segments and legacy did not, so reading `params` would silently change what the API receives. Keeping the offsets makes the port diffable against the original line by line, and `lib/legacy-urls.test.ts` asserts against values computed by hand from that file.
**Legacy quirks preserved on purpose:** `/health-check-api-2` resolves to service `api`; `/health-checkfoo` resolves to the default.
**One offset deliberately not preserved:** the six-wide invite-code slices — see the 2026-08-07 entry on invite code length.
**Status:** Active

## 2026-08-06 — Fire-and-forget gets two different answers
**Decision:** Invite attribution (`createIPInviteLinkage`) uses `after()` from `next/server` so it never delays a page or the `/appstore` redirect. The mutations that *are* the point of the request — `webBasedAcceptReengagementPosts`, `webBasedAdminFlagSet`, `adminVerifyEmail` — are awaited with an `AbortSignal.timeout` budget (`MURMUR_LEGACY_MUTATION_TIMEOUT_MS`, default 2500ms) and the page reports the real outcome.
**Why:** Legacy awaited none of them and replied `OK <args>` immediately, so a failed accept was indistinguishable from a successful one. An un-awaited promise in Next can also be killed when the response finishes, so "just don't await" is not even faithful. Verified: against a deliberately slow backend the invite page answers in ~16ms and the linkage still lands; `/doNotPromote` cuts off at 2.5s and renders a failure page.
**Depends on the hosting choice:** `after()` completes reliably because this is a long-lived self-hosted `next start` process. On a serverless host that guarantee weakens — revisit this if the deployment target changes.
**Status:** Active

## 2026-08-06 — A method guard in proxy.ts, because Next aliases HEAD to GET
**Decision:** `proxy.ts` answers any non-GET request to a legacy action path with a bare 200 before anything else runs. `lib/legacy-guard.ts` additionally skips the mutation (while still rendering the page) on prefetch headers, known crawler/scanner user-agents, and a repeat of the identical URL inside a 10-minute window, logging one structured line per hit.
**Why:** Next implements `HEAD` by calling the `GET` handler verbatim (`next/dist/server/route-modules/app-route/helpers/auto-implement-methods.js`), and a Server Component cannot see the request method at all — so the proxy is the only place this check can live. Without it a link-checker's HEAD probe sets an admin flag. Beyond that, `/doNotPromote` and `/acceptReengagementPosts` change state from an unauthenticated GET, and Outlook Safe Links, mail gateways and browser prefetch all issue GETs; `/acceptReengagementPosts` has no secret in its URL at all, just a date and a username.
**Deliberately not done:** a confirmation interstitial, the only complete fix, because it would change the one-click behaviour of links already in the wild. The UA list and prefetch headers are spoofable — this reduces accidents, not attacks.
**Not applied to invite linkage:** legacy counted every view including crawler fetches, so filtering them would shift the attribution baseline mid-stream.
**Status:** Active

## 2026-08-06 — AASA is a route handler reached by rewrite; the rewrites live in proxy.ts
**Decision:** `/.well-known/apple-app-site-association` and `/apple-app-site-association` both rewrite to `app/api/aasa/route.ts`, which sets `Content-Type: application/json` explicitly. `/health-check*` and the extensionless `/info/*` URLs are rewritten in `proxy.ts` too, not in `next.config.mjs`.
**Why:** The AASA filename has no extension, so serving it from `public/` would guess `application/octet-stream` where Apple requires JSON — and Apple will not follow a redirect, so it must be a rewrite. Handling all three in `proxy.ts` avoids depending on the relative ordering of middleware and `beforeFiles`, and gives `/health-check-<service>` the intra-segment prefix match no App Router pattern can express. Both AASA URLs now serve valid JSON, which incidentally fixes the malformed root copy on the old box (three missing commas). Superseded on the `/app/*` question — see the 2026-08-10 entry.
**Gotcha found in verification:** query strings do **not** survive `NextResponse.rewrite`, so the health service had to move into the rewrite's path (`/api/health-check/<service>`). With `?service=` every probe silently reported on the default service.
**Status:** Active

## 2026-08-06 — Bugs in the legacy endpoints are fixed, not reproduced
**Decision:** Four legacy defects are corrected in the port: `executeEmailVerify` hung the socket forever on a malformed token (never touching `res`) and now renders a failure page; `/invite/<code>` fired `createIPInviteLinkage` with an **empty** invite code before 404ing, and now fires nothing; `res.send()` followed by `res.sendStatus(200)` made every `/acceptReengagementPosts` and `/doNotPromote` request log `ERR_HTTP_HEADERS_SENT`; and legacy's `Access-Control-Allow-Origin: *` plus a hardcoded dev-Auth0-tenant ACAO header are not carried over.
**Why:** The empty-code linkage was writing junk rows into the attribution table, so preserving it would mean preserving data corruption. The rest are unambiguous defects with no dependent behaviour.
**Kept 404 on purpose:** `/invite/<code>`, `/invite2/`, `/invite3/`, `/invite-qr/` and `/user/*` all 404 in production today — their HTML was deleted from `static/` and survives only in a gitignored `static/trash/`. Parity was the call. `/invite-qr/` is the one worth revisiting, since printed QR codes point at it; restoring any of them is a page file plus dropping a `notFound()`, as the parsers already return the code.
**Status:** Active

## 2026-08-06 — Legal pages keep their legacy URLs and markup
**Decision:** The four `/info/*` documents are copied verbatim into `public/info/` and served at their original extensionless URLs via a `proxy.ts` rewrite. The footer's Privacy Policy and Terms of Service links, previously `href="#"`, now point at them.
**Why:** The App Store listing and the iOS app almost certainly link to these exact URLs, so they must not move; and the footer was advertising documents the site didn't serve. Preserving the markup means preserving the content exactly, at the cost of a look that doesn't match the design system.
**Known rough edges, inherited:** they are TextEdit exports with an empty `<title>`, and they swap stylesheets from a `?mode=` query rather than following the site theme. A redesign is a separate task.
**Status:** Active

## 2026-07-13 — Hashtag chips filter the videos page; requires backend hashtagId support
**Decision:** Hashtag chips on /videos are buttons: clicking one (on a card or in the player modal) refetches both video lists filtered to that tag via `getPublicVideosForSite(hashtagId:)`, shows a clear-pill next to the filter tabs, and clicking the selected chip (or the pill) toggles back to the unfiltered view. `/api/videos` gained `hashtagId` and `type=all` params. Fires a "Hashtag Selected" Mixpanel event.
**Why:** Tag-filtered browsing shipped in the backend (`hashtagId` param on the query). Chips were previously decorative placeholders.
**Deploy constraint:** The deployed API at tools01.murmurmd.com:4000 does not yet accept `hashtagId` (GRAPHQL_VALIDATION_FAILED, verified 2026-07-13) — every videos query now sends the param, so the site must not deploy before the backend does, or /videos shows its error state.
**Status:** Active

## 2026-07-13 — Social presence: X, YouTube, LinkedIn only
**Decision:** MurmurMD's official social accounts are X (https://x.com/Murmur_MD), YouTube (https://www.youtube.com/@MurmurMD), and LinkedIn (https://www.linkedin.com/company/murmur-md/). These are the only platforms linked from the site (`config/site.ts`, footer); Instagram/Facebook/TikTok placeholders were removed. Twitter-card metadata carries `@Murmur_MD` as site/creator handle.
**Why:** These are the accounts that actually exist — no accounts on the other platforms. Icon components for the pruned platforms stay in `components/logos/social.tsx` (unimported) in case accounts are added later.
**Status:** Active

## 2026-07-07 — Background knot animation capped at 15fps and CSS resolution
**Decision:** `BackgroundLines` throttles its rAF loop to ~15fps and renders the canvas at CSS pixels (DPR 1) instead of Retina (DPR ≤ 2).
**Why:** At full refresh rate + 2x DPR, the full-viewport canvas re-uploaded ~15M pixels per frame to the GPU; a dev tab left open pinned Firefox's GPU process at ~100% CPU and saturated macOS WindowServer, freezing Josh's machine. The knot rotates once per ~2.5 min, so 15fps is visually identical; the strokes sit at 6-8% alpha, so sub-Retina resolution is imperceptible.
**Alternatives considered:** Pausing on `visibilitychange` alone — insufficient, since the cost is incurred whenever the tab is visible, not just when hidden (browsers already suspend rAF in hidden tabs).
**Status:** Active

## 2026-07-06 — No env files in git
**Decision:** No `.env*` file is ever committed — not even `.env.example` (untracked same day). `.gitignore` blocks all `.env*` variants (previously only `.env*.local`). Every machine — dev or production — keeps its own `.env.local`; the required variables are documented in README.md ("Environment variables").
**Why:** Josh's call; env-specific committed files (`.env.production` etc.) invite secrets slipping into history.
**Status:** Active

## 2026-07-06 — Mixpanel for site analytics
**Decision:** Client-side Mixpanel via `mixpanel-browser`. `lib/analytics.ts` wraps init/track and no-ops entirely unless `NEXT_PUBLIC_MIXPANEL_TOKEN` is set (so dev/preview builds send nothing); `<Analytics />` in the root layout fires a pageview on load and on every App Router navigation (manual SPA tracking, `track_pageview: false` in init). First product event: "Video Opened" (post_id, title, kind, author, duration_ms) when a video card opens the player modal. Persistence is localStorage.
**Why:** Mixpanel chosen by Josh; token-gated no-op keeps analytics out of local dev without code branches.
**Status:** Active

## 2026-07-06 — Claude Design project: "MurmurMD website design system", with page-level previews
**Decision:** The design-sync bundle uploads to its own Claude Design project named "MurmurMD website design system" — separate from the existing "Murmur MD Design System" project, which covers the iOS app and stays untouched. The bundle now has a third group, Pages: one compact preview per public page (home, videos, physicians, partners, about, get-the-app) mirroring each page's real section order and copy, in light and dark. To keep page sources DRY, `scripts/build-design-sync.mjs` supports `<!-- @include name -->` partials from `design-sync/src/_partials/` (nav, footer, feature-tile grid, and one body partial per page); page-preview scaffolding CSS lives in `design-sync/_shared.css`.
**Why:** The website and the app are distinct design surfaces; mixing website tokens/components into the app's project would muddy both. Foundations and components alone didn't show how the site actually composes them — page previews capture that.
**Status:** Active

## 2026-07-03 — Data-fetching split: public pages server-fed, logged-in surfaces hit the API directly
**Decision:** Public content (videos, and anything else pre-login) is fetched server-side — static/ISR pages plus thin `/api/*` route handlers — keeping the GraphQL endpoint out of the browser and letting the cache absorb traffic. The future logged-in physician web experience will instead call the GraphQL API directly from the browser with the user's Auth0 token, exactly like the iOS app does; Josh confirmed there's no additional security concern since the API already serves authenticated clients.
**Status:** Active

## 2026-07-03 — Plum accents are the default
**Decision:** The plum theme-lab variant is promoted into the base palette: accents, links, and focus rings use plum `#8A1E5C` (tint `#F3E4ED`) in light mode and `#D98BB8`/`#3A1F31` in dark; deep plum `#6D1849`/`#B04A86` as the strong variant. The `--teal`/`--teal-deep` tokens were renamed `--accent-alt`/`--accent-alt-deep` since their values are no longer teal. The old teal look remains in the theme lab as the "Teal accents" variant for comparison; teal-forward was dropped.
**Why:** Josh compared the variants live via the theme lab and preferred plum with the pink brand.
**Status:** Active

## 2026-07-03 — One button style: the translucent "glow" variant
**Decision:** All marketing CTAs standardize on the translucent glass button (`glow` variant) — hero buttons, navbar "Get the App", partners CTAs, and the videos-page filter pills (active state). The glow variant was strengthened to stand out: full-strength glass background, more visible border (`border-border/80` light, `/35` dark), and a stronger primary tint in dark mode. The pink gradient `default` variant remains in the codebase but is no longer used for CTAs; the App Store badge is exempt (Apple-mandated artwork).
**Why:** Three competing button styles (gradient, translucent, pill fill) looked inconsistent; Josh picked the translucent one, made more solid.
**Status:** Active

## 2026-07-03 — Partner messaging: community support, not influence or visibility
**Decision:** Partner-facing copy is deliberately vague and community-first: "work together to help the community," supporting education, and understanding physician sentiment (concerns, preferences, unmet needs). Never say partners commission videos or polls, never frame reports as "seeing what doctors are discussing," and don't highlight that industry can observe the platform. Removed: the "Insights for industry" feature tile, commissioning/poll language on `/partners`, the home audiences card, and the FAQ; the Get-the-App button is gone from the partners page CTA (partners can't use the app). The physician-facing Polls tile stays but says "poll your colleagues," not "commission."
**Why:** Josh: partners pay for video production but have no say over content (and that's being phased out); MurmurMD is a somewhat private community — industry visibility is known but shouldn't be highlighted. Highlighting partner influence undermines physician trust.
**Status:** Active

## 2026-07-03 — Real /videos page on getPublicVideosForSite
**Decision:** `/videos` is now a real server-rendered page (grid + modal pattern from the videos2 prototype) fed by the `getPublicVideosForSite` GraphQL query — unauthenticated (Josh flipped it to `requiresUserData: false` in the Apollo server) with 5-minute ISR. Mapping conventions: video media element joined to post by `postId`; card title is `post.title`, falling back to the first line of `postText`; author joined via `creatorUserId`; `duration` is in **milliseconds**; preview prefers the CloudFront-resized `post.mediaPreviewUrl` over the raw S3 `mediaPreviewImageUrl`. Pagination cursors (`lastLongPostId`/`lastShortPostId`) are returned by the lib but load-more UI is not built yet. The `/videos1`/`/videos2` prototypes and mock catalog remain until a final look verdict, then get deleted.
**Status:** Active

## 2026-07-02 — Theme lab for visual experiments
**Decision:** Candidate looks are CSS-variable variant blocks in `styles/themes.css`, selected by `data-theme` on `<html>` via a dev-only floating picker (`components/ui/theme-lab.tsx`, localStorage-persisted, excluded from production). Backgrounds stay the paper/ink grays in every variant — Josh likes those — variants only change accent economy (primary buttons, links, rings, radius). Starter variants: teal-forward, plum accents, ink minimal. Winners get promoted into `:root`/`.dark` in `globals.css`; structural (layout-level) experiments still use branches/worktrees instead.
**Why:** Iterating by editing `globals.css` in place makes side-by-side comparison impossible and reverting error-prone.
**Status:** Active

## 2026-07-02 — GraphQL API calls: server-side, plain fetch, Auth0 bearer
**Decision:** The website calls the MurmurMD GraphQL API (Apollo server, endpoint in `MURMUR_API_SERVER` env var; localhost:4000/api in dev) from the server side, passing the signed-in user's Auth0 access token as a Bearer header. `lib/murmur-api.ts` uses plain `fetch` with typed wrappers per query — no Apollo Client dependency until the query surface justifies it. First consumer: `getProfile` on `/account`. Optional `AUTH0_AUDIENCE`/`AUTH0_SCOPE` env vars are wired for when the API requires audience-scoped JWTs.
**Status:** Active

## 2026-07-02 — Auth0 plumbing pulled forward
**Decision:** Auth0 wiring landed now rather than waiting for the post-launch physician-web phase: `@auth0/nextjs-auth0` v4, middleware-mounted routes under `/auth/*` (login, logout, callback, profile), `lib/auth0.ts` client, "Physician Login" in the navbar, and a session-gated `/account` page as the seed of the physician web experience. Credentials come from `.env.local` (gitignored; `.env.example` documents the shape). Placeholder tenant values until the real Regular-Web-Application client is configured — the login flow 500s on OIDC discovery until then, by design.
**Why:** Auth0 is the company's existing auth provider; wiring it while the codebase is small is cheaper than retrofitting.
**Status:** Active

## 2026-07-02 — No HIPAA/PHI messaging in site copy
**Decision:** Site copy does not mention HIPAA, PHI, or the no-patient-data rule. The no-PHI constraint remains true (and stays documented internally in the product brief) but it's a compliance boundary, not a selling point, and shouldn't set a security/legal tone on the marketing site. The FAQ privacy entry and the "No PHI, ever" feature tile were removed; the feature grid gained an "Insights for industry" tile instead.
**Why:** Josh: "While we don't accept HIPAA-affected information, it's not really a selling point — I was just telling you so we didn't go down the security path."
**Status:** Active

## 2026-07-02 — Landing page structure (v1)
**Decision:** Home page composition: Hero (no app mockup until screenshots exist) → feature grid (cases, outcomes, recommendations, polls, videos, verification, no-PHI, community) → "Two ways in" audience split (Physicians / Partners cards) → FAQ → Get-the-App CTA → footer. Launch UI's pricing, stats, and logos sections and brand SVGs were deleted (recoverable from git). The other tabs got real-copy starter pages (`/physicians`, `/partners`, `/get-the-app`, `/about`) to be expanded in Phase 3.
**Status:** Active

## 2026-07-02 — Light mode is the default theme
**Decision:** The site defaults to the light (paper/ink) palette; the template's forced-dark default was removed. Users can switch to dark or system via the footer toggle.
**Why:** The brand palette is light-first.
**Status:** Active

## 2026-07-02 — /videos aliases the grid prototype for now
**Decision:** Navigation links point at `/videos`, which re-exports the `/videos2` grid prototype until the videos1-vs-videos2 verdict. Nav never needs to change; only the alias does.
**Status:** Active

## 2026-07-02 — Logo file convention
**Decision:** Theme-aware wordmark: `public/web_logo_light.png` renders on light backgrounds, `public/web_logo_dark.png` (white wordmark) on dark, via the `MurmurMD` logo component. The two files are currently identical — the light variant awaits a dark-text version from branding.
**Status:** Active

## 2026-07-02 — Product & audience brief
**Decision:** The site is MurmurMD's public web presence. MurmurMD is a social/professional media app for iOS (web portions coming) where physicians — currently mostly interventional cardiologists, plus thoracic surgeons, EPs, radiologists — share cases, review outcomes, give recommendations, and commission polls. No HIPAA-sensitive data ("everything posted could legally go on Twitter"). The app is physicians-only; unverified users are directed to this site, which must serve the general public, prospective physician users, and industry partners (medical device & related) who commission videos, polls, and market-research reports.
**Status:** Active

## 2026-07-02 — Information architecture
**Decision:** Top-level tabs: Physicians, Partners, Get the App, Videos, About. Contact snippet in the footer (not a top-level page). Social links in the footer for all major platforms as placeholders (X, LinkedIn, Instagram, Facebook, YouTube, TikTok) — prune once real URLs arrive.
**Why:** Matches the three audiences; contact is lightweight for now.
**Status:** Active

## 2026-07-02 — Brand palette, teal accent
**Decision:** Palette: ink `#232A33` (headings/body), slate `#626D7C` (secondary text), gray `#B0BBBF` (borders), paper `#F4F6F7` (background), brand pink `#DE046C` (logo, primary CTA), teal `#119DA4` (accent/links) with deep teal `#0C7A80` for AA-contrast buttons. **Teal is the single accent; plum `#8A1E5C` is reserved and unused.**
**Alternatives considered:** Plum as accent — ruled out per "use one accent, not both"; teal chosen for contrast against the pink and a clinical/trustworthy read.
**Status:** Superseded by "Plum accents are the default" (2026-07-03) — after seeing both live in the theme lab, plum won.

## 2026-07-02 — Keep dark mode
**Decision:** Keep the template's light/dark toggle. The provided palette is the light theme; a dark variant will be derived from it (dark ink background, adjusted pink/teal).
**Alternatives considered:** Light-only launch — ruled out; both modes wanted.
**Status:** Active

## 2026-07-02 — Logo
**Decision:** Replace the Launch UI logo with `public/web_logo.png` (pink brain/speech-bubble with EKG "M", white wordmark).
**Why:** Official brand asset. Note: the white wordmark is invisible on light backgrounds — works for dark mode/footer; a dark-text variant (or glyph + styled text wordmark) is needed for light mode. Open item.
**Status:** Active

## 2026-07-02 — Video data & playback stack
**Decision:** Video metadata comes from MurmurMD's existing GraphQL API (Apollo client, though any GraphQL library would do), querying the publicly accessible videos. Playback is the company's existing pipeline: CMAF/HLS `.m3u8` streams from S3 (`murmurmd.postvideos`, us-west-2), poster frames via the CloudFront image resizer (`d3ngaae513epof.cloudfront.net`). In the browser, `hls.js` handles playback (Safari plays HLS natively; shared `VideoPlayer` component handles both). Long-form videos are landscape 16:9; shorts are portrait 9:16, and the UI renders each accordingly. Until the GraphQL wiring lands, pages build against `lib/videos.ts`, a mock catalog shaped like the API response.
**Update (same day):** CORS policy applied to the bucket (`AllowedOrigins: *`, GET/HEAD) and verified — cross-browser playback unblocked.
**Status:** Active

## 2026-07-02 — Two video-browsing prototypes to compare
**Decision:** Build two candidate Videos pages before committing to one: `/videos1` — a theater layout (large player up top) with Netflix-style scroll-snap carousel rows for Long-form and Shorts; `/videos2` — a filterable responsive grid (All / Long-form / Shorts) opening videos in a modal player. Whichever wins becomes `/videos`; the loser gets deleted.
**Status:** Active

## 2026-07-02 — Videos are self-hosted, built against a metadata list
**Decision:** The Videos section (long-form recordings + short-form cuts, all public-safe) will use self-hosted streaming, not YouTube/Vimeo embeds. Site builds against an in-repo video metadata list so hosting wiring can land later.
**Alternatives considered:** YouTube/Vimeo embeds — ruled out in favor of control over player/branding. Mux was floated as the hosting option.
**Status:** Superseded by "Video data & playback stack" (same day) — the company's existing S3/CloudFront HLS pipeline and GraphQL API replace the Mux idea; the metadata-list interim approach carries forward.

## 2026-07-02 — Marketing site first; Auth0 login in a later phase
**Decision:** Ship the public marketing/content site with no login. Physician login (Auth0 — the company's existing auth provider) and a gated web experience where physicians browse posts come in a post-launch phase.
**Alternatives considered:** Auth stub or full auth now — deferred for fastest path to a live site.
**Status:** Active

## 2026-07-02 — Strip Launch UI marketing content
**Decision:** Remove all Launch UI promotional copy, pricing/stats sections, and outbound launchui links (they're dead anyway); repurpose the section components as neutral building blocks.
**Status:** Active

## 2026-07-02 — Base the site on the Launch UI template
**Decision:** Start from a fresh install of Launch UI (basic/free tier) and customize it into the company site, rather than building from scratch.
**Why:** Gives us a polished landing-page foundation (hero, pricing, FAQ, CTA, stats, logos sections) with an established component system to extend.
**Status:** Active

## 2026-07-02 — Tech stack
**Decision:** Next.js 16 (App Router, Turbopack dev), React 19, TypeScript, Tailwind CSS v4, shadcn-style components on Radix UI primitives, `next-themes` for dark/light mode, Lucide icons.
**Why:** Comes with the Launch UI template; no reason to deviate. Site-wide config lives in `config/site.ts`; sections in `components/sections/`; primitives in `components/ui/`.
**Status:** Active

## 2026-07-02 — Keep a decision log
**Decision:** Track all significant decisions in this file (`DECISIONS.md`) as we build over the coming days.
**Why:** Multi-day build with iterative choices; we want to be able to refer back to what was decided and why.
**Status:** Active

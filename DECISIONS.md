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

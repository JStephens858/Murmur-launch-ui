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
**Status:** Active

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

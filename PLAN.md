# MurmurMD Website — Build Plan

The public web presence for MurmurMD: a social/professional media app (iOS, web portions coming)
where physicians share cases, review outcomes, give recommendations, and commission polls —
professional discussion only, never HIPAA-sensitive data. The site serves the general public
(including non-physicians redirected from the app's verification flow), prospective physician
users, and industry partners. See `DECISIONS.md` for the reasoning behind each choice here.

## Audiences & what they need

| Audience | Need |
|---|---|
| Physicians (mostly interventional cardiology; also CT surgery, EP, radiology) | Understand the app, see example content, download it |
| General public / unverified visitors | Browse what's allowed publicly — especially videos |
| Industry partners (medical device & related) | Commissioned videos, polls, market-research reports; how to engage us |

## Site map

- **Home** (`/`) — hero introducing MurmurMD, app callout, featured videos, paths to Physicians/Partners
- **Physicians** (`/physicians`) — app features: cases, outcomes, recommendations, polls; example content; physician-only verification story; get-the-app CTA
- **Partners** (`/partners`) — commissioned video production, polls, market-research reports; contact CTA (no public pricing)
- **Get the App** (`/get-the-app`) — App Store link, QR code, "physicians only — verification required" explainer, what unverified users can do here instead
- **Videos** (`/videos`) — browsable grid of long-form and short-form videos, filterable; individual watch pages
- **About** (`/about`) — company story, team, mission
- Footer on every page: contact snippet + social links (X, LinkedIn, Instagram, Facebook, YouTube, TikTok as placeholders until real URLs arrive)

## Phases

### Phase 1 — Rebrand the foundation
- Palette into `app/globals.css`: ink `#232A33`, slate `#626D7C`, gray `#B0BBBF`, paper `#F4F6F7`, brand pink `#DE046C`, teal accent `#119DA4` / deep teal `#0C7A80` for AA buttons. Plum reserved, unused.
- Derived dark-mode palette (dark ink background, adjusted pink/teal); keep the theme toggle.
- Logo swap to `public/web_logo.png` (white wordmark → dark mode / footer use). Need a dark-text variant for light mode, or glyph + styled text wordmark as fallback.
- Rewrite `config/site.ts`: MurmurMD name, description, URL, social links, contact email; drop Launch UI pricing/stats.
- Metadata, OG image, favicon from the brand.
- Strip all Launch UI marketing copy and dead outbound links.

### Phase 2 — Structure & navigation
- Create the six routes; shared layout.
- Navbar: logo + Physicians / Partners / Get the App / Videos / About + prominent "Get the App" CTA button.
- Footer: contact snippet, social icons, legal placeholders.
- Repurpose template sections (hero, items, FAQ, CTA, logos) into brand-neutral building blocks; delete pricing/stats or convert stats for "platform by the numbers" later.

### Phase 3 — Page content
- Home, Physicians, Partners, Get the App, About, each composed from the section library.
- App feature callouts with example post/case/poll mockups (screenshots from the app when available; styled placeholders until then).

### Phase 4 — Videos
- Video metadata from MurmurMD's existing GraphQL API (Apollo) — publicly accessible videos only. Interim: in-repo mock catalog (`lib/videos.ts`) shaped like the API response.
- Playback: existing CMAF/HLS pipeline (S3 `murmurmd.postvideos` streams, CloudFront poster frames) via the shared `hls.js`-based `VideoPlayer` component. Long-form = landscape 16:9, shorts = portrait 9:16.
- Two browsing prototypes under evaluation: `/videos1` (theater + carousel rows) and `/videos2` (filterable grid + modal player). Winner becomes `/videos` with `/videos/[slug]` watch pages.
- "Watch in the app" cross-link on each video.

### Phase 5 — Launch polish
- Responsive/accessibility pass (AA contrast — deep teal for teal buttons), SEO metadata per page, analytics, deploy (likely Vercel), domain.

### Phase 6 (post-launch) — Physician web experience
- ~~Auth0 login~~ — plumbing landed early (2026-07-02): middleware routes under `/auth/*`, gated `/account` page, navbar login link. Needs real tenant credentials in `.env.local`.
- Gated area where physicians browse posts and do some/most app actions on the web.
- Architecture note for earlier phases: keep components server-friendly and content data-driven so the gated app can share the design system.

## Open items (waiting on Josh)
- [ ] Dark-text logo variant for light backgrounds
- [ ] Real social media URLs (placeholders in the meantime; prune unused platforms)
- [ ] Contact email / preferred contact method for the footer
- [ ] App Store link
- [ ] App screenshots / example case & poll content
- [x] CORS policy on the S3 video bucket — applied and verified 2026-07-02
- [ ] GraphQL endpoint + schema/query for publicly accessible videos
- [ ] Verdict on /videos1 vs /videos2
- [ ] Auth0 credentials: tenant domain + Regular Web Application client ID/secret into `.env.local`; callback/logout URLs whitelisted in the dashboard
- [ ] Domain name for the site

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

## 2026-07-02 — Videos are self-hosted (Mux-style), built against a metadata list
**Decision:** The Videos section (long-form recordings + short-form cuts, all public-safe) will use self-hosted streaming (Mux or similar video API), not YouTube/Vimeo embeds. Site builds against an in-repo video metadata list so hosting wiring can land later.
**Alternatives considered:** YouTube/Vimeo embeds — ruled out in favor of control over player/branding.
**Status:** Active

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

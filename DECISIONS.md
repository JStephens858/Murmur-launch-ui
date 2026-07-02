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

---
name: verify
description: Build, run, and drive the Murmur website (Next.js) to verify changes at the browser surface.
---

# Verifying changes to the Murmur website

## Build / launch

- `npm run dev` serves on :3000 (Next 16, turbopack). Next 16 refuses a second
  dev server for the same project dir — kill the existing one first
  (`lsof -iTCP:3000 -sTCP:LISTEN`). Josh usually has one running; restart it
  when done.
- Backend endpoint comes from `MURMUR_API_SERVER` in `.env.local` (a GraphQL
  API, POST `{query, variables}`). Shell env overrides the file:
  `MURMUR_API_SERVER=http://localhost:4100/api npm run dev`.
- As of 2026-07-13 `.env.local` points at a **local backend
  (localhost:4000)** which often has an empty database; the deployed backend
  is `https://tools01.murmurmd.com:4000/api` (underscore-disabled line in
  `.env.local`). Zero videos on /videos usually means empty local DB, not a
  bug.

## Driving the UI

- No Playwright in the repo and the Chrome extension may be disconnected.
  What works: `npm i puppeteer-core` in the scratchpad and launch the
  installed Chrome at
  `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` with
  `headless: "new"`.
- For data-dependent flows (e.g. /videos), stand up a mock GraphQL backend:
  a plain node http server on :4100 answering `getPublicVideosForSite`
  (shape: `results{longVideoPostIds, shortVideoPostIds}` +
  `store{users, posts, hashtags, mediaElements}`) and point
  `MURMUR_API_SERVER` at it. SVG data-URIs work as `mediaPreviewUrl`
  thumbnails. See the query/typing in `lib/murmur-api.ts` for exact fields.

## Flows worth driving

- `/videos`: card grid, filter tabs (All/Long-form/Shorts), hashtag chip
  filtering (chips on cards and in the player modal, clear-pill next to the
  tabs), player modal, infinite scroll (only active in a single-type view;
  sentinel has `rootMargin: 600px`).
- `/api/videos?type=long|short|all&count=&cursor=&hashtagId=` is the
  client-side pagination endpoint — quick to probe with curl.

## Gotchas

- The dev server can wedge (all routes hang) — restart it rather than
  debugging curl.
- `getPublicVideos` fetch is cached 5 min only when `NODE_ENV === "production"`;
  dev always no-store.

/**
 * Renders the two social-share cards into public/:
 *
 *   og-default.png  — every page that doesn't say otherwise
 *   og-invite.png   — the /invite and /invite4 landing pages
 *
 * Run `npm run og-images` after changing the copy below, the logo, or the
 * brand colours; the PNGs are committed so the production build needs neither
 * this script nor network access. Inter is fetched from Google Fonts at run
 * time (the site loads it the same way via next/font), so this needs network.
 *
 * Uses Next's own ImageResponse (Satori + resvg) so the cards are drawn with
 * flexbox-style JSX-ish objects rather than a design tool. Imported by its
 * dist path because `next/og` isn't resolvable from a plain Node script.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ImageResponse } from "next/dist/server/og/image-response.js";
import React from "react";

import { siteConfig } from "../config/site.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const h = React.createElement;

const WIDTH = 1200;
const HEIGHT = 630;

// Dark theme tokens from app/globals.css. Dark reads better in the link
// previews Slack, X, and iMessage draw, and the pink glyph pops on it.
const BG = "#14181d";
const FG = "#edf1f3";
const MUTED = "#aab4bd";
const BRAND = "#f2559b";
const BRAND_DEEP = "#de046c";

const CARDS = {
  "og-default": {
    headline: "Built by physicians, powered by collaboration",
    body: siteConfig.description,
    footer: new URL(siteConfig.url).host,
  },
  "og-invite": {
    headline: "You're invited to MurmurMD",
    body: "A colleague has invited you to the physicians-only community where doctors share cases, compare outcomes, and learn from each other.",
    footer: "Accept your invitation and get the iOS app",
  },
};

async function fetchInter(weight) {
  // An older Firefox UA makes Google Fonts return a single WOFF file, which
  // Satori can read (it can't read WOFF2).
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:30.0) Gecko/20100101 Firefox/30.0",
      },
    },
  ).then((r) => r.text());
  const url = css.match(/src: url\((https:[^)]+)\)/)?.[1];
  if (!url) throw new Error(`No font URL in Google Fonts CSS for weight ${weight}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

function card({ headline, body, footer }, logoSrc) {
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: BG,
        color: FG,
        fontFamily: "Inter",
        position: "relative",
      },
    },
    // Soft brand glow, top right, so the card isn't a flat slab.
    h("div", {
      style: {
        position: "absolute",
        top: -260,
        right: -200,
        width: 760,
        height: 760,
        borderRadius: 9999,
        background: `radial-gradient(circle, ${BRAND_DEEP}55 0%, ${BRAND_DEEP}00 65%)`,
      },
    }),
    h("img", { src: logoSrc, width: 376, height: 85, style: { display: "flex" } }),
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000 } },
      h(
        "div",
        {
          style: {
            fontSize: 66,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -2,
          },
        },
        headline,
      ),
      h(
        "div",
        { style: { fontSize: 29, fontWeight: 400, lineHeight: 1.4, color: MUTED } },
        body,
      ),
    ),
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 18 } },
      h("div", { style: { width: 56, height: 6, borderRadius: 3, background: BRAND } }),
      h("div", { style: { fontSize: 26, fontWeight: 600, color: BRAND } }, footer),
    ),
  );
}

const [regular, semibold, bold, logo] = await Promise.all([
  fetchInter(400),
  fetchInter(600),
  fetchInter(700),
  readFile(path.join(root, "public/web_logo_dark.png")),
]);
const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

for (const [name, copy] of Object.entries(CARDS)) {
  const res = new ImageResponse(card(copy, logoSrc), {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "Inter", data: regular, weight: 400, style: "normal" },
      { name: "Inter", data: semibold, weight: 600, style: "normal" },
      { name: "Inter", data: bold, weight: 700, style: "normal" },
    ],
  });
  const out = path.join(root, "public", `${name}.png`);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log(`wrote ${path.relative(root, out)}`);
}

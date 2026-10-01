/**
 * Renders the site icons into public/ from the brain glyph in the wordmark:
 *
 *   favicon.png           256×256, the glyph alone on a transparent background
 *   apple-touch-icon.png  180×180, the glyph on white (iOS fills transparency
 *                         with black and rounds the corners itself)
 *
 * There is no vector of the glyph in the repo, so it's cropped out of the
 * 4700×1061 logo PNG: the glyph occupies the leftmost ~1150px. Run
 * `npm run icons` after replacing web_logo_light.png; the PNGs are committed.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ImageResponse } from "next/dist/server/og/image-response.js";
import React from "react";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const h = React.createElement;

const LOGO_W = 4700;
const LOGO_H = 1061;
const GLYPH_W = 1150; // glyph's width within the logo, at its left edge

const logo = await readFile(path.join(root, "public/web_logo_light.png"));
const src = `data:image/png;base64,${logo.toString("base64")}`;

/** The glyph scaled so its height is `size`, clipped to its own width. */
function glyph(size) {
  const scale = size / LOGO_H;
  return h(
    "div",
    {
      style: {
        display: "flex",
        width: Math.round(GLYPH_W * scale),
        height: size,
        overflow: "hidden",
      },
    },
    h("img", {
      src,
      width: Math.round(LOGO_W * scale),
      height: size,
      style: { display: "flex" },
    }),
  );
}

async function render(name, size, { background, glyphSize }) {
  const el = h(
    "div",
    {
      style: {
        display: "flex",
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        ...(background ? { background } : {}),
      },
    },
    glyph(glyphSize),
  );
  const res = new ImageResponse(el, { width: size, height: size });
  const out = path.join(root, "public", name);
  await writeFile(out, Buffer.from(await res.arrayBuffer()));
  console.log(`wrote ${path.relative(root, out)}`);
}

await render("favicon.png", 256, { glyphSize: 236 });
await render("apple-touch-icon.png", 180, { background: "#ffffff", glyphSize: 128 });

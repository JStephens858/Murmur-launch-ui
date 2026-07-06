/**
 * Builds the Claude Design preview bundle: wraps each fragment in
 * design-sync/src/ into a self-contained HTML file with the shared token
 * CSS inlined, writing to design-sync/dist/ (what DesignSync uploads).
 *
 * Fragment format: first line is the <!-- @dsCard ... --> marker (kept as
 * line 1 of the output — the Design System pane indexes it), rest is body
 * HTML. Optional extra <style> blocks in the fragment pass through.
 *
 * Run: node scripts/build-design-sync.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "design-sync", "src");
const distDir = join(root, "design-sync", "dist");
const shared = readFileSync(join(root, "design-sync", "_shared.css"), "utf8");

let count = 0;
for (const entry of readdirSync(srcDir, {
  recursive: true,
  withFileTypes: true,
})) {
  if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
  const rel = join(entry.parentPath.slice(srcDir.length + 1), entry.name);
  const fragment = readFileSync(join(srcDir, rel), "utf8");
  const newline = fragment.indexOf("\n");
  const marker = fragment.slice(0, newline).trim();
  if (!marker.startsWith("<!-- @dsCard")) {
    throw new Error(`${rel}: first line must be an @dsCard marker`);
  }
  const body = fragment.slice(newline + 1);
  const out = `${marker}
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
${shared}
</style>
</head>
<body>
${body}
</body>
</html>
`;
  const outPath = join(distDir, rel);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, out);
  count++;
}
console.log(`built ${count} previews -> design-sync/dist/`);

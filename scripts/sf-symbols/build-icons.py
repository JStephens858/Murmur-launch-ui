#!/usr/bin/env python3
"""Regenerates components/portal/icons.tsx.

Two sources, one output:
  * SF Symbols the iOS app uses for navigation, exported through
    export-symbols.swift (see the note there about the private API).
  * The app's own custom symbols (Murmur/Assets.xcassets/*.symbolset), which
    are SF Symbols template SVGs; the Regular-S layer is lifted straight out.

Every icon lands on the same 120x120 canvas, centred the way SF Symbols
centre themselves: horizontally on the glyph's bounds, vertically on the
midpoint of the cap height above the baseline. At 100pt every symbol shares a
70.5-unit cap height and the app's templates use the same unit, so the two
sources line up without any per-icon fudging.

usage: python3 scripts/sf-symbols/build-icons.py [--ios ../Murmur-ios-app]
Add a symbol by appending its name to app-symbols.txt and re-running.
Needs macOS with Xcode command-line tools (swiftc). Only the macOS host
matters; the Next app never runs this.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "components", "portal", "icons.tsx")

CANVAS = 120.0
CAP = 70.5  # SF Symbols cap height at 100pt, in alignment-rect units
# Wide glyphs (person.3 is 130+ units) are shrunk to leave this much canvas
# free, the way the app drops them to imageScale .small.
FIT_PAD = 8.0

# (component name, SF Symbol name, weight). Names mirror the symbol so the
# app's icon choice stays traceable: MenuView2.swift, HomeView.swift.
SF_SYMBOLS = [
    ("HouseIcon", "house", "regular"),
    ("HouseFillIcon", "house.fill", "regular"),
    ("GridIcon", "square.grid.2x2", "bold"),
    ("GridFillIcon", "square.grid.2x2.fill", "bold"),
    ("BellIcon", "bell", "regular"),
    ("BellFillIcon", "bell.fill", "regular"),
    ("EnvelopeIcon", "envelope", "regular"),
    ("EnvelopeFillIcon", "envelope.fill", "regular"),
    ("PersonCropRectangleIcon", "person.crop.rectangle", "regular"),
    ("PersonCropRectangleFillIcon", "person.crop.rectangle.fill", "regular"),
    ("EllipsisCircleIcon", "ellipsis.circle", "regular"),
    ("EllipsisCircleFillIcon", "ellipsis.circle.fill", "regular"),
    ("Person3Icon", "person.3", "regular"),
    ("Person3FillIcon", "person.3.fill", "regular"),
    ("FilmIcon", "film", "regular"),
    ("FilmFillIcon", "film.fill", "regular"),
    ("PlusIcon", "plus", "bold"),
    # Notification row badges: IconPicker.notificationType in NotificationsView.swift.
    ("BookmarkFillIcon", "bookmark.fill", "regular"),
    ("HeartFillIcon", "heart.fill", "regular"),
    ("FigureWaveIcon", "figure.wave", "regular"),
    ("GridBubbleFillIcon", "rectangle.3.offgrid.bubble.left.fill", "regular"),
    ("BubblesFillIcon", "bubble.left.and.bubble.right.fill", "regular"),
    ("AtIcon", "at", "regular"),
    ("PersonQuestionIcon", "person.fill.questionmark", "regular"),
    ("WarningTriangleIcon", "exclamationmark.triangle", "regular"),
    ("ThumbsUpFillIcon", "hand.thumbsup.fill", "regular"),
    ("QuestionMarkIcon", "questionmark", "regular"),
]

# Every other symbol the app references, one name per line, exported at
# regular weight with a component name derived from the symbol name
# ("text.badge.checkmark" -> TextBadgeCheckmarkIcon). Names the running
# macOS doesn't know are skipped and listed at the end.
APP_SYMBOLS_FILE = os.path.join(HERE, "app-symbols.txt")


def component_name(symbol):
    return "".join(part[:1].upper() + part[1:] for part in re.split(r"[.\-]", symbol)) + "Icon"


def extra_symbols():
    if not os.path.exists(APP_SYMBOLS_FILE):
        return []
    covered = {(name, weight) for _, name, weight in SF_SYMBOLS}
    taken = {comp for comp, _, _ in SF_SYMBOLS}
    out = []
    with open(APP_SYMBOLS_FILE) as f:
        for line in f:
            name = line.strip()
            if not name or name.startswith("#") or (name, "regular") in covered:
                continue
            comp = component_name(name)
            if comp in taken:
                continue
            taken.add(comp)
            out.append((comp, name, "regular"))
    return out


# (component name, symbolset name, scale). Layers are emitted in template
# order; `hierarchical-N:primary|secondary` classes decide the fill variable.
# The pulse is 1.5x because HomeView draws it at 30pt beside 20pt tab icons.
CUSTOM_SYMBOLS = [
    ("MurmurLogoComboIcon", "murmur_logo_combo", 1.0),
    ("MurmurPulseIcon", "murmur_pulse", 1.5),
]

NUM = r"-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?"


def fmt(v):
    s = f"{v:.2f}"
    s = s.rstrip("0").rstrip(".") if "." in s else s
    return "0" if s in ("-0", "") else s


def transform_path(d, sx, dx, dy):
    """Scale-then-translate absolute M/L/C/Z path data. Refuses anything else."""
    out = []
    for cmd, body in re.findall(r"([A-Za-z])([^A-Za-z]*)", d):
        if cmd not in "MLCZ":
            raise SystemExit(f"unsupported path command {cmd!r}")
        nums = [float(n) for n in re.findall(NUM, body)]
        if len(nums) % 2:
            raise SystemExit(f"odd coordinate count after {cmd}")
        pts = [
            f"{fmt(nums[i] * sx + dx)} {fmt(nums[i + 1] * sx + dy)}"
            for i in range(0, len(nums), 2)
        ]
        out.append(cmd + " ".join(pts))
    return "".join(out)


def fit(width):
    """Scale factor that keeps a glyph of this width inside the canvas."""
    return min(1.0, (CANVAS - FIT_PAD) / width)


def path_bounds(d):
    nums = [float(n) for n in re.findall(NUM, re.sub(r"[A-Za-z]", " ", d))]
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), min(ys), max(xs), max(ys)


def export_sf(tmp):
    src = os.path.join(HERE, "export-symbols.swift")
    exe = os.path.join(tmp, "export")
    subprocess.run(["swiftc", "-O", src, "-o", exe], check=True)
    wanted = SF_SYMBOLS + extra_symbols()
    specs = [f"{name}:{weight}" for _, name, weight in wanted]
    res = subprocess.run([exe, tmp, *specs], capture_output=True, text=True)
    if res.returncode != 0:
        sys.stderr.write(res.stdout + res.stderr)
        raise SystemExit("symbol export failed")
    missing = [l.split(" ", 1)[1] for l in res.stdout.splitlines() if l.startswith(("MISSING", "NOPATH"))]
    if missing:
        print("skipped (unknown to this macOS):", ", ".join(missing))
    icons = []
    for comp, name, weight in wanted:
        path = os.path.join(tmp, f"{name}-{weight}.json")
        if not os.path.exists(path):
            continue
        with open(path) as f:
            g = json.load(f)
        # Path units are 2x alignment units; bring everything to alignment units.
        s = 0.5 * fit(g["width"] * 0.5)
        w, h = g["width"] * s, g["height"] * s
        cap, base = g["capHeight"] * s, g["baseline"] * s
        centre_from_top = h - (base + cap / 2)
        d = transform_path(g["d"], s, CANVAS / 2 - w / 2, CANVAS / 2 - centre_from_top)
        icons.append((comp, f"SF Symbol `{name}` ({weight})", [("currentColor", d)]))
    return icons


def export_custom(ios_root):
    icons = []
    for comp, name, scale in CUSTOM_SYMBOLS:
        svg_path = os.path.join(
            ios_root, "Murmur", "Murmur", "Assets.xcassets", f"{name}.symbolset", f"{name}.svg"
        )
        with open(svg_path) as f:
            svg = f.read()
        m = re.search(r'<g id="Regular-S"[^>]*>(.*?)</g>', svg, re.S)
        if not m:
            raise SystemExit(f"{svg_path}: no Regular-S layer")
        layers = re.findall(r'<path([^>]*?)\sd="([^"]*)"', m.group(1), re.S)
        if not layers:
            raise SystemExit(f"{svg_path}: Regular-S has no paths")
        # Group coordinates: baseline at y=0, capline at y=-70.459 (template guides).
        x0, _, x1, _ = path_bounds(" ".join(d for _, d in layers))
        s = scale * fit((x1 - x0) * scale)
        dx = CANVAS / 2 - s * (x0 + x1) / 2
        dy = CANVAS / 2 + s * CAP / 2
        fills = []
        for attrs, d in layers:
            role = re.search(r"hierarchical-\d:(\w+)", attrs)
            if role and len(layers) > 1:
                var = f"var(--icon-{role.group(1)}, currentColor)"
            else:
                var = "currentColor"
            fills.append((var, transform_path(d, s, dx, dy)))
        icons.append((comp, f"app symbol `{name}` (Regular-S layer)", fills))
    return icons


def emit(icons):
    lines = [
        "// GENERATED by scripts/sf-symbols/build-icons.py — do not edit by hand.",
        "//",
        "// Navigation icons matching the iOS app. Each is an SF Symbol (or one of the",
        "// app's own symbols) placed on a shared 120x120 canvas, so any two render at",
        "// the same optical size when given the same width and height.",
        "//",
        "// Multi-layer symbols read their fills from CSS variables: --icon-primary and",
        "// --icon-secondary, each falling back to currentColor.",
        "",
        'import type { SVGProps } from "react";',
        "",
        "export type IconProps = SVGProps<SVGSVGElement>;",
        "",
        "function Icon({ children, ...props }: IconProps) {",
        "  return (",
        "    <svg",
        f'      viewBox="0 0 {fmt(CANVAS)} {fmt(CANVAS)}"',
        '      fill="currentColor"',
        '      aria-hidden="true"',
        '      focusable="false"',
        "      {...props}",
        "    >",
        "      {children}",
        "    </svg>",
        "  );",
        "}",
    ]
    for comp, source, layers in icons:
        lines += ["", f"/** {source} */", f"export function {comp}(props: IconProps) {{", "  return (", "    <Icon {...props}>"]
        for fill, d in layers:
            fill_attr = "" if fill == "currentColor" else f' fill="{fill}"'
            lines.append(f'      <path{fill_attr} d="{d}" />')
        lines += ["    </Icon>", "  );", "}"]
    lines.append("")
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ios", default=os.path.join(REPO, "..", "Murmur-ios-app"), help="path to the Murmur-ios-app checkout")
    args = ap.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        icons = export_sf(tmp) + export_custom(args.ios)
    with open(OUT, "w") as f:
        f.write(emit(icons))
    print(f"wrote {os.path.relpath(OUT, REPO)} ({len(icons)} icons)")


if __name__ == "__main__":
    main()

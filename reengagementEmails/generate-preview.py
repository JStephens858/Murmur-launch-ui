#!/usr/bin/env python3
"""Regenerate reengagementPreview.html.

    python3 reengagementEmails/generate-preview.py reengagementEmails/reengagementPreview.html [dark|light]

The template is 20 identical group blocks x 2 posts, so the HTML is a build
artifact: edit this file, never the HTML. Generating it is what keeps every
{{handlebars}} variable name identical across all 20 groups — the SendGrid
template breaks silently if one of the 361 names drifts.

Colours come from THEMES below, which mirrors :root and .dark in
app/globals.css. Email clients can't run `next-themes`, so a theme is baked in
at generate time rather than switched at read time; `dark` is what we ship.

Handlebars braces have to survive Python f-strings, so they are doubled up:
{{{{{v}image}}}} produces {{group1post1image}}, and six braces either side
produce the triple-brace {{{group1post1display}}} that SendGrid needs for the
unescaped display value.
"""

import sys

GROUPS = 20

# --- MurmurMD palette, keyed by role (app/globals.css) -----------------------
# Where the site expresses a colour as an alpha over another (dark card borders
# are border-border/15), the flattened result is precomputed — email clients
# have no equivalent of Tailwind's colour-mix.
THEMES = {
    "light": {
        "GROUND":      "#F4F6F7",  # --background
        "CARD":        "#FFFFFF",  # --card
        "LINE":        "#B0BBBF",  # --border, on card
        "RULE":        "#B0BBBF",  # --border, on the page ground
        "HEADING":     "#232A33",  # --foreground
        "BODY":        "#626D7C",  # --muted-foreground
        "PLACEHOLDER": "#E7EBED",  # --secondary, behind images that fail to load
        "PINK":        "#DE046C",  # --primary
        "PINK_TOP":    "#EB69A7",  # primary/60 over card — top of the gradient
        "ON_PINK":     "#FFFFFF",  # --primary-foreground
        "PINK_HOVER":  "#8A1E5C",  # --accent-alt
        "CHIP_BG":     "#F3E4ED",  # --accent
        "CHIP_TEXT":   "#8A1E5C",  # --accent-foreground
        "LINK":        "#8A1E5C",
        "BTN_BG":      "#FFFFFF",  # outline button — the site's `outline` variant
        "BTN_LINE":    "#B0BBBF",
        "BTN_TEXT":    "#232A33",
        "BTN_HOVER":   "#E7EBED",
        "RED_BG":      "#FCEBEC",  # destructive/30-ish over card
        "RED_LINE":    "#F1C4C7",
        "RED_TEXT":    "#C10007",  # --destructive, darkened for contrast on tint
        "RED_HOVER":   "#F8DADC",
        # Pink glyph, pink wordmark — the site's light-background lockup.
        "LOGO":        "https://murmurmd.com/web_logo_light.png",
    },
    "dark": {
        "GROUND":      "#14181D",  # --background
        "CARD":        "#1A2027",  # --card
        "LINE":        "#30373E",  # border-border/15 over --card
        "RULE":        "#2B3035",  # border-border/15 over --background
        "HEADING":     "#EDF1F3",  # --foreground
        "BODY":        "#9AA6B2",  # --muted-foreground
        "PLACEHOLDER": "#232A33",  # --secondary
        "PINK":        "#DE046C",  # --primary (unchanged in dark)
        "PINK_TOP":    "#DE046C",  # dark buttons run primary → primary/70,
        "PINK_BOTTOM": "#A30C57",  # i.e. full pink on top, not lightened
        "ON_PINK":     "#FFFFFF",  # --primary-foreground
        "PINK_HOVER":  "#B04A86",  # --accent-alt-deep
        "CHIP_BG":     "#3A1F31",  # --accent
        "CHIP_TEXT":   "#D98BB8",  # --accent-foreground
        "LINK":        "#D98BB8",
        "BTN_BG":      "#232A33",  # --secondary
        "BTN_LINE":    "#323B44",  # --input
        "BTN_TEXT":    "#EDF1F3",  # --secondary-foreground
        "BTN_HOVER":   "#2C353F",
        "RED_BG":      "#391D23",  # destructive/30 over --card
        "RED_LINE":    "#5A252B",
        "RED_TEXT":    "#FB2C36",  # --destructive-foreground
        "RED_HOVER":   "#47232A",
        # Pink glyph, white wordmark — the site's dark-background lockup.
        "LOGO":        "https://murmurmd.com/web_logo_dark.png",
    },
}

OUT = sys.argv[1]
THEME_NAME = sys.argv[2] if len(sys.argv) > 2 else "dark"
T = THEMES[THEME_NAME]

GROUND      = T["GROUND"]
CARD        = T["CARD"]
LINE        = T["LINE"]
RULE        = T["RULE"]
HEADING     = T["HEADING"]
BODY        = T["BODY"]
PLACEHOLDER = T["PLACEHOLDER"]
PINK        = T["PINK"]
PINK_TOP    = T["PINK_TOP"]
PINK_BOTTOM = T.get("PINK_BOTTOM", T["PINK"])
ON_PINK     = T["ON_PINK"]
PINK_HOVER  = T["PINK_HOVER"]
CHIP_BG     = T["CHIP_BG"]
CHIP_TEXT   = T["CHIP_TEXT"]
LINK        = T["LINK"]
BTN_BG      = T["BTN_BG"]
BTN_LINE    = T["BTN_LINE"]
BTN_TEXT    = T["BTN_TEXT"]
BTN_HOVER   = T["BTN_HOVER"]
RED_BG      = T["RED_BG"]
RED_LINE    = T["RED_LINE"]
RED_TEXT    = T["RED_TEXT"]
RED_HOVER   = T["RED_HOVER"]
LOGO        = T["LOGO"]

# public/web_logo_*.png are 4700x1061 (4.43:1). Serving the full-resolution
# file and displaying it at 190px is what keeps it sharp on retina; it is only
# ~30KB, so there is no separate @2x asset to keep in sync.
LOGO_W, LOGO_H = 190, 43

FONT = ("Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
        "Helvetica, Arial, sans-serif")

HEAD = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <!-- Generated by reengagementEmails/generate-preview.py. Edit that, not this. -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <!-- The design is already dark, so clients must not apply their own
         inversion on top of it. -->
    <meta name="color-scheme" content="{THEME_NAME}">
    <meta name="supported-color-schemes" content="{THEME_NAME}">
    <title>MurmurMD &mdash; reengagement post review</title>
    <!--[if mso]>
    <style>
        * {{ font-family: Helvetica, Arial, sans-serif !important; }}
    </style>
    <![endif]-->
    <style>
        /* Progressive enhancement only. Everything that matters is inlined,
           because Outlook and a few webmail clients drop this block. */
        :root {{
            color-scheme: {THEME_NAME};
            supported-color-schemes: {THEME_NAME};
        }}

        body {{
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
            -ms-text-size-adjust: 100%;
        }}

        table {{
            border-collapse: collapse;
        }}

        img {{
            border: 0;
            outline: none;
            -ms-interpolation-mode: bicubic;
        }}

        a {{
            text-decoration: none;
        }}

        .btn-view:hover {{
            background-color: {BTN_HOVER} !important;
        }}

        .btn-reject:hover {{
            background-color: {RED_HOVER} !important;
        }}

        .btn-accept:hover {{
            background-color: {PINK_HOVER} !important;
            background-image: none !important;
        }}

        @media only screen and (max-width: 620px) {{
            .container {{
                width: 100% !important;
            }}

            .gutter {{
                padding-left: 16px !important;
                padding-right: 16px !important;
            }}

            /* Post cards go one column: image over text, both full width. */
            .stack {{
                display: block !important;
                width: 100% !important;
                padding: 0 !important;
            }}

            .post-image {{
                width: 100% !important;
                height: 180px !important;
            }}

            .post-body {{
                padding-top: 16px !important;
            }}

            .btn {{
                display: block !important;
                width: auto !important;
                text-align: center !important;
            }}

            .btn-cell {{
                display: block !important;
                width: 100% !important;
                text-align: center !important;
                padding: 0 0 8px 0 !important;
            }}
        }}
    </style>
</head>
<body style="margin:0;padding:0;background-color:{GROUND};color:{HEADING};font-family:{FONT};">
    <!-- Inbox preview line; never rendered in the body. -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
        The most popular posts in each group, queued for the next reengagement email. Reject anything that shouldn&rsquo;t go out.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{GROUND}" style="width:100%;background-color:{GROUND};">
        <tr>
            <td align="center" style="padding:0;">
                <table role="presentation" class="container" width="680" cellpadding="0" cellspacing="0" border="0" style="width:680px;max-width:680px;">
"""


def accept_button(pad: str, size: str) -> str:
    """Primary CTA. Solid fill first so Outlook has something to paint, then the
    site's top-to-bottom primary gradient for clients that support it."""
    return f"""                            <a href="{{{{acceptAllPostsButtonUrl}}}}" class="btn-accept" style="display:inline-block;background-color:{PINK};background-image:linear-gradient(to bottom, {PINK_TOP}, {PINK_BOTTOM});color:{ON_PINK};font-family:{FONT};font-size:{size};font-weight:600;line-height:1;padding:{pad};border-radius:8px;text-decoration:none;">Accept all posts</a>"""


def post(g: int, p: int, last: bool) -> str:
    v = f"group{g}post{p}"
    # Cards sit 12px apart; the last one in a group gets the group's bottom gap.
    gap = "0" if last else "12px"
    return f"""
                                <!-- group {g} / post {p} -->
                                <div style="display: {{{{{{{v}display}}}}}};">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                                        <tr>
                                            <td style="padding:0 0 {gap} 0;">
                                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{CARD}" style="width:100%;background-color:{CARD};border:1px solid {LINE};border-radius:14px;">
                                                    <tr>
                                                        <td style="padding:20px 20px 0 20px;">
                                                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                                                                <tr>
                                                                    <td class="stack" width="150" style="width:150px;padding:0 20px 0 0;vertical-align:top;">
                                                                        <img class="post-image" src="{{{{{v}image}}}}" width="150" height="150" alt="" style="display:block;width:150px;height:150px;object-fit:cover;border-radius:10px;background-color:{PLACEHOLDER};">
                                                                    </td>
                                                                    <td class="stack post-body" style="vertical-align:top;">
                                                                        <div style="font-family:{FONT};font-size:17px;line-height:1.35;font-weight:600;letter-spacing:-0.01em;color:{HEADING};word-break:break-word;">{{{{{v}title}}}}</div>
                                                                        <div style="font-family:{FONT};font-size:15px;line-height:1.6;color:{BODY};padding-top:8px;word-break:break-word;">{{{{{v}text}}}}</div>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding:18px 20px 20px 20px;">
                                                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                                                                <tr>
                                                                    <td class="btn-cell" align="left" style="vertical-align:middle;">
                                                                        <a href="{{{{{v}viewButtonUrl}}}}" class="btn btn-view" style="display:inline-block;background-color:{BTN_BG};border:1px solid {BTN_LINE};color:{BTN_TEXT};font-family:{FONT};font-size:14px;font-weight:500;line-height:1;padding:11px 20px;border-radius:8px;text-decoration:none;">{{{{{v}viewButtonText}}}}</a>
                                                                    </td>
                                                                    <td class="btn-cell" align="right" style="vertical-align:middle;">
                                                                        <a href="{{{{{v}nukeButton}}}}" class="btn btn-reject" style="display:inline-block;background-color:{RED_BG};border:1px solid {RED_LINE};color:{RED_TEXT};font-family:{FONT};font-size:14px;font-weight:500;line-height:1;padding:11px 20px;border-radius:8px;text-decoration:none;">{{{{{v}nukeButtonText}}}}</a>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
"""


def group(g: int) -> str:
    return f"""
                    <!-- ===== group {g} ===== -->
                    <tr>
                        <td class="gutter" style="padding:0 24px;">
                            <div style="display: {{{{{{group{g}display}}}}}};">
                                <!-- group heading -->
                                <div style="padding:32px 2px 16px 2px;">
                                    <div>
                                        <span style="display:inline-block;background-color:{CHIP_BG};color:{CHIP_TEXT};font-family:{FONT};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;line-height:1;padding:6px 10px;border-radius:999px;">Group</span>
                                    </div>
                                    <div style="font-family:{FONT};font-size:20px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:{HEADING};padding-top:10px;word-break:break-word;">{{{{group{g}title}}}}</div>
                                </div>
{post(g, 1, last=False)}{post(g, 2, last=True)}                            </div>
                        </td>
                    </tr>
"""


MASTHEAD = f"""
                    <!-- Masthead -->
                    <tr>
                        <td class="gutter" align="center" style="padding:40px 24px 8px 24px;">
                            <img src="{LOGO}" width="{LOGO_W}" height="{LOGO_H}" alt="MurmurMD" style="display:block;width:{LOGO_W}px;height:{LOGO_H}px;">
                        </td>
                    </tr>
                    <tr>
                        <td class="gutter" align="center" style="padding:22px 24px 0 24px;">
                            <div style="font-family:{FONT};font-size:26px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;color:{HEADING};">
                                Reengagement picks for review
                            </div>
                            <div style="font-family:{FONT};font-size:15px;line-height:1.6;color:{BODY};padding-top:10px;max-width:460px;margin:0 auto;">
                                The most popular posts from each group, queued for the next reengagement email. Reject anything that shouldn&rsquo;t go out, then accept the rest.
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="gutter" align="center" style="padding:24px 24px 8px 24px;">
{accept_button(pad='14px 34px', size='16px')}
                        </td>
                    </tr>
                    <tr>
                        <td class="gutter" style="padding:28px 24px 0 24px;">
                            <div style="height:1px;line-height:1px;font-size:0;background-color:{RULE};">&nbsp;</div>
                        </td>
                    </tr>
"""

FOOT = f"""
                    <!-- Accept all, repeated at the end of the list -->
                    <tr>
                        <td class="gutter" align="center" style="padding:36px 24px 8px 24px;">
{accept_button(pad='14px 34px', size='16px')}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td class="gutter" style="padding:36px 24px 0 24px;">
                            <div style="height:1px;line-height:1px;font-size:0;background-color:{RULE};">&nbsp;</div>
                        </td>
                    </tr>
                    <tr>
                        <td class="gutter" align="center" style="padding:20px 24px 48px 24px;">
                            <div style="font-family:{FONT};font-size:13px;line-height:1.7;color:{BODY};">
                                <strong style="color:{HEADING};font-weight:600;">MurmurMD</strong> &middot; internal post review
                            </div>
                            <div style="font-family:{FONT};font-size:13px;line-height:1.7;color:{BODY};">
                                Questions? <a href="mailto:contact@murmurmd.com" style="color:{LINK};text-decoration:none;">contact@murmurmd.com</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""

html = HEAD + MASTHEAD + "".join(group(g) for g in range(1, GROUPS + 1)) + FOOT

open(OUT, "w").write(html)
print(f"wrote {OUT} ({THEME_NAME}, {len(html)} bytes)")

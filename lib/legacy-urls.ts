/**
 * URL parsers for the legacy endpoints ported from Murmur-express's
 * staticServer.js.
 *
 * These URLs are baked into already-sent emails and printed QR codes, so the
 * grammar cannot change. Legacy parsed them with hardcoded substring offsets,
 * and every parser below is a direct transcription of those offsets — the
 * arithmetic is spelled out in each comment so this file can be diffed against
 * staticServer.js line by line.
 *
 * Route params are deliberately NOT the source of these values: Next decodes
 * dynamic segments, legacy passed them to the API still percent-encoded.
 *
 * One deviation, applied throughout: legacy sliced `req.url`, which includes
 * the query string (so `/invite2/ABC?x=1` yielded the code `"ABC?x="`). These
 * take a pathname, so the query is already gone. Strictly better, and no
 * legitimate link relies on the old behaviour.
 */

/* ── Shape validators ─────────────────────────────────────────────────────
 * Legacy validated nothing and would happily send garbage to the API. These
 * only ever reject malformed URLs, so adding them changes no working link.
 */

/** `YYYY-MM-DD`, the shape the reengagement mailer emits. */
export function isIsoDate10(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** 36-char UUID — the width legacy's substring(14, 50) assumes for a postId. */
export function isUuid36(value: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    value,
  );
}

/** 10-char magic cookie — the width legacy's substring(51, 61) assumes. */
export function isTenChars(value: string): boolean {
  return /^[A-Za-z0-9]{10}$/.test(value);
}

/**
 * Invite code. Six or more characters, capped below ten.
 *
 * The backend generates them at seven (`generateInviteCode(7)` in
 * Murmur-apollo, charset BCDFGHJKLMNPQRSTVWXYZ) and accepts six or more on
 * redemption, so the six-wide slices in staticServer.js were never the real
 * width — see toLinkageCode below for the one place six still matters.
 */
export function isInviteCode(value: string): boolean {
  return /^[A-Za-z0-9]{6,9}$/.test(value);
}

/**
 * Trims an invite code to what createIPInviteLinkage will accept.
 *
 * That mutation rejects anything longer than six characters outright
 * (`if (reqData.inviteCode.length > 6) return ... "Who are you?"`), while codes
 * are seven characters long. Legacy only got away with this on the /invite4/,
 * /invite-qr/ and /appstore/ routes, whose substring(n, n+6) slices truncated
 * before the call; /invite/4/<code> passed the full code and its linkage has
 * therefore been failing silently in production for every generated code.
 *
 * Used for the linkage call ONLY. The code shown on the page and put in the
 * deep link is always the full one — a truncated code is not redeemable.
 */
export function toLinkageCode(inviteCode: string): string {
  return inviteCode.slice(0, 6);
}

/** Non-empty and free of the characters that mean the slice went wrong. */
function isPlausibleUsername(value: string): boolean {
  return value.length > 0 && !/[/?#]/.test(value);
}

/* ── /acceptReengagementPosts ─────────────────────────────────────────────── */

export interface AcceptReengagementArgs {
  dateStr: string;
  username: string;
}

/**
 * `/acceptReengagementPosts/<YYYY-MM-DD>/<username>`
 *
 * staticServer.js:522-524 — "/acceptReengagementPosts/".length === 25
 *   dateStr  = req.url.substring(25, 35)   // exactly 10 chars
 *   username = req.url.substring(36)       // index 35 is the "/" separator
 */
export function parseAcceptReengagement(
  pathname: string,
): AcceptReengagementArgs | null {
  const dateStr = pathname.substring(25, 35);
  const username = pathname.substring(36);
  if (pathname.charAt(35) !== "/") return null;
  if (!isIsoDate10(dateStr) || !isPlausibleUsername(username)) return null;
  return { dateStr, username };
}

/* ── /doNotPromote ────────────────────────────────────────────────────────── */

export interface DoNotPromoteArgs {
  postId: string;
  magicCookie: string;
  username: string;
}

/**
 * `/doNotPromote/<postId>/<magicCookie>/<username>`
 *
 * staticServer.js:530-532 — "/doNotPromote/".length === 14
 *   postId      = req.url.substring(14, 50)  // exactly 36 chars (UUID)
 *   magicCookie = req.url.substring(51, 61)  // exactly 10; index 50 is "/"
 *   username    = req.url.substring(62)      // index 61 is "/"
 */
export function parseDoNotPromote(pathname: string): DoNotPromoteArgs | null {
  const postId = pathname.substring(14, 50);
  const magicCookie = pathname.substring(51, 61);
  const username = pathname.substring(62);
  if (pathname.charAt(50) !== "/" || pathname.charAt(61) !== "/") return null;
  if (!isUuid36(postId)) return null;
  if (!isTenChars(magicCookie)) return null;
  if (!isPlausibleUsername(username)) return null;
  return { postId, magicCookie, username };
}

/* ── /emailVerification ───────────────────────────────────────────────────── */

export interface EmailVerificationToken {
  userId: string;
  emailId: string;
}

/**
 * `/emailVerification/<userId>_<emailId>`
 *
 * staticServer.js:177-183
 *   parts = req.url.split('/'); data = parts.pop() || parts.pop();
 *   dataParts = data.split('_');  // requires exactly 2 parts
 *
 * The `pop() || pop()` is legacy's trailing-slash tolerance. Returning null
 * here is what fixes the legacy hang: when the token was malformed,
 * executeEmailVerify fell through every branch and never touched `res`, so the
 * socket stayed open until the client timed out.
 */
export function parseEmailVerificationToken(
  pathname: string,
): EmailVerificationToken | null {
  const parts = pathname.split("/");
  const data = parts.pop() || parts.pop();
  if (!data) return null;
  const dataParts = data.split("_");
  if (dataParts.length !== 2) return null;
  const [userId, emailId] = dataParts;
  if (!userId || !emailId) return null;
  return { userId, emailId };
}

/* ── /invite/… ────────────────────────────────────────────────────────────── */

export interface InvitePath {
  /** The `N` in `/invite/N/<code>`; null for the 2-segment `/invite/<code>`. */
  variant: number | null;
  inviteCode: string;
}

/**
 * `/invite/<code>` or `/invite/<N>/<code>`
 *
 * staticServer.js:553-561
 *   parts = req.url.split("/")
 *   if (parts.length > 3) { inviteSuffix = parseInt(parts[2]);
 *                           inviteCode = parts[parts.length-1] }
 *   -> serves `/invite${inviteSuffix}.html`
 *
 * Two legacy bugs visible here, neither reproduced:
 *  - The 3-part form (`/invite/CODE`) never entered that block, so it fired
 *    createIPInviteLinkage with an EMPTY invite code and then 404'd on the
 *    missing invite.html. We return the real code and let the caller decide;
 *    no caller fires linkage for an unsupported variant.
 *  - `parseInt("x")` is NaN (it does not throw, so legacy's try/catch was
 *    dead), producing a request for `/inviteNaN.html`. Non-numeric suffixes
 *    come back as variant null here.
 */
export function parseInvitePath(pathname: string): InvitePath | null {
  const parts = pathname.split("/");
  if (parts.length > 3) {
    const suffix = Number.parseInt(parts[2], 10);
    const inviteCode = parts[parts.length - 1];
    if (!isInviteCode(inviteCode)) return null;
    return {
      variant: Number.isNaN(suffix) ? null : suffix,
      inviteCode,
    };
  }
  const inviteCode = parts[2] ?? "";
  if (!isInviteCode(inviteCode)) return null;
  return { variant: null, inviteCode };
}

/* ── /invite2, /invite3, /invite4, /invite-qr, /appstore ──────────────────── */

/** Prefix lengths, as counted in staticServer.js. */
export const PREFIX_LENGTH = {
  /** `/invite2/`, `/invite3/`, `/invite4/` — substring(9, 15) */
  inviteN: 9,
  /** `/invite-qr/` — substring(11, 17) */
  inviteQr: 11,
  /** `/appstore/` — substring(10, 16) */
  appstore: 10,
} as const;

/**
 * The single-prefix invite-code routes.
 *
 * Legacy sliced exactly six characters here (`substring(9, 15)` and friends),
 * which truncated every real seven-character code. That truncation is kept only
 * where it is actually required — the linkage call, via toLinkageCode — because
 * a truncated code is not redeemable and must never be what the page shows.
 * invite4.html got this right by accident: it re-derived the code in the browser
 * from window.location.pathname, so the visitor saw the full code while the
 * server recorded the six-character prefix.
 */
export function parseInviteCodeAfterPrefix(
  pathname: string,
  prefixLength: number,
): string | null {
  // Stop at the next slash so a trailing path segment can't bleed into the code.
  const code = pathname.substring(prefixLength).split("/")[0] ?? "";
  return isInviteCode(code) ? code : null;
}

/* ── /post/<postId or flat postId+magicCookie> ────────────────────────────── */

export interface PostRef {
  /** Canonical 36-character dashed UUID, whatever form the URL used. */
  postId: string;
  /** Magic cookie taken from the path, if the URL carried it there. */
  mc: string | null;
}

/** Longest a magicCookie can be: posts.magicCookie is varchar(30). Every one of
 *  the ~43.5k rows is exactly 10 alphanumeric characters, but the column governs. */
const MAX_MC_LENGTH = 30;

function dashifyUuid(hex32: string): string {
  return [
    hex32.slice(0, 8),
    hex32.slice(8, 12),
    hex32.slice(12, 16),
    hex32.slice(16, 20),
    hex32.slice(20),
  ].join("-");
}

/** The id may arrive canonical (36, dashed) or flattened (32 hex, no dashes). */
function normalisePostId(value: string): string | null {
  if (isUuid36(value)) return value;
  if (/^[0-9a-fA-F]{32}$/.test(value)) return dashifyUuid(value);
  return null;
}

/**
 * Parses the path segments after `/post/`.
 *
 * Four shapes are in the wild, all confirmed working on the live site:
 *   /post/fa52c8f0-d3ba-4b32-8c54-62bf2d7426a4?mc=2ZLpu89URs   dashed + query
 *   /post/fa52c8f0-d3ba-4b32-8c54-62bf2d7426a4/2ZLpu89URs      dashed + cookie segment
 *   /post/fa52c8f0d3ba4b328c5462bf2d7426a4/2ZLpu89URs          flat + cookie segment
 *   /post/fa52c8f0d3ba4b328c5462bf2d7426a4                     flat, no cookie
 *
 * The flat id is what the app produces. Note the backend can't take it directly:
 * murmur-uuid-buffer throws on anything that isn't exactly 36 characters with
 * dashes, so the dashes have to be put back before the query — which is why the
 * id is normalised here rather than passed through.
 *
 * Mis-parsing is safe by construction: the backend compares the cookie for
 * equality, so a wrong cookie degrades to the excerpt-only "og" response rather
 * than granting anything, and an unparseable id fails the query outright.
 */
export function parsePostRef(segments: string[]): PostRef | null {
  if (segments.length === 0 || segments.length > 2) return null;

  const postId = normalisePostId(segments[0]);
  if (!postId) return null;

  const cookie = segments[1];
  if (cookie === undefined) return { postId, mc: null };

  // Reject junk in the cookie position rather than ignoring it, so a mangled link
  // 404s instead of rendering a teaser that looks like the cookie merely failed
  // to match.
  if (
    cookie.length === 0 ||
    cookie.length > MAX_MC_LENGTH ||
    !/^[A-Za-z0-9]+$/.test(cookie)
  ) {
    return null;
  }
  return { postId, mc: cookie };
}

/* ── /health-check ────────────────────────────────────────────────────────── */

/**
 * `/health-check` -> "api1"; `/health-check-<service>` -> "<service>".
 *
 * staticServer.js:591-594
 *   var service = req.url.split('-')[2];
 *   if (!service) service = 'api1';
 *
 * Quirks preserved verbatim, because monitoring may depend on them:
 *  - `/health-check-api-2` yields "api" (the split takes only one piece).
 *  - `/health-checkfoo` yields "api1" (legacy matched with startsWith).
 */
export function parseHealthCheckService(pathname: string): string {
  return pathname.split("-")[2] || "api1";
}

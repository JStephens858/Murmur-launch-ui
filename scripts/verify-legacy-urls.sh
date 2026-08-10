#!/usr/bin/env bash
#
# URL compatibility check for the endpoints ported from Murmur-express.
#
# These URLs are baked into already-sent emails and printed QR codes, so this
# asserts both the HTTP response AND the exact GraphQL variables each endpoint
# sends, using a recording stub in place of the real API.
#
# The negative assertions are the important half: they prove a HEAD probe, a
# link scanner or a prefetch does not fire a state-changing mutation.
#
# Usage: BASE=http://localhost:3000 CALLS=/path/to/calls.jsonl scripts/verify-legacy-urls.sh

set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
CALLS="${CALLS:-./calls.jsonl}"

# A browser-ish agent: lib/legacy-guard.ts treats curl's default UA as automated,
# which is correct behaviour but would skip every mutation under test.
UA_BROWSER="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

POST_ID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"   # 36 chars
COOKIE="0123456789"                              # 10 chars

# Token values the server under test was started with, so the auth assertions
# can't drift from however you launched it.
EXPECT_SERVICE_TOKEN="${EXPECT_SERVICE_TOKEN:-test-service-token}"
EXPECT_HEALTH_TOKEN="${EXPECT_HEALTH_TOKEN:-test-healthcheck-token}"

# lib/legacy-guard.ts dedupes a repeated pathname for ten minutes, so a second
# run inside that window would suppress the very mutations under test — and,
# worse, would make the negative assertions pass for the wrong reason. Vary the
# username so every run uses paths the server has not seen.
RUN="r$(date +%s)"
USER_OK="joshuas$RUN"

pass=0; fail=0

# Wait for the server before asserting anything. Without this a slow `next start`
# shows up as a wall of "want 200, got 000" failures that look like real bugs.
ready=""
for _ in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$BASE/web-health.html")" = "200" ]; then
    ready=yes
    break
  fi
  sleep 1
done
if [ -z "$ready" ]; then
  printf '\033[31mServer at %s never became ready (60s).\033[0m\n' "$BASE"
  exit 1
fi

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n     %s\n' "$1" "$2"; fail=$((fail+1)); }

calls_count() { [ -f "$CALLS" ] && wc -l < "$CALLS" | tr -d ' ' || echo 0; }
last_call()   { [ -f "$CALLS" ] && tail -1 "$CALLS" || echo '{}'; }

# status <name> <expected-code> <path> [curl args...]
status() {
  local name="$1" want="$2" path="$3"; shift 3
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA_BROWSER" "$@" "$BASE$path")
  [ "$got" = "$want" ] && ok "$name ($got)" || bad "$name" "want $want, got $got — $path"
}

# no_mutation <name> <path> [curl args...] — asserts the request records nothing
no_mutation() {
  local name="$1" path="$2"; shift 2
  local before after
  before=$(calls_count)
  curl -s -o /dev/null -A "$UA_BROWSER" "$@" "$BASE$path"
  sleep 0.6   # let any after() callback land
  after=$(calls_count)
  [ "$before" = "$after" ] \
    && ok "$name fires no mutation" \
    || bad "$name" "recorded $((after-before)) call(s) it should not have"
}

# recorded <name> <jq-filter> <expected> — checks the most recent stub call
recorded() {
  local name="$1" filter="$2" want="$3" got
  got=$(last_call | jq -r "$filter" 2>/dev/null)
  [ "$got" = "$want" ] && ok "$name" || bad "$name" "want '$want', got '$got'"
}

echo
echo "── Infrastructure ─────────────────────────────────────────────"
status "/web-health.html"        200 "/web-health.html"
body=$(curl -s "$BASE/web-health.html")
[ "$body" = "<HTML><BODY>OK</BODY></HTML>" ] \
  && ok "/web-health.html body byte-identical to legacy" \
  || bad "/web-health.html body" "got '$body'"

status "/health-check"           200 "/health-check"
recorded "/health-check service defaults to api1" '.variables.service' 'api1'
status "/health-check-api2"      200 "/health-check-api2"
recorded "/health-check-api2 passes service" '.variables.service' 'api2'

status "/sendgrid-webhook GET"   200 "/sendgrid-webhook"
status "/sendgrid-webhook POST"  200 "/sendgrid-webhook" -X POST -d '{"a":1}'

echo
echo "── Apple App Site Association ─────────────────────────────────"
aasa_headers=$(curl -sI "$BASE/.well-known/apple-app-site-association")
echo "$aasa_headers" | grep -qi '^HTTP/[0-9.]* 200' \
  && ok "AASA .well-known returns 200" \
  || bad "AASA .well-known status" "$(echo "$aasa_headers" | head -1)"
echo "$aasa_headers" | grep -qi 'content-type: *application/json' \
  && ok "AASA content-type is application/json" \
  || bad "AASA content-type" "$(echo "$aasa_headers" | grep -i content-type)"
echo "$aasa_headers" | grep -qi '^location:' \
  && bad "AASA must not redirect" "found a Location header" \
  || ok "AASA serves directly, no redirect"
curl -s "$BASE/apple-app-site-association" | jq empty 2>/dev/null \
  && ok "AASA root copy is valid JSON (legacy's was malformed)" \
  || bad "AASA root copy" "not valid JSON"

# Pin the declaration exactly. Both values were reconciled against what
# production actually serves, not against Murmur-express's checked-in file — the
# deployed copy was hand-edited and never committed.
EXPECT_PATHS='["/invite/*","/post/*","/user/*","/app/*"]'
EXPECT_CREDS='["6L582Z5SW6.com.murmurmd.murmur","6L582Z5SW6.com.murmurmd.murmur-dev"]'
SERVED_AASA=$(curl -s "$BASE/.well-known/apple-app-site-association")
got=$(echo "$SERVED_AASA" | jq -c '.applinks.details[0].paths' 2>/dev/null)
[ "$got" = "$EXPECT_PATHS" ] \
  && ok "AASA declares the expected applinks paths" \
  || bad "AASA applinks paths" "want $EXPECT_PATHS, got $got"
got=$(echo "$SERVED_AASA" | jq -c '.webcredentials.apps' 2>/dev/null)
[ "$got" = "$EXPECT_CREDS" ] \
  && ok "AASA declares both webcredentials apps (incl. -dev)" \
  || bad "AASA webcredentials" "want $EXPECT_CREDS, got $got"
# components must stay in lockstep with paths, or iOS honours one and not the other.
got=$(echo "$SERVED_AASA" | jq -c '[.applinks.details[0].components[]["/"]]' 2>/dev/null)
[ "$got" = "$EXPECT_PATHS" ] \
  && ok "AASA components mirror paths" \
  || bad "AASA components" "want $EXPECT_PATHS, got $got"

# Diff against what Apple serves today, reported for awareness rather than as a
# failure: /app/* is a deliberate addition that production has never had (its
# only occurrence there is in a malformed file Apple does not read).
LIVE_AASA=$(curl -s --max-time 10 \
  "https://app-site-association.cdn-apple.com/a/v1/murmurmd.com" 2>/dev/null)
if [ -n "$LIVE_AASA" ] && echo "$LIVE_AASA" | jq empty 2>/dev/null; then
  live_paths=$(echo "$LIVE_AASA" | jq -c '.applinks.details[0].paths')
  if [ "$live_paths" = "$EXPECT_PATHS" ]; then
    ok "live production already declares the same paths"
  else
    printf '  \033[33m-\033[0m %s\n' \
      "note: live production declares $live_paths — deploying changes it to $EXPECT_PATHS"
  fi
else
  printf '  \033[33m-\033[0m %s\n' "live AASA comparison skipped (Apple CDN unreachable)"
fi

echo
echo "── Legal pages (extensionless legacy URLs) ────────────────────"
for slug in privacy_policy terms_of_service community_guidelines content_policy; do
  status "/info/$slug" 200 "/info/$slug"
done
ct=$(curl -sI "$BASE/info/info_dark.css" | grep -i '^content-type' | tr -d '\r')
echo "$ct" | grep -qi 'text/css' \
  && ok "/info/info_dark.css served as CSS (dot passthrough works)" \
  || bad "/info/info_dark.css content-type" "$ct"

echo
echo "── Invite family ──────────────────────────────────────────────"
status "/invite/4/BCDFGHJ"  200 "/invite/4/BCDFGHJ"
recorded "  linkage invite code" '.variables.inviteCode' 'BCDFGH'
recorded "  linkage viewOrClick"  '.variables.viewOrClick' 'view'
recorded "  linkage sends Bearer token" '.authorization' "Bearer $EXPECT_SERVICE_TOKEN"

status "/invite4/BCDFGHK"   200 "/invite4/BCDFGHK"
recorded "  /invite4 linkage code" '.variables.inviteCode' 'BCDFGH'

# The code shown to the visitor must be the FULL one — codes are seven
# characters and a truncated code is not redeemable. Legacy's six-wide slice got
# this right only by accident, by re-deriving the code in the browser.
for u in /invite/4/BCDFGHJ /invite4/BCDFGHK; do
  shown=$(curl -s -A "$UA_BROWSER" "$BASE$u" | grep -oE 'BCDFGH[A-Z]' | head -1)
  want="${u##*/}"
  [ "$shown" = "$want" ] \
    && ok "$u displays the full code ($shown)" \
    || bad "$u displayed code" "want '$want', got '$shown'"
done

# 302 to the store, with ct=invite preserved
loc=$(curl -s -o /dev/null -w '%{redirect_url}' -A "$UA_BROWSER" "$BASE/appstore/BCDFGHL")
code=$(curl -s -o /dev/null -w '%{http_code}' -A "$UA_BROWSER" "$BASE/appstore/BCDFGHL")
[ "$code" = "302" ] && ok "/appstore/<code> returns 302 ($code)" \
                    || bad "/appstore status" "want 302, got $code"
case "$loc" in
  *apps.apple.com*ct=invite*) ok "/appstore redirects to store with ct=invite" ;;
  *) bad "/appstore redirect target" "$loc" ;;
esac
sleep 0.6
recorded "  /appstore linkage viewOrClick" '.variables.viewOrClick' 'click'

echo
echo "── Currently-404 paths stay 404, and stay silent ──────────────"
status "/invite/ABC123 (2-segment)" 404 "/invite/ABC123"
no_mutation "/invite/ABC123 (legacy wrote an EMPTY code here)" "/invite/ABC123"
status "/invite/2/ABC123" 404 "/invite/2/ABC123"
status "/invite2/ABC123"  404 "/invite2/ABC123"
status "/invite3/ABC123"  404 "/invite3/ABC123"
status "/invite-qr/ABC123" 404 "/invite-qr/ABC123"
status "/user/someone"    404 "/user/someone"

echo
echo "── Email verification ─────────────────────────────────────────"
status "/emailVerification/u123_e456" 200 "/emailVerification/u123_e456"
recorded "  userId"  '.variables.userId'  'u123'
recorded "  emailId" '.variables.emailId' 'e456'
recorded "  uses the health-check identity" '.authorization' "Bearer $EXPECT_HEALTH_TOKEN"
# Legacy tolerated the trailing slash inline (parts.pop() || parts.pop()); Next
# 308s to the canonical URL instead, which lands in the same place.
status "/emailVerification/u123_e456/ (trailing slash, via 308)" 200 \
  "/emailVerification/u123_e456/" -L
recorded "  trailing-slash form still verifies" '.variables.emailId' 'e456'
# Legacy hung the socket forever on this one.
status "/emailVerification/garbage (legacy: hung)" 200 "/emailVerification/garbage"
no_mutation "/emailVerification/garbage" "/emailVerification/garbage"

echo
echo "── Action endpoints ───────────────────────────────────────────"
status "/acceptReengagementPosts/2026-08-06/<user>" 200 "/acceptReengagementPosts/2026-08-06/$USER_OK"
recorded "  dateStr"  '.variables.dateStr'  '2026-08-06'
recorded "  username" '.variables.username' "$USER_OK"

status "/doNotPromote/<id>/<mc>/<user>" 200 "/doNotPromote/$POST_ID/$COOKIE/$USER_OK"
recorded "  postId"      '.variables.postId'      "$POST_ID"
recorded "  magicCookie" '.variables.magicCookie' "$COOKIE"
recorded "  username"    '.variables.username'    "$USER_OK"
recorded "  flag"        '.variables.flag'        'doNotPromote'

status "/doNotPromote malformed" 200 "/doNotPromote/short/$COOKIE/$USER_OK"
no_mutation "/doNotPromote malformed" "/doNotPromote/short/$COOKIE/$USER_OK"

echo
echo "── Public post page ───────────────────────────────────────────"
POST=11111111-2222-3333-4444-555555555555
GOOD_MC=GOODMCOOK1
status "/post/<id>?mc=<valid>  (full)" 200 "/post/$POST?mc=$GOOD_MC"
status "/post/<id>             (og)"   200 "/post/$POST"
status "/post/<id>?mc=wrong    (og)"   200 "/post/$POST?mc=wrongcooki"
status "/post/<all-zero id>    (none)" 404 "/post/00000000-0000-0000-0000-000000000000"
status "/post (no id) redirects home"  307 "/post"

full=$(curl -s -A "$UA_BROWSER" "$BASE/post/$POST?mc=$GOOD_MC")
og=$(curl -s -A "$UA_BROWSER" "$BASE/post/$POST")

# The gated view renders media and the creator's name; the excerpt view must not.
grep -q '<video' <<<"$full" \
  && ok "  full view renders post media" \
  || bad "  full view media" "no <video> element"
grep -q '<video' <<<"$og" \
  && bad "  og view must not render media" "found a <video> element" \
  || ok "  og view renders no media"
grep -q 'Stub Doctor' <<<"$full" \
  && ok "  full view shows the creator's name" \
  || bad "  full view creator" "display name missing"
grep -q 'This is a preview' <<<"$og" \
  && ok "  og view is framed as a preview" \
  || bad "  og view CTA" "preview copy missing"
# The og shape's createdDate is the current time, not the post's, so no date.
grep -qE 'Jan 1, 1970|Dec 31, 1969' <<<"$og" \
  && bad "  og view must not print a date" "a date was rendered" \
  || ok "  og view prints no date"

# The app's form: dashes stripped from the uuid, cookie as a SECOND path segment.
# Confirmed working on the live site, so it has to keep working here. The backend
# cannot take the flat id directly — murmur-uuid-buffer throws on anything that
# isn't 36 chars with dashes — so this also proves the id is being re-dashed.
FLATPOST=$(echo "$POST" | tr -d '-')
status "/post/<flat>/<cookie>  (full)" 200 "/post/$FLATPOST/$GOOD_MC"
status "/post/<dashed>/<cookie>(full)" 200 "/post/$POST/$GOOD_MC"
status "/post/<flat>           (og)"   200 "/post/$FLATPOST"
status "/post/<flat>/junk!     (404)"  404 "/post/$FLATPOST/junk%21"
status "/post/<flat>/<c>/extra (404)"  404 "/post/$FLATPOST/$GOOD_MC/extra"

flat=$(curl -s -A "$UA_BROWSER" "$BASE/post/$FLATPOST/$GOOD_MC")
grep -q '<video' <<<"$flat" \
  && ok "  flat id + cookie segment renders the full post" \
  || bad "  flat form" "no <video> element — id or cookie not applied"
flaturl=$(grep -oE '<meta property="og:url" content="[^"]*"' <<<"$flat" | sed -E 's/.*content="([^"]*)".*/\1/')
if [ "${flaturl##*/post/}" = "$POST" ]; then
  ok "  flat form canonicalises og:url to the dashed id"
else
  bad "  flat form og:url" "want it to end in /post/$POST, got '$flaturl'"
fi
case "$flaturl" in
  *"$GOOD_MC"*) bad "  flat form og:url leaks the cookie" "$flaturl" ;;
  *) ok "  flat form og:url carries no cookie" ;;
esac
# The cookie may appear in Next's router payload (a script in the body, sent only
# to the client that already supplied it) but must never reach the document head,
# which is what crawlers republish.
head_html=$(sed -e 's|</head>|\n@@HEADEND@@\n|' <<<"$flat" | sed -n '1,/@@HEADEND@@/p')
grep -q "$GOOD_MC" <<<"$head_html" \
  && bad "  cookie present in <head>" "would be republished by crawlers" \
  || ok "  cookie absent from <head>"

# The magic cookie must never travel in shared metadata.
ogurl=$(grep -oE '<meta property="og:url" content="[^"]*"' <<<"$full" | sed -E 's/.*content="([^"]*)".*/\1/')
case "$ogurl" in
  *"$GOOD_MC"*) bad "  og:url leaks the magic cookie" "$ogurl" ;;
  *"/post/$POST") ok "  og:url is the bare post path, no cookie" ;;
  *) bad "  og:url" "unexpected value '$ogurl'" ;;
esac
# Legacy used the same 100-char truncation for both; previews already cached
# elsewhere depend on it.
ogtitle=$(grep -oE '<meta property="og:title" content="[^"]*"' <<<"$full" | sed -E 's/.*content="([^"]*)".*/\1/')
[ "${#ogtitle}" = 103 ] \
  && ok "  og:title is truncated to 100 chars + ellipsis" \
  || bad "  og:title length" "want 103, got ${#ogtitle} ('$ogtitle')"
grep -q 'name="robots" content="noindex' <<<"$full" \
  && ok "  gated post is noindex" \
  || bad "  post robots tag" "noindex missing"
# robots.txt must NOT block /post, or link-preview crawlers can't fetch it.
curl -s "$BASE/robots.txt" | grep -qE '^Disallow: /post' \
  && bad "  robots.txt blocks /post" "would break link previews" \
  || ok "  robots.txt leaves /post crawlable (previews need it)"

echo
echo "── Negative assertions (the traps) ────────────────────────────"
# Next implements HEAD by calling the GET handler; proxy.ts is what stops it.
no_mutation "HEAD /doNotPromote"  "/doNotPromote/$POST_ID/$COOKIE/headtest$RUN" -I
no_mutation "POST /doNotPromote"  "/doNotPromote/$POST_ID/$COOKIE/posttest$RUN" -X POST
no_mutation "HEAD /acceptReengagementPosts" "/acceptReengagementPosts/2026-08-07/headtest$RUN" -I
no_mutation "HEAD /appstore"      "/appstore/HEADAB" -I
no_mutation "prefetch /doNotPromote" "/doNotPromote/$POST_ID/$COOKIE/prefetchtest$RUN" \
  -H 'Sec-Purpose: prefetch;prerender'
no_mutation "Slackbot /doNotPromote" "/doNotPromote/$POST_ID/$COOKIE/bottest$RUN" \
  -A 'Slackbot-LinkExpanding 1.0'
no_mutation "Outlook scanner /doNotPromote" "/doNotPromote/$POST_ID/$COOKIE/scantest$RUN" \
  -A 'Mozilla/5.0 (compatible; Microsoft Outlook 16.0)'

# Replay: the first hit mutates, the identical second must not.
REPLAY="/doNotPromote/$POST_ID/$COOKIE/replaytest$RUN"
curl -s -o /dev/null -A "$UA_BROWSER" "$BASE$REPLAY"; sleep 0.4
no_mutation "replay of the same URL within the TTL" "$REPLAY"

echo
echo "───────────────────────────────────────────────────────────────"
printf 'passed %d, failed %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1

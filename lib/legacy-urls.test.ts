/**
 * Table-driven tests for the legacy URL parsers.
 *
 * Expected values are computed by hand from the substring offsets in
 * Murmur-express/staticServer.js, not from this repo's implementation — the
 * point is to catch a transcription error, so deriving the expectations from
 * the code under test would defeat it.
 *
 * Run with: npm test  (node --test, no test framework dependency)
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseAcceptReengagement,
  parseDoNotPromote,
  parseEmailVerificationToken,
  parseHealthCheckService,
  parseInviteCodeAfterPrefix,
  parseInvitePath,
  parsePostRef,
  PREFIX_LENGTH,
  toLinkageCode,
} from "./legacy-urls.ts";

// Real codes are seven characters from BCDFGHJKLMNPQRSTVWXYZ
// (generateInviteCode(7) in Murmur-apollo).
const REAL_CODE = "BCDFGHJ";

describe("parseAcceptReengagement", () => {
  it("splits at the legacy offsets", () => {
    assert.deepEqual(
      parseAcceptReengagement("/acceptReengagementPosts/2026-08-06/joshuas"),
      { dateStr: "2026-08-06", username: "joshuas" },
    );
  });

  it("accepts usernames with dots, dashes and underscores", () => {
    assert.deepEqual(
      parseAcceptReengagement("/acceptReengagementPosts/2026-01-31/dr.smith_1"),
      { dateStr: "2026-01-31", username: "dr.smith_1" },
    );
  });

  it("rejects a date that is not YYYY-MM-DD", () => {
    assert.equal(
      parseAcceptReengagement("/acceptReengagementPosts/notadate01/joshuas"),
      null,
    );
  });

  it("rejects a missing username", () => {
    assert.equal(
      parseAcceptReengagement("/acceptReengagementPosts/2026-08-06/"),
      null,
    );
  });

  it("rejects a misplaced separator", () => {
    assert.equal(
      parseAcceptReengagement("/acceptReengagementPosts/2026-08-06joshuas"),
      null,
    );
  });
});

describe("parseDoNotPromote", () => {
  // 36 chars, 10 chars — the widths legacy's offsets assume.
  const postId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const magicCookie = "0123456789";

  it("splits at the legacy offsets", () => {
    assert.equal(postId.length, 36);
    assert.equal(magicCookie.length, 10);
    assert.deepEqual(
      parseDoNotPromote(`/doNotPromote/${postId}/${magicCookie}/joshuas`),
      { postId, magicCookie, username: "joshuas" },
    );
  });

  it("rejects a postId that is not a 36-char UUID", () => {
    assert.equal(parseDoNotPromote(`/doNotPromote/short/${magicCookie}/a`), null);
  });

  it("rejects a magic cookie of the wrong width", () => {
    assert.equal(parseDoNotPromote(`/doNotPromote/${postId}/short/joshuas`), null);
  });

  it("rejects a missing username", () => {
    assert.equal(
      parseDoNotPromote(`/doNotPromote/${postId}/${magicCookie}/`),
      null,
    );
  });
});

describe("parseEmailVerificationToken", () => {
  it("splits the last segment on the underscore", () => {
    assert.deepEqual(parseEmailVerificationToken("/emailVerification/u123_e456"), {
      userId: "u123",
      emailId: "e456",
    });
  });

  it("tolerates a trailing slash, like legacy's pop() || pop()", () => {
    assert.deepEqual(
      parseEmailVerificationToken("/emailVerification/u123_e456/"),
      { userId: "u123", emailId: "e456" },
    );
  });

  // Legacy hung the socket forever on each of these; now they render a failure
  // page instead.
  it("returns null when there is no underscore", () => {
    assert.equal(parseEmailVerificationToken("/emailVerification/garbage"), null);
  });

  it("returns null when there is more than one underscore", () => {
    assert.equal(parseEmailVerificationToken("/emailVerification/a_b_c"), null);
  });

  it("returns null when a side of the underscore is empty", () => {
    assert.equal(parseEmailVerificationToken("/emailVerification/_e456"), null);
    assert.equal(parseEmailVerificationToken("/emailVerification/u123_"), null);
  });
});

describe("parseInvitePath", () => {
  it("reads the variant and code from /invite/N/<code>", () => {
    assert.deepEqual(parseInvitePath("/invite/4/ABC123"), {
      variant: 4,
      inviteCode: "ABC123",
    });
  });

  // Legacy returned an EMPTY code here and fired the linkage mutation with it.
  it("recovers the real code from the 2-segment form", () => {
    assert.deepEqual(parseInvitePath("/invite/ABC123"), {
      variant: null,
      inviteCode: "ABC123",
    });
  });

  // Legacy built "/inviteNaN.html" from parseInt("x").
  it("reports a non-numeric variant as null rather than NaN", () => {
    assert.deepEqual(parseInvitePath("/invite/x/ABC123"), {
      variant: null,
      inviteCode: "ABC123",
    });
  });

  it("carries through other numeric variants for the caller to reject", () => {
    assert.deepEqual(parseInvitePath("/invite/2/ABC123"), {
      variant: 2,
      inviteCode: "ABC123",
    });
  });

  // The regression: real codes are seven characters, and a six-character-only
  // check made every genuine /invite/4/<code> link 404.
  it("accepts a real seven-character code", () => {
    assert.deepEqual(parseInvitePath(`/invite/4/${REAL_CODE}`), {
      variant: 4,
      inviteCode: REAL_CODE,
    });
  });

  it("accepts codes from six up to nine characters", () => {
    for (const code of ["ABC123", "ABC1234", "ABC12345", "ABC123456"]) {
      assert.equal(
        parseInvitePath(`/invite/4/${code}`)?.inviteCode,
        code,
        `expected ${code} to parse`,
      );
    }
  });

  it("rejects codes outside that range", () => {
    assert.equal(parseInvitePath("/invite/4/SHORT"), null);
    assert.equal(parseInvitePath("/invite/4/ABC1234567"), null);
    assert.equal(parseInvitePath("/invite/4/"), null);
    assert.equal(parseInvitePath("/invite"), null);
  });
});

describe("parseInviteCodeAfterPrefix", () => {
  it("reads /inviteN/<code> at offset 9", () => {
    assert.equal(
      parseInviteCodeAfterPrefix("/invite4/ABC123", PREFIX_LENGTH.inviteN),
      "ABC123",
    );
  });

  it("reads /invite-qr/<code> at offset 11", () => {
    assert.equal(
      parseInviteCodeAfterPrefix("/invite-qr/ABC123", PREFIX_LENGTH.inviteQr),
      "ABC123",
    );
  });

  it("reads /appstore/<code> at offset 10", () => {
    assert.equal(
      parseInviteCodeAfterPrefix("/appstore/ABC123", PREFIX_LENGTH.appstore),
      "ABC123",
    );
  });

  // Legacy sliced exactly six here, silently mangling every real code. The full
  // code is what the visitor has to type into the app, so it must survive.
  it("keeps a full seven-character code rather than truncating it", () => {
    assert.equal(
      parseInviteCodeAfterPrefix(
        `/invite4/${REAL_CODE}`,
        PREFIX_LENGTH.inviteN,
      ),
      REAL_CODE,
    );
    assert.equal(
      parseInviteCodeAfterPrefix(
        `/appstore/${REAL_CODE}`,
        PREFIX_LENGTH.appstore,
      ),
      REAL_CODE,
    );
  });

  it("stops at a trailing path segment", () => {
    assert.equal(
      parseInviteCodeAfterPrefix("/invite4/ABC123/extra", PREFIX_LENGTH.inviteN),
      "ABC123",
    );
  });

  it("rejects a code shorter than six characters", () => {
    assert.equal(
      parseInviteCodeAfterPrefix("/invite4/ABC", PREFIX_LENGTH.inviteN),
      null,
    );
  });
});

describe("toLinkageCode", () => {
  // createIPInviteLinkage rejects anything over six characters outright, while
  // codes are generated at seven — so the recorded value must be trimmed even
  // though the displayed one must not be.
  it("trims a seven-character code to six for the linkage mutation", () => {
    assert.equal(toLinkageCode(REAL_CODE), "BCDFGH");
    assert.equal(toLinkageCode(REAL_CODE).length, 6);
  });

  it("leaves a six-character code alone", () => {
    assert.equal(toLinkageCode("ABC123"), "ABC123");
  });
});

describe("parsePostRef", () => {
  const DASHED = "fa52c8f0-d3ba-4b32-8c54-62bf2d7426a4";
  const FLAT = "fa52c8f0d3ba4b328c5462bf2d7426a4";
  const MC = "2ZLpu89URs"; // 10 chars, the width of every magicCookie in the DB

  it("reads the canonical dashed id alone", () => {
    assert.deepEqual(parsePostRef([DASHED]), { postId: DASHED, mc: null });
  });

  it("reads a flat id alone, restoring the dashes", () => {
    assert.deepEqual(parsePostRef([FLAT]), { postId: DASHED, mc: null });
  });

  // The app's form: dashes stripped, cookie as a second path segment.
  it("reads a flat id with the cookie as a second segment", () => {
    assert.deepEqual(parsePostRef([FLAT, MC]), { postId: DASHED, mc: MC });
  });

  it("reads a dashed id with the cookie as a second segment", () => {
    assert.deepEqual(parsePostRef([DASHED, MC]), { postId: DASHED, mc: MC });
  });

  // murmur-uuid-buffer throws on anything but 36 chars with dashes, so the flat
  // form must normalise to exactly the same id the dashed form produces.
  it("normalises both id forms to the same value", () => {
    assert.equal(parsePostRef([FLAT, MC])?.postId, parsePostRef([DASHED])?.postId);
  });

  it("is case-insensitive about the hex", () => {
    assert.equal(
      parsePostRef([FLAT.toUpperCase(), MC])?.postId.toLowerCase(),
      DASHED,
    );
  });

  it("rejects references it can't parse", () => {
    assert.equal(parsePostRef([]), null);
    assert.equal(parsePostRef([""]), null);
    assert.equal(parsePostRef(["notauuid"]), null);
    assert.equal(parsePostRef([FLAT.slice(0, 31)]), null);
    // The concatenated form (no slash) is not one of the live shapes.
    assert.equal(parsePostRef([FLAT + MC]), null);
    // More segments than a post reference can have.
    assert.equal(parsePostRef([FLAT, MC, "extra"]), null);
  });

  it("rejects junk in the cookie position rather than ignoring it", () => {
    assert.equal(parsePostRef([FLAT, "not-a-cookie!"]), null);
    assert.equal(parsePostRef([FLAT, ""]), null);
    // posts.magicCookie is varchar(30), so anything longer is not one.
    assert.equal(parsePostRef([FLAT, "a".repeat(31)]), null);
  });
});

describe("parseHealthCheckService", () => {
  it("defaults to api1", () => {
    assert.equal(parseHealthCheckService("/health-check"), "api1");
  });

  it("reads the service suffix", () => {
    assert.equal(parseHealthCheckService("/health-check-api2"), "api2");
  });

  // Both are legacy quirks of split('-')[2], preserved in case monitoring
  // depends on them.
  it("takes only one piece of a hyphenated service name", () => {
    assert.equal(parseHealthCheckService("/health-check-api-2"), "api");
  });

  it("treats a non-separated suffix as the default, like legacy startsWith", () => {
    assert.equal(parseHealthCheckService("/health-checkfoo"), "api1");
  });
});

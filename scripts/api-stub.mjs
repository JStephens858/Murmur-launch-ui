/**
 * Recording stand-in for the Murmur GraphQL API.
 *
 * Records every operation and its variables to calls.jsonl so the URL
 * compatibility script can assert on the exact values the ported endpoints send,
 * not just on status codes. Set STUB_DELAY_MS to make it slow, which is how the
 * fire-and-forget (after()) behaviour gets verified.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";

const PORT = Number(process.env.STUB_PORT) || 4555;
const LOG = process.env.STUB_LOG || "./calls.jsonl";
const DELAY_MS = Number(process.env.STUB_DELAY_MS) || 0;

writeFileSync(LOG, "");

// success:false for these operations, to exercise the failure branches.
const FAIL_FOR = (process.env.STUB_FAIL_OPS || "").split(",").filter(Boolean);

function operationName(query) {
  const m = query.match(/(?:mutation|query)\s+(\w+)/);
  return m ? m[1] : "unknown";
}

/** The magic cookie the stub treats as valid. */
const GOOD_MC = "GOODMCOOK1";

const STUB_POST_TEXT =
  "Stub post body long enough to exercise the hundred character truncation that " +
  "drives the link preview title and description.";

function publicPost(postId, mc) {
  const empty = {
    userId: "",
    username: "",
    displayName: "",
    profilePicThumbnailUrl: "",
  };
  if (!postId || /^0+(-0+)*$/.test(postId)) {
    return {
      resultType: "none",
      postId: "",
      postText: "",
      postGroupName: "",
      createdDate: new Date(0).toISOString(),
      mediaPreviewUrl: null,
      creator: empty,
      mediaElements: [],
    };
  }
  if (mc === GOOD_MC) {
    return {
      resultType: "full",
      postId,
      postText: STUB_POST_TEXT,
      postGroupName: "Stub Group",
      createdDate: new Date(0).toISOString(),
      mediaPreviewUrl: "https://example.invalid/preview.jpg",
      creator: {
        userId: "u-1",
        username: "stubdoc",
        displayName: "Stub Doctor",
        profilePicThumbnailUrl: "https://example.invalid/avatar.jpg",
      },
      mediaElements: [
        {
          mediaElementId: "m-1",
          mediaType: "text",
          mediaText: "Stub text element",
          indexInPost: 0,
          mediaUrl: null,
          streamUrl: null,
          mediaPreviewImageUrl: null,
          pollVotesCast: null,
          pollResults: null,
        },
        {
          mediaElementId: "m-2",
          mediaType: "video",
          mediaText: "Stub video element",
          indexInPost: 1,
          mediaUrl: "https://example.invalid/v.mp4",
          streamUrl: "https://example.invalid/v/stream.m3u8",
          mediaPreviewImageUrl: "https://example.invalid/poster.jpg",
          pollVotesCast: null,
          pollResults: null,
        },
      ],
    };
  }
  // og: excerpt only, no media, no display name — and a bogus createdDate, which
  // is why the page must not print a date in this state.
  return {
    resultType: "og",
    postId,
    postText: STUB_POST_TEXT.slice(0, 100) + "...",
    postGroupName: "",
    createdDate: new Date(0).toISOString(),
    mediaPreviewUrl: "https://example.invalid/preview.jpg",
    creator: { ...empty, username: "stubdoc" },
    mediaElements: [],
  };
}

createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400).end("bad json");
      return;
    }
    const op = operationName(parsed.query || "");
    appendFileSync(
      LOG,
      JSON.stringify({
        op,
        variables: parsed.variables,
        authorization: req.headers.authorization ?? null,
        at: Date.now(),
      }) + "\n",
    );

    if (DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    res.writeHead(200, { "Content-Type": "application/json" });

    // getPublicPostData answers with a post, not a {success} envelope. Mirrors
    // the real backend's three shapes so /post can be exercised without it:
    // a valid mc gives "full", anything else "og", and an all-zero id "none".
    if (op === "getPublicPostData") {
      const { postId, mc } = parsed.variables ?? {};
      res.end(JSON.stringify({ data: { getPublicPostData: publicPost(postId, mc) } }));
      return;
    }

    const success = !FAIL_FOR.includes(op);
    res.end(JSON.stringify({ data: { [op]: { success } } }));
  });
}).listen(PORT, () => {
  console.log(`api-stub listening on ${PORT}, logging to ${LOG}`);
});

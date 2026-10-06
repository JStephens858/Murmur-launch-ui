/**
 * Mock Murmur GraphQL API for driving the portal feed without a signed-in
 * session or a populated backend: answers getPostsInGroup (34 posts, paged by
 * lastPostIdReceived, an ad insertion mixed in) and getFullPostData (media,
 * comments, a quoted post), getNotifications2 (45 rows of every kind, paged
 * by beforeDate), markNotificationsSeen / markNotificationsCleared, and
 * getProfile (badge counts), and the composer's calls: createPost for feed posts
 * (held unpublished until their tus uploads land, then published 3 s later),
 * getPostUploadStatus, getMyModeratorStatus, getAppSponsorshipModStats,
 * searchForUsernamesThatMatch / searchForHashtagsThatMatch and
 * getOpenGraphValues. MOCK_IS_ADMIN=<n> and MOCK_CONTENT_CREATOR=1 set the
 * signed-in user's flags. GET /calls lists every operation received; GET
 * /notify adds a fresh unread notification, for testing badge-driven reloads.
 *
 *   node scripts/mock-portal-api.mjs   # :4100
 *   NEXT_PUBLIC_MURMUR_API_SERVER=http://localhost:4100/api npx next dev -p 3100
 *
 * The portal still needs a token: in puppeteer, intercept /auth/access-token
 * and respond {"token":"x"}; the mock ignores the header. See .claude/skills/verify.
 */
import { createServer } from "node:http";
const PORT = 4100;
const uuid = (n, p = "a") => `${p.repeat(8).slice(0, 8)}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const svg = (label, color) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="${color}"/><text x="50%" y="50%" font-family="sans-serif" font-size="72" fill="white" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`)}`;
const users = [1,2,3,4].map((n) => ({ userId: uuid(n,"b"), username: ["cathlab_kate","d_ramirez","ep_priya","vasc_tom"][n-1], displayName: ["Kate Morgan, MD","Diego Ramirez, MD","Priya Nair, MD","Tom Okafor, MD"][n-1], isDeleted: false, profilePicThumbnailUrl: null, profilePicMediumUrl: null, coverPicMediumUrl: null, specialty: ["Interventional Cardiology","Structural Heart","Electrophysiology","Vascular Surgery"][n-1], flair: ["CTO enthusiast","TAVR since 2012","Ablate all the things",null][n-1], location: ["Boise, ID","Austin, TX","Seattle, WA","Denver, CO"][n-1], bio: n === 1 ? "Interventional cardiologist. Complex PCI, CTO, calcium modification." : n === 4 ? "Vascular surgeon with an interest in limb salvage." : null, disclosures: n === 1 ? "Speaker, Boston Scientific." : null, interests: n === 1 ? "CTO, IVUS, Impella" : null, invitedByUsername: n === 1 ? "d_ramirez" : null, link: n === 1 ? "https://example.com/kate" : null, createdDate: new Date(2023, n, 10).toISOString(), userClass: "doctor", isEmployee: false, rank: n, score: n * 120, progressToNextRank: 40 }));
const follows = { [uuid(1,"b")]: [uuid(2,"b"), uuid(3,"b")], [uuid(2,"b")]: [uuid(1,"b")], [uuid(3,"b")]: [uuid(1,"b"), uuid(4,"b")], [uuid(4,"b")]: [] }; // who each user follows
const cats = (g) => [
  { categoryId: uuid(g * 10 + 1, "5"), order: 1, key: "cases", name: "Cases", subtitle: null, parentCategoryId: null, categoryDisplayStyle: "header", hasChildren: 0, displayStyle: "post_card" },
  { categoryId: uuid(g * 10 + 2, "5"), order: 2, key: "library", name: "Library", subtitle: "Reference material", parentCategoryId: null, categoryDisplayStyle: "browser", hasChildren: 1, displayStyle: "simple_reference" },
  { categoryId: uuid(g * 10 + 3, "5"), order: 1, key: "guidelines", name: "Guidelines", subtitle: "Society guidance", parentCategoryId: uuid(g * 10 + 2, "5"), categoryDisplayStyle: "browser", hasChildren: 0, displayStyle: "simple_reference" },
  { categoryId: uuid(g * 10 + 4, "5"), order: 2, key: "trials", name: "Trials", subtitle: "Landmark papers", parentCategoryId: uuid(g * 10 + 2, "5"), categoryDisplayStyle: "browser", hasChildren: 0, displayStyle: "simple_reference" },
];
const groupSettings = (g, extra) => ({ postGroupId: g.postGroupId, indexInParent: null, pinnedPostId: null, groupName: g.groupName, description: g.description, groupType: g.groupType, memberCount: g.memberCount, moderatorUserIds: [users[0].userId], subscribed: g.subscribed, sponsored: g.sponsored ?? 0, sponsor: g.sponsor ?? null, iconUrl: g.iconUrl, restrictions: g.restrictions ?? null, inviteDisposition: null, canPost: g.subscribed ? 1 : 0, canLeave: g.subscribed ? 1 : 0, postFilter: null, categories: g.categories ?? null, numUnseenMessages: 0, onlyModsCanSetCategory: 0, isVisibleInList: 1, canSeeGroupDetails: 1, userScore: 0, ...extra });
const groups = [
  { postGroupId: uuid(1,"c"), groupName: "Interventional Cardiology", groupType: "public", iconUrl: "🫀", description: "Coronary and peripheral intervention: cases, technique, devices.", memberCount: 412, subscribed: true, categories: cats(1) },
  { postGroupId: uuid(2,"c"), groupName: "Structural Heart", groupType: "public", iconUrl: null, description: "TAVR, mitral and tricuspid therapies, LAAO.", memberCount: 268, subscribed: true, sponsored: 1, sponsor: "Sponsored by Edwards Lifesciences" },
  { postGroupId: uuid(3,"c"), groupName: "Electrophysiology", groupType: "public", iconUrl: "⚡", description: "Ablation, devices, arrhythmia management.", memberCount: 190, subscribed: false },
  { postGroupId: uuid(4,"c"), groupName: "Advisory Board", groupType: "private", iconUrl: "🔒", description: "Invitation-only working group.", memberCount: 12, subscribed: false, restrictions: JSON.stringify({ userClass: ["doctor"], canRequestAccessUserClass: ["doctor"] }) },
  { postGroupId: uuid(5,"c"), groupName: "Fellows Lounge", groupType: "restricted", iconUrl: null, description: "For fellows in training.", memberCount: 77, subscribed: false, restrictions: JSON.stringify({ userClass: ["doctor"], canRequestAccessUserClass: [] }) },
  { postGroupId: uuid(6,"c"), groupName: "Industry Only", groupType: "restricted", iconUrl: null, description: "Not for physicians.", memberCount: 5, subscribed: false, restrictions: JSON.stringify({ userClass: ["industry"], canRequestAccessUserClass: [] }) },
];
groups[0].pinnedPostId = uuid(3);
const hashtags = [{ hashtagId: uuid(1,"d"), hashtag: "TAVR" },{ hashtagId: uuid(2,"d"), hashtag: "CTO" },{ hashtagId: uuid(3,"d"), hashtag: "IVUS" }];
const TOTAL = 34;
const posts = [], media = [], comments = [];
for (let n = 1; n <= TOTAL; n++) {
  const kind = ["image","text","video","poll","file"][n % 5];
  const id = uuid(n), created = new Date(Date.now() - n * 3.7 * 3600_000).toISOString();
  const els = [];
  const postBody = `Post ${n} (${kind}). 72-year-old with multivessel disease and a calcified proximal LAD. Prior CABG with a patent LIMA. Presenting with unstable angina despite maximal medical therapy.\n\nThinking about a staged approach — thoughts?`;
  const push = (m) => { const mid = uuid(n*10 + els.length, "e"); els.push(mid); media.push({ postId: id, mediaElementId: mid, indexInPost: els.length - 1, mediaText: null, properties: null, mediaUrl: null, streamUrl: null, duration: null, fileSize: null, mediaPreviewImageUrl: null, attachmentTitle: null, attachmentImage: null, attachmentDescription: null, attachmentDestinationUrl: null, pollResults: null, pollTotalVotesCast: null, ...m }); };
  push({ mediaType: "text", mediaText: postBody });
  if (kind === "image") { push({ mediaType: "image", mediaUrl: svg("Angio frame " + n, "#8a1e5c"), mediaText: "LAO caudal, post-stent" }); push({ mediaType: "image", mediaUrl: svg("Frame 2", "#6d1849") }); }
  if (kind === "video") push({ mediaType: "video", streamUrl: "https://example.com/stream.m3u8", mediaPreviewImageUrl: svg("Video " + n, "#232a33"), duration: 154, mediaText: "Case walkthrough" });
  if (kind === "poll") push({ mediaType: "poll", mediaText: "First-line access for this case?", properties: JSON.stringify([{ id: uuid(1,"f"), text: "Radial", height: 44 }, { id: uuid(2,"f"), text: "Femoral", height: 44 }, { id: uuid(3,"f"), text: "Depends on anatomy", height: 44 }]) });
  if (kind === "file") push({ mediaType: "file", mediaText: "ESC 2026 guideline excerpt.pdf", mediaUrl: "https://example.com/file.pdf" });
  if (kind === "text") push({ mediaType: "text", mediaText: "Link to the trial:", attachmentTitle: "Landmark trial results", attachmentDescription: "Primary endpoint met with a 31% relative risk reduction at 12 months.", attachmentDestinationUrl: "https://example.com/trial" });
  const cids = [uuid(n*100+1,"9"), uuid(n*100+2,"9")];
  cids.forEach((cid, i) => { const ctext = i === 0 ? "Nice result. Did you consider IVUS-guided sizing here?" : "We had a similar case last month; went radial and it worked out fine."; const cmid = uuid(n * 1000 + i, "8"); if (kind === "video") media.push({ postId: cid, mediaElementId: uuid(n * 1000 + i + 50, "8"), indexInPost: 1, mediaType: "video", mediaText: null, properties: null, mediaUrl: null, streamUrl: "https://example.com/stream.m3u8", duration: 61, fileSize: null, mediaPreviewImageUrl: svg("Comment video " + (i + 1), "#6d1849"), attachmentTitle: null, attachmentImage: null, attachmentDescription: null, attachmentDestinationUrl: null, pollResults: null, pollTotalVotesCast: null }); media.push({ postId: cid, mediaElementId: cmid, indexInPost: 0, mediaType: "text", mediaText: ctext, properties: null, mediaUrl: null, streamUrl: null, duration: null, fileSize: null, mediaPreviewImageUrl: null, attachmentTitle: null, attachmentImage: null, attachmentDescription: null, attachmentDestinationUrl: null, pollResults: null, pollTotalVotesCast: null }); comments.push({ postId: cid, postGroupId: groups[n % 2].postGroupId, rootPostId: id, parentPostId: id, depth: 1, isDeleted: false, isPublished: true, creatorUserId: users[(n + i + 1) % 4].userId, createdDate: created, publishedDate: created, title: null, postText: ctext, mediaPreviewUrl: null, mediaElementIds: kind === "video" ? [cmid, uuid(n * 1000 + i + 50, "8")] : [cmid], hashtagIds: null, commentIds: [], quotedPostId: null, numLikes: 3 + i, numComments: 0, numBookmarks: 0, numUniqueViews: 12, likedByMe: 0, bookmarkedByMe: 0, commentsLocked: 0, categoryKey: null, promotedPostType: null }); });
  posts.push({ postId: id, postGroupId: groups[n % 2].postGroupId, rootPostId: null, parentPostId: null, depth: 0, isDeleted: false, isPublished: true, creatorUserId: users[n % 4].userId, createdDate: created, publishedDate: created, title: n % 3 === 0 ? `Post ${n}: complex bifurcation, what would you do?` : null, postText: postBody, mediaPreviewUrl: kind === "image" ? svg("Angio frame " + n, "#8a1e5c") : kind === "video" ? svg("Video " + n, "#232a33") : null, mediaElementIds: els, hashtagIds: [hashtags[n % 3].hashtagId, ...(n % 2 ? [hashtags[(n+1) % 3].hashtagId] : [])], commentIds: cids, quotedPostId: n === 6 ? uuid(2) : null, numLikes: (n * 7) % 40, numComments: 2, numBookmarks: n % 4, numUniqueViews: n * 13, likedByMe: n % 5 === 0 ? 1 : 0, bookmarkedByMe: n % 4 === 1 ? 1 : 0, commentsLocked: 0, categoryKey: kind === "poll" ? "poll" : null, promotedPostType: null });
}
const lite = (p) => ({ ...p, mediaElementIds: p.mediaElementIds, commentIds: p.commentIds });
const storeFor = (ps, full) => { const all = full ? [...ps, ...comments.filter(c => ps.some(p => p.postId === c.rootPostId)), ...ps.filter(p => p.quotedPostId).map(p => posts.find(q => q.postId === p.quotedPostId)).filter(Boolean)] : ps.map(lite); return { users, posts: all, mediaElements: full ? media.filter(m => all.some(p => p.postId === m.postId)) : [], hashtags, postGroups: groups }; };
const KINDS = ["likePost","replyPost","newPost","bookmarkPost","newFollower","userMentioned","newDmPost","postGroupAction","systemAnnouncement","newUser","priorityPost"];
const TEXT = { likePost: "liked your post", replyPost: "replied to your post", newPost: "posted in Interventional Cardiology", bookmarkPost: "bookmarked your post", newFollower: "started following you", userMentioned: "mentioned you in a post", newDmPost: "sent you a message", postGroupAction: "approved your request to join Structural Heart", systemAnnouncement: "MurmurMD will be down for maintenance tonight at 11pm MT", newUser: "joined MurmurMD — say hello", priorityPost: "posted something you might like" };
const notifications = Array.from({ length: 45 }, (_, i) => {
  const n = i + 1, kind = KINDS[i % KINDS.length], creator = users[i % 4];
  return { notificationId: uuid(n, "7"), userId: users[0].userId, notificationType: kind, notificationDestinationId: ["newFollower","newUser"].includes(kind) ? creator.userId : kind === "postGroupAction" ? groups[1].postGroupId : kind === "newDmPost" ? uuid(9, "c") : posts[i % posts.length].postId, notificationPostId: kind === "replyPost" ? comments[(i % posts.length) * 2].postId : posts[i % posts.length].postId, notificationCreatorId: kind === "systemAnnouncement" ? null : creator.userId, createdDate: new Date(Date.now() - n * 5.3 * 3600_000).toISOString(), notificationText: kind === "systemAnnouncement" ? TEXT[kind] : `${creator.displayName} ${TEXT[kind]}`, notificationTitle: n % 3 === 0 ? (kind === "systemAnnouncement" ? "Scheduled maintenance" : creator.displayName) : "", notificationSubtitle: n % 3 === 0 && kind !== "systemAnnouncement" ? creator.specialty : "", notificationText2: n % 2 === 0 ? (kind === "systemAnnouncement" ? TEXT[kind] : `${n % 3 === 0 ? "" : creator.displayName + " "}${TEXT[kind]}`.trim()) : "", notificationImageUrl: kind === "systemAnnouncement" ? null : svg(creator.displayName[0], ["#8a1e5c","#de046c","#6d1849","#232a33"][i % 4]), seen: n <= 6 ? 0 : 1 };
});
// poll votes: mediaElementId -> { userId -> optionId }, seeded so tallies aren't empty
const pollVotes = {};
for (const m of media) if (m.mediaType === "poll") { const [a, b] = JSON.parse(m.properties); pollVotes[m.mediaElementId] = { u1: a.id, u2: a.id, u3: b.id }; }
const pollPayload = (mid, me) => { const v = pollVotes[mid] ?? {}; const counts = {}; for (const o of Object.values(v)) if (o !== "00000000-0000-0000-0000-000000000000") counts[o] = (counts[o] ?? 0) + 1; return { mediaElementId: mid, usersSelection: v[me] ?? null, pollResults: Object.entries(counts).map(([optionId, count]) => ({ optionId, count })) }; };
// Direct messages: two conversations (a 1:1 and a group), 45 messages in the first
const dmGroups = [
  { postGroupId: uuid(1, "d0"), createdDate: new Date(Date.now() - 30 * 86400_000).toISOString(), memberUserIds: [users[0].userId, users[1].userId], numUnseenMessages: 2 },
  { postGroupId: uuid(2, "d0"), createdDate: new Date(Date.now() - 10 * 86400_000).toISOString(), memberUserIds: [users[0].userId, users[2].userId, users[3].userId], numUnseenMessages: 0 },
];
const dmPosts = {};
const mkMsg = (gid, n, from, text, minsAgo) => { const id = uuid(n, "d1"); const created = new Date(Date.now() - minsAgo * 60_000).toISOString(); const mid = uuid(n, "d2"); media.push({ postId: id, mediaElementId: mid, indexInPost: 0, mediaType: "text", mediaText: text, properties: null, mediaUrl: null, streamUrl: null, duration: null, fileSize: null, mediaPreviewImageUrl: null, attachmentTitle: null, attachmentImage: null, attachmentDescription: null, attachmentDestinationUrl: null, pollResults: null, pollTotalVotesCast: null }); const post = { postId: id, postGroupId: gid, rootPostId: null, parentPostId: null, depth: 0, isDeleted: false, isPublished: true, creatorUserId: from, createdDate: created, publishedDate: created, title: null, postText: text, mediaPreviewUrl: null, mediaElementIds: [mid], hashtagIds: null, commentIds: [], quotedPostId: null, numLikes: 0, numComments: 0, numBookmarks: 0, numUniqueViews: 1, likedByMe: 0, bookmarkedByMe: 0, commentsLocked: 0, categoryKey: null, promotedPostType: null }; (dmPosts[gid] ??= []).push(post); return post; };
for (let n = 1; n <= 45; n++) mkMsg(dmGroups[0].postGroupId, n, n % 3 === 0 ? users[0].userId : users[1].userId, n % 3 === 0 ? `Reply ${n}: agreed, radial first.` : `Message ${n}: what did you end up doing with the calcified LAD case?`, (46 - n) * 95);
mkMsg(dmGroups[1].postGroupId, 100, users[2].userId, "Welcome to the EP working group chat.", 3000);
mkMsg(dmGroups[1].postGroupId, 101, users[3].userId, "Thanks! Looking forward to it.", 2990);
for (const g of dmGroups) { const list = dmPosts[g.postGroupId].slice().sort((a, b) => b.createdDate.localeCompare(a.createdDate)); g.lastPostId = list[0].postId; g.lastPostDate = list[0].createdDate; }
const dmStore = (ps) => ({ users, posts: ps, mediaElements: media.filter((m) => ps.some((p) => p.postId === m.postId)), hashtags: [], postGroups: [] });
let msgCounter = 500;
const CV_ITEM_TYPES = [["undergrad","University"],["graduate","Post Graduate"],["medSchool","Medical School"],["otherSchool","Other Education"],["internship","Internship"],["residency","Residency"],["fellowship","Fellowship"],["otherTraining","Other Training"],["specialty","Specialty"],["subSpecialty","SubSpecialty"],["areaOfFocus","Area of Focus"],["otherSpecialty","Other Specialty"],["practice","Practice"],["otherEmployment","Other Employment"],["hospitalAffiliation","Hospital Affiliation"],["license","License"],["organization","Organization"],["otherExperience","Other Experience"]].map(([id, name], i) => ({ id, name, indexInList: i, display: 2 }));
let cvSeq = 1;
const cvItems = { [users[0].userId]: [
  { itemId: uuid(1, "e1"), userId: users[0].userId, indexInList: 1, itemType: "fellowship", title: "Cleveland Clinic", practiceType: null, discipline: null, companyName: null, location: null, description: "Interventional Cardiology", start: "2010", end: "2012", isCurrent: false },
  { itemId: uuid(2, "e1"), userId: users[0].userId, indexInList: 2, itemType: "practice", title: "St. Luke's", practiceType: "Hospital", discipline: null, companyName: null, location: "Boise, ID", description: "Director, Cath Lab", start: "2015", end: null, isCurrent: true },
  { itemId: uuid(3, "e1"), userId: users[0].userId, indexInList: 3, itemType: "areaOfFocus", title: "CTO", practiceType: null, discipline: null, companyName: null, location: null, description: null, start: null, end: null, isCurrent: false },
] };
let calls = [];
const uploads = {};
createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type,tus-resumable,upload-length,upload-metadata,upload-offset,x-requested-with,x-http-method-override", "Access-Control-Allow-Methods": "POST,PATCH,HEAD,OPTIONS", "Access-Control-Expose-Headers": "location,upload-offset,upload-length,tus-resumable" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (req.url === "/calls") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(calls)); }
  if (req.url === "/notify") { // test hook: a fresh unread notification, as if pushed while the page is open
    const n = notifications.length + 1, creator = users[n % 4];
    notifications.unshift({ notificationId: uuid(n, "7"), userId: users[0].userId, notificationType: "likePost", notificationDestinationId: posts[0].postId, notificationPostId: posts[0].postId, notificationCreatorId: creator.userId, createdDate: new Date().toISOString(), notificationText: `${creator.displayName} liked your post`, notificationTitle: "", notificationSubtitle: "", notificationText2: `${creator.displayName} liked your post (new ${n})`, notificationImageUrl: svg(creator.displayName[0], "#de046c"), seen: 0 });
    res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ added: n }));
  }
  if (req.url.startsWith("/files/")) { // tus stand-in for v1.uploads.murmurmd.com: POST creates, PATCH appends, done => new profile pic
    const key = req.url.slice(7).split("?")[0]; const tusHdr = { "Tus-Resumable": "1.0.0", ...cors };
    if (req.method === "OPTIONS") { res.writeHead(204, tusHdr); return res.end(); }
    if (req.method === "POST") { const meta = Object.fromEntries((req.headers["upload-metadata"] ?? "").split(",").filter(Boolean).map((kv) => { const [k, v] = kv.trim().split(" "); return [k, v ? Buffer.from(v, "base64").toString() : ""]; })); uploads[key] = { length: Number(req.headers["upload-length"]), received: 0, auth: req.headers.authorization ?? null, fileKey: meta.fileKey ?? null, postId: meta.postId ?? null, meta }; calls.push({ op: "tus:create", variables: { key, length: uploads[key].length, meta: uploads[key].meta }, auth: uploads[key].auth }); res.writeHead(201, { ...tusHdr, Location: `http://localhost:${PORT}/files/${key}` }); return res.end(); }
    if (req.method === "HEAD") { const u = uploads[key]; if (!u) { res.writeHead(404, tusHdr); return res.end(); } res.writeHead(200, { ...tusHdr, "Upload-Offset": String(u.received), "Upload-Length": String(u.length) }); return res.end(); }
    if (req.method === "PATCH") { const u = uploads[key]; if (!u) { res.writeHead(404, tusHdr); return res.end(); } let n = 0; req.on("data", (c) => n += c.length); return req.on("end", () => { u.received += n; calls.push({ op: "tus:patch", variables: { key, received: u.received, length: u.length } }); if (u.received >= u.length && u.fileKey && u.postId) { const p = posts.find((x) => x.postId === u.postId); if (p) { p.pendingFileKeys = (p.pendingFileKeys ?? []).filter((k) => k !== u.fileKey); if (!p.pendingFileKeys.length) setTimeout(() => { p.isPublished = true; p.publishedDate = new Date().toISOString(); }, 3000); } } else if (u.received >= u.length && u.fileKey) { /* as the real server: no fileKey in metadata, nothing happens */ users[0].profilePicMediumUrl = svg("New " + key.slice(0, 4), "#de046c"); users[0].profilePicThumbnailUrl = users[0].profilePicMediumUrl; } res.writeHead(204, { ...tusHdr, "Upload-Offset": String(u.received) }); res.end(); }); }
  }
  let body = ""; req.on("data", (c) => body += c); req.on("end", () => {
    const { query, variables } = JSON.parse(body);
    const op = (query.match(/(?:query|mutation)\s+(\w+)/) || [])[1];
    calls.push({ op, variables, auth: req.headers.authorization ?? null });
    let data;
    if (op === "getPostsInGroup") {
      const { count, lastPostIdReceived, postGroupId, categoryIds } = variables;
      let list = postGroupId === "ffffffff-ffff-ffff-ffff-ffffffffffff" ? posts : posts.filter((p) => p.postGroupId === postGroupId);
      if (categoryIds?.length) list = list.filter((p, i) => (categoryIds[0].endsWith("1") ? i % 2 === 0 : i % 2 === 1));
      const start = lastPostIdReceived ? list.findIndex((p) => p.postId === lastPostIdReceived) + 1 : 0;
      const page = list.slice(start, start + count);
      data = { getPostsInGroup: { success: true, errorMsg: null, errorCode: null, requestDate: variables.requestDate ?? new Date().toISOString(), endOfList: start + count >= list.length, results: { postIds: [...page.map((p) => p.postId), "ad-insertion-not-a-post"] }, store: storeFor(page, false) } };
    } else if (op === "getFullPostData") {
      const ps = posts.filter((p) => variables.postIds.includes(p.postId));
      data = { getFullPostData: { success: true, errorMsg: null, errorCode: null, store: storeFor(ps, true) } };
    } else if (op === "getNotifications2") {
      const before = new Date(variables.beforeDate).getTime();
      const page = notifications.filter((n) => n.seen < 2 && new Date(n.createdDate).getTime() < before).slice(0, variables.count ?? 20);
      data = { getNotifications2: { success: true, errorMsg: null, errorCode: null, results: { notifications: page }, store: { users: [], posts: [], mediaElements: [], hashtags: [], postGroups: [] } } };
    } else if (op === "markNotificationsSeen" || op === "markNotificationsCleared") {
      const before = new Date(variables.beforeDate + "Z").getTime(), v = op === "markNotificationsSeen" ? 1 : 2;
      for (const n of notifications) if (new Date(n.createdDate).getTime() <= before && n.seen < v) n.seen = v;
      data = { [op]: { success: true, errorMsg: null, errorCode: null } };
    } else if (op === "getTrendingHashtags") {
      data = { getTrendingHashtags: { success: true, errorMsg: null, errorCode: null, results: { hashtagIds: [hashtags[1].hashtagId, hashtags[0].hashtagId, hashtags[2].hashtagId] }, store: { users: [], posts: [], mediaElements: [], hashtags, postGroups: [] } } };
    } else if (op === "getExplorePostsForUser") {
      // Sections: a fixed per-section list paged by afterPostId; past the end the real backend throws, so do we.
      // No sections: the score path, ranked by baseUserPostScore (or baseComputedPostScore with hashtags), paged by maximumScore/maximumDate.
      const scored = posts.map((p, i) => ({ ...p, baseUserPostScore: 1000 - i * 7, weightedUserPostScore: 1000 - i * 7, baseComputedPostScore: 900 - i * 5, weightedComputedPostScore: 900 - i * 5 }));
      const withStore = (ps, sections) => ({ getExplorePostsForUser: { success: true, errorMsg: null, errorCode: null, results: { postIdsBySection: sections }, store: { ...storeFor(ps, false), posts: ps.map((p) => ({ ...lite(p), baseUserPostScore: p.baseUserPostScore, weightedUserPostScore: p.weightedUserPostScore, baseComputedPostScore: p.baseComputedPostScore, weightedComputedPostScore: p.weightedComputedPostScore })) } } });
      if (variables.exploreSectionCounts?.length) {
        const isPoll = (p) => media.some((m) => m.postId === p.postId && m.mediaType === "poll");
        const lists = { poll: scored.filter(isPoll), case: scored.filter((p) => p.title && !isPoll(p)), tipsAndTricks: scored.filter((p) => !p.title && !isPoll(p)).slice(0, 13), journal: scored.filter((p, i) => i % 4 === 1), question: scored.filter((p) => /\?/.test(p.postText ?? "")).slice(0, 12) };
        const sections = []; const ps = [];
        for (const req of variables.exploreSectionCounts) {
          const list = lists[req.exploreSection] ?? [];
          const start = req.afterPostId ? list.findIndex((p) => p.postId === req.afterPostId) + 1 : 0;
          if (start + req.count > list.length) { res.writeHead(200, { "Content-Type": "application/json", ...cors }); return res.end(JSON.stringify({ errors: [{ message: "Cannot read properties of undefined (reading 'postId')" }] })); }
          const page = list.slice(start, start + req.count); ps.push(...page);
          sections.push({ exploreSection: req.exploreSection, postIds: page.map((p) => p.postId) });
        }
        data = withStore(ps, sections);
      } else {
        const score = variables.hashtagIds?.length ? (p) => p.baseComputedPostScore : (p) => p.baseUserPostScore;
        const max = variables.maximumScore ?? 2147483647, maxDate = new Date((variables.maximumDate ?? "3000-01-01T00:00:00") + "Z").getTime();
        let list = scored.filter((p) => !variables.hashtagIds?.length || p.hashtagIds.some((h) => variables.hashtagIds.includes(h)));
        list = list.filter((p) => score(p) < max || (score(p) === max && new Date(p.createdDate).getTime() < maxDate)).sort((a, b) => score(b) - score(a)).slice(0, variables.count ?? 10);
        data = withStore(list, [{ exploreSection: "general", postIds: list.map((p) => p.postId) }]);
      }
    } else if (op === "getVideosForUser") {
      const vids = posts.filter((p) => media.some((m) => m.postId === p.postId && m.mediaType === "video"));
      const pageOf = (list, last, count) => { const start = last ? list.findIndex((p) => p.postId === last) + 1 : 0; return list.slice(start, start + count); };
      const longs = pageOf(vids.filter((_, i) => i % 2 === 0), variables.lastLongPostId, variables.longCount ?? 0);
      const shorts = pageOf(vids.filter((_, i) => i % 2 === 1), variables.lastShortPostId, variables.shortCount ?? 0);
      const ps = [...longs, ...shorts];
      const st = storeFor(ps, false); st.mediaElements = media.filter((m) => ps.some((p) => p.postId === m.postId)).map((m) => ({ ...m, streamUrl: "https://example.com/stream.m3u8" }));
      data = { getVideosForUser: { success: true, errorMsg: null, errorCode: null, results: { longVideoPostIds: longs.map((p) => p.postId), shortVideoPostIds: shorts.map((p) => p.postId), continueWatchingPostIds: [] }, store: st } };
    } else if (op === "likePost") {
      const p = posts.find((x) => x.postId === variables.postId);
      if (p) { p.numLikes += variables.like ? 1 : -1; p.likedByMe = variables.like; }
      data = { likePost: { success: true, errorMsg: null, errorCode: null, store: storeFor(p ? [p] : [], false) } };
    } else if (op === "bookmarkPost") {
      const p = posts.find((x) => x.postId === variables.postId);
      if (p) { p.numBookmarks += variables.bookmark ? 1 : -1; p.bookmarkedByMe = variables.bookmark; }
      data = { bookmarkPost: { success: true, errorMsg: null, errorCode: null, store: storeFor(p ? [p] : [], false) } };
    } else if (op === "getPollResults") {
      data = { getPollResults: { success: true, errorMsg: null, errorCode: null, results: pollPayload(variables.mediaElementId, "me") } };
    } else if (op === "selectPollOption") {
      (pollVotes[variables.mediaElementId] ??= {}).me = variables.optionId;
      data = { selectPollOption: { success: true, errorMsg: null, errorCode: null, results: pollPayload(variables.mediaElementId, "me") } };
    } else if (op === "getAllPostGroups") {
      data = { getAllPostGroups: { success: true, errorMsg: null, errorCode: null, results: groups.map((g) => groupSettings(g)), store: { users, posts: [], mediaElements: [], hashtags, postGroups: groups.map((g) => ({ postGroupId: g.postGroupId, groupName: g.groupName, groupType: g.groupType, iconUrl: g.iconUrl })) } } };
    } else if (op === "joinPostGroup" || op === "leavePostGroup") {
      const g = groups.find((x) => x.postGroupId === variables.postGroupId); const join = op === "joinPostGroup";
      if (g) { g.subscribed = join; g.memberCount += join ? 1 : -1; }
      data = { [op]: { success: true, errorMsg: null, errorCode: null, results: { postGroupId: variables.postGroupId, canPost: join, canLeave: join, postFilter: null, subscribed: join } } };
    } else if (op === "requestAccessToPostGroup" || op === "setPostGroupPreferences") {
      data = { [op]: { success: true, errorMsg: null, errorCode: null } };
    } else if (op === "getPostGroupPreferences") {
      data = { getPostGroupPreferences: { success: true, errorMsg: null, errorCode: null, results: variables.postGroupIds.map((id) => ({ postGroupId: id, watchingGroup: 0 })) } };
    } else if (op === "getModeratorsInGroup") {
      data = { getModeratorsInGroup: { success: true, errorMsg: null, errorCode: null, results: { moderators: [{ userId: users[0].userId, username: users[0].username, displayName: users[0].displayName, userClass: "doctor", isEmployee: 0, hidden: 0 }] }, store: { users, posts: [], mediaElements: [], hashtags: [], postGroups: [] } } };
    } else if (op === "getMembersInGroup") {
      const dm = dmGroups.find((x) => x.postGroupId === variables.postGroupId);
      const all = dm ? dm.memberUserIds : Array.from({ length: 70 }, (_, i) => users[i % 4].userId); const page = all.slice(variables.offset, variables.offset + variables.count);
      data = { getMembersInGroup: { success: true, errorMsg: null, errorCode: null, results: { moderatorCount: 1, memberCount: all.length, memberUserIds: page, moderatorUserIds: [users[0].userId] }, store: { users, posts: [], mediaElements: [], hashtags: [], postGroups: [] } } };
    } else if (op === "getDMGroupsForUser2") {
      data = { getDMGroupsForUser2: { success: true, errorMsg: null, errorCode: null, results: dmGroups.map((g) => ({ ...g, subscribed: true, canPost: 1, canLeave: 1 })), store: dmStore(dmGroups.map((g) => dmPosts[g.postGroupId].find((p) => p.postId === g.lastPostId))) } };
    } else if (op === "getPostsInDMGroup") {
      const list = (dmPosts[variables.postGroupId] ?? []).slice().sort((a, b) => b.createdDate.localeCompare(a.createdDate));
      const start = variables.lastPostIdReceived ? Math.max(0, list.findIndex((p) => p.postId === variables.lastPostIdReceived)) : 0; // the server's cursor page includes the cursor post
      const page = list.slice(start, start + (variables.count ?? 20));
      data = { getPostsInDMGroup: { success: true, errorMsg: null, errorCode: null, endOfList: start + (variables.count ?? 20) >= list.length, results: { postIds: page.map((p) => p.postId) }, store: dmStore(page) } };
    } else if (op === "createPost" && !dmGroups.some((g) => g.postGroupId === variables.postGroupId)) {
      // A feed post (new, follow-up, clone or edit). Elements naming a fileKey hold it
      // unpublished until their tus uploads finish, as the real server does.
      const els = variables.mediaElements ?? [];
      const editing = variables.isEditingPost && posts.find((p) => p.postId === variables.isEditingPost);
      const id = editing ? editing.postId : uuid(9000 + posts.length, "a");
      const now = new Date().toISOString();
      for (let i = media.length - 1; i >= 0; i--) if (media[i].postId === id && !els.some((e) => e.mediaElementId === media[i].mediaElementId)) media.splice(i, 1);
      const pending = els.flatMap((e) => [e.fileKey, e.previewImageFileKey]).filter(Boolean);
      for (const e of els) {
        const prev = media.find((m) => m.mediaElementId === e.mediaElementId);
        const row = { postId: id, mediaElementId: e.mediaElementId, indexInPost: e.indexInPost, mediaType: e.mediaType, mediaText: e.mediaText, properties: e.properties ?? null, mediaUrl: prev?.mediaUrl ?? null, streamUrl: prev?.streamUrl ?? null, duration: prev?.duration ?? null, fileSize: null, mediaPreviewImageUrl: prev?.mediaPreviewImageUrl ?? null, attachmentTitle: e.attachmentTitle ?? null, attachmentImage: e.attachmentImage ?? null, attachmentDescription: e.attachmentDescription ?? null, attachmentBaseUrl: e.attachmentBaseUrl ?? null, attachmentDestinationUrl: e.attachmentDestinationUrl ?? null, pollResults: null, pollTotalVotesCast: null };
        if (e.fileKey) { row.mediaUrl = svg(`Uploaded ${e.mediaType}`, "#3b5b7a"); row.mediaPreviewImageUrl = row.mediaUrl; }
        if (prev) Object.assign(prev, row); else media.push(row);
      }
      const ordered = els.filter((e) => e.indexInPost >= 0).sort((a, b) => a.indexInPost - b.indexInPost);
      const title = els.find((e) => e.indexInPost === -1)?.mediaText ?? null;
      const firstText = ordered.find((e) => e.mediaType === "text")?.mediaText ?? null;
      const anon = !!variables.anonymous;
      const post = Object.assign(editing || { postId: id, rootPostId: null, parentPostId: variables.parentPostId ?? null, depth: 0, isDeleted: false, createdDate: now, commentIds: [], numLikes: 0, numComments: 0, numBookmarks: 0, numUniqueViews: 0, likedByMe: 0, bookmarkedByMe: 0, commentsLocked: 0, promotedPostType: null, hashtagIds: [] }, {
        postGroupId: variables.postGroupId, categoryKey: variables.categoryKey ?? null, quotedPostId: variables.quotedPostId ?? null, clonedPostId: variables.clonedPostId ?? null,
        creatorUserId: anon ? "37a4cf81-47af-46f2-96f0-b6c719366573" : (variables.postAsUserId ?? users[0].userId),
        title, postText: firstText, mediaElementIds: els.map((e) => e.mediaElementId),
        hashtagIds: hashtags.filter((h) => els.some((e) => (e.mediaText ?? "").includes("#" + h.hashtag))).map((h) => h.hashtagId),
        mediaPreviewUrl: media.find((m) => m.postId === id && m.mediaUrl && (m.mediaType === "image" || m.mediaType === "video"))?.mediaUrl ?? null,
        isPublished: pending.length === 0, publishedDate: pending.length ? null : now, pendingFileKeys: pending,
      });
      if (!editing) posts.unshift(post);
      data = { createPost: { success: true, errorMsg: null, errorCode: null, anonymousPostToken: anon ? "mock-anon-token-" + id : null, results: { postId: id }, store: storeFor([post], true) } };
    } else if (op === "getPostUploadStatus") {
      const ps = posts.filter((p) => variables.postIds.includes(p.postId));
      data = { getPostUploadStatus: { success: true, errorMsg: null, errorCode: null, results: ps.map((p) => ({ postId: p.postId, publishedDate: p.publishedDate, isPublished: p.isPublished, isDeleted: p.isDeleted })), store: storeFor(ps, true) } };
    } else if (op === "getMyModeratorStatus") {
      const mine = [groups[0]]; // the signed-in user moderates Interventional Cardiology (groupSettings lists them)
      data = { getMyModeratorStatus: { success: true, errorMsg: null, errorCode: null, results: { myModerationStatuses: mine.map((g) => ({ postGroupId: g.postGroupId, moderators: [{ userId: users[0].userId, canChangeCategory: 1, canPostClones: 1 }] })) } } };
    } else if (op === "getAppSponsorshipModStats") {
      data = { getAppSponsorshipModStats: { success: true, results: { bounties: [
        { sponsorshipBountyId: uuid(1, "b0"), bountyTopicId: uuid(1, "b1"), bountyTopic: "IVUS-guided PCI", bountyProperties: JSON.stringify({ examples: ["stent sizing", "calcium"] }), partnerName: "Acme Imaging", groupName: groups[0].groupName, postGroupId: groups[0].postGroupId, bountyPostValue: 150 },
        { sponsorshipBountyId: uuid(2, "b0"), bountyTopicId: null, bountyTopic: null, bountyProperties: null, partnerName: "Valve Co", groupName: groups[1].groupName, postGroupId: groups[1].postGroupId, bountyPostValue: 75 },
      ] } } };
    } else if (op === "searchForUsernamesThatMatch") {
      const q = (variables.searchText ?? "").toLowerCase();
      data = { searchForUsernamesThatMatch: { success: true, errorMsg: null, errorCode: null, results: { userIds: users.filter((u) => u.username.includes(q) || u.displayName.toLowerCase().includes(q)).map((u) => u.userId) }, store: { users, posts: [], mediaElements: [], hashtags: [], postGroups: [] } } };
    } else if (op === "searchForHashtagsThatMatch") {
      const q = (variables.searchText ?? "").toLowerCase();
      data = { searchForHashtagsThatMatch: { success: true, errorMsg: null, errorCode: null, results: { hashtagIds: hashtags.filter((h) => h.hashtag.toLowerCase().startsWith(q)).map((h) => h.hashtagId) }, store: { users: [], posts: [], mediaElements: [], hashtags, postGroups: [] } } };
    } else if (op === "getOpenGraphValues") {
      data = { getOpenGraphValues: { success: true, errorMsg: null, errorCode: null, results: variables.urls.map((u) => { const host = new URL(u).host; return { title: `Page at ${host}`, description: "A description from the page's Open Graph tags.", image: svg(host, "#1e5c8a"), baseUrl: host, destination: u }; }) } };
    } else if (op === "createPost") {
      const text = (variables.mediaElements ?? []).find((m) => m.mediaType === "text")?.mediaText ?? "";
      const post = mkMsg(variables.postGroupId, ++msgCounter, users[0].userId, text, 0);
      const g = dmGroups.find((x) => x.postGroupId === variables.postGroupId); if (g) { g.lastPostId = post.postId; g.lastPostDate = post.createdDate; }
      data = { createPost: { success: true, errorMsg: null, errorCode: null, results: { postId: post.postId }, store: dmStore([post]) } };
    } else if (op === "createPostGroup") {
      const members = [...new Set([...variables.memberUserIds, users[0].userId])].sort();
      let g = dmGroups.find((x) => [...x.memberUserIds].sort().join() === members.join());
      if (!g) { g = { postGroupId: uuid(dmGroups.length + 1, "d0"), createdDate: new Date().toISOString(), memberUserIds: members, numUnseenMessages: 0, lastPostId: null, lastPostDate: null }; dmGroups.push(g); dmPosts[g.postGroupId] = []; }
      data = { createPostGroup: { success: true, errorMsg: null, errorCode: null, results: { postGroupId: g.postGroupId } } };
    } else if (op === "setLastSeenForPostGroup") {
      const g = dmGroups.find((x) => x.postGroupId === variables.postGroupId); if (g) g.numUnseenMessages = 0;
      data = { setLastSeenForPostGroup: { success: true, errorMsg: null, errorCode: null } };
    } else if (op === "getFollowers") {
      const id = variables.userId; const followingIds = follows[id] ?? []; const followerIds = Object.entries(follows).filter(([, l]) => l.includes(id)).map(([u]) => u);
      data = { getFollowers: { success: true, errorMsg: null, errorCode: null, results: { followingIds, followerIds }, store: { users, posts: [], mediaElements: [], hashtags: [], postGroups: [] } } };
    } else if (op === "followUser") {
      const me = users[0].userId; follows[me] = variables.follow ? [...new Set([...follows[me], variables.userId])] : follows[me].filter((x) => x !== variables.userId);
      data = { followUser: { success: true, errorMsg: null, errorCode: null } };
    } else if (op === "getUsers") {
      data = { getUsers: { success: true, errorMsg: null, errorCode: null, results: { userIds: variables.userIds }, store: { users: users.filter((u) => variables.userIds.includes(u.userId)), posts: [], mediaElements: [], hashtags: [], postGroups: [] } } };
    } else if (op === "getUserProfileCounters") {
      const n = users.findIndex((u) => u.userId === variables.userId) + 1;
      data = { getUserProfileCounters: { success: true, errorMsg: null, errorCode: null, results: { likedPostCount: n * 17, bestAnswerCount: n, postOfTheWeekCount: n - 1 } } };
    } else if (op === "getPostsForUser" || op === "getBookmarkedPostsForUser") {
      const mine = op === "getPostsForUser" ? posts.filter((p) => p.creatorUserId === variables.userId) : posts.filter((p) => p.bookmarkedByMe);
      const sorted = mine.slice().sort((a, b) => b.createdDate.localeCompare(a.createdDate)).filter((p) => !variables.beforeDate || p.createdDate < variables.beforeDate);
      const page = sorted.slice(0, variables.count ?? 10);
      data = { [op]: { success: true, errorMsg: null, errorCode: null, endOfList: sorted.length <= page.length, results: { total: mine.length, postIds: page.map((p) => p.postId) }, store: storeFor(page, false) } };
    } else if (op === "getCVItemsForUser") {
      data = { getCVItemsForUser: { success: true, results: { userId: variables.userId, items: cvItems[variables.userId] ?? [] } } };
    } else if (op === "getCVItemTypes") {
      data = { getCVItemTypes: { success: true, results: { itemTypes: CV_ITEM_TYPES } } };
    } else if (op === "setCVItemsForUser") { // replace-all, as the backend: unknown ids get fresh ones
      const existing = new Set((cvItems[users[0].userId] ?? []).map((i) => i.itemId));
      cvItems[users[0].userId] = variables.items.map((it, i) => ({ itemId: it.itemId && existing.has(it.itemId) ? it.itemId : uuid(1000 + cvSeq++, "e1"), userId: users[0].userId, indexInList: it.indexInList, itemType: it.itemType, title: it.title || null, practiceType: null, discipline: null, companyName: null, location: null, description: it.description || null, start: it.start || null, end: it.end || null, isCurrent: !!it.isCurrent }));
      data = { setCVItemsForUser: { success: true, errorMsg: null, errorCode: null, results: { items: cvItems[users[0].userId] } } };
    } else if (op === "searchUsersForText") {
      const q = (variables.searchText ?? "").toLowerCase();
      data = { searchUsersForText: { success: true, errorMsg: null, errorCode: null, results: { userIds: users.filter((u) => u.displayName.toLowerCase().includes(q) || u.username.includes(q)).map((u) => u.userId) }, store: { users, posts: [], mediaElements: [], hashtags: [], postGroups: [] } } };
    } else if (op === "addUsersToPostGroup" || op === "removeUsersFromPostGroup") {
      const g = dmGroups.find((x) => x.postGroupId === variables.postGroupId);
      if (g) g.memberUserIds = op === "addUsersToPostGroup" ? [...new Set([...g.memberUserIds, ...variables.userIds])] : g.memberUserIds.filter((id) => !variables.userIds.includes(id));
      data = { [op]: { success: true, errorMsg: null, errorCode: null } };
    } else if (op === "updateUser") {
      const me = users[0];
      if (variables.username != null && users.some((u) => u !== me && u.username === variables.username)) {
        data = { updateUser: { success: false, errorMsg: "duplicate username", errorCode: 504, results: {}, store: { users: [], posts: [], mediaElements: [] } } };
      } else {
        for (const k of ["username","firstName","lastName","npi","specialty","location","flair","interests","bio","disclosures"]) if (variables[k] != null) me[k] = variables[k];
        me.displayName = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim() || me.displayName;
        data = { updateUser: { success: true, errorMsg: null, errorCode: null, results: { user: { ...me } }, store: { users: [me], posts: [], mediaElements: [], hashtags: [], postGroups: [] } } };
      }
    } else if (op === "getUploadFileUrls") {
      const fileUrls = variables.requests.map((r, i) => { const key = `${uuid(Date.now() % 100000 + i, "f")}.${(r.contentType ?? "image/jpeg").split("/")[1]}`; return { uploadType: r.uploadType, uploadFileUrl: `http://localhost:${PORT}/files/${key}?sig=mock`, fileKey: key }; });
      data = { getUploadFileUrls: { success: true, errorMsg: null, errorCode: null, results: { fileUrls } } };
    } else if (op === "getProfile" || op === "getProfileForEdit") {
      data = { getProfile: { success: true, errorMsg: null, errorCode: null, results: { user: { ...users[0], numNotifications: notifications.filter((n) => n.seen === 0).length, numDirectMessages: dmGroups.reduce((s, g) => s + g.numUnseenMessages, 0), userClass: "doctor", isAdmin: Number(process.env.MOCK_IS_ADMIN ?? 0), isContentCreator: !!process.env.MOCK_CONTENT_CREATOR } } } };
    } else { data = null; }
    setTimeout(() => { res.writeHead(200, { "Content-Type": "application/json", ...cors }); res.end(JSON.stringify({ data })); }, 150);
  });
}).listen(PORT, () => console.log("mock api on", PORT));

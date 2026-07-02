/**
 * Video catalog for the Videos section prototypes.
 *
 * Shaped to match what the MurmurMD GraphQL API will return for publicly
 * accessible videos, so swapping this module for an Apollo query later is a
 * data-source change, not a UI change. Only two real assets exist so far;
 * the catalog repeats them under varied metadata to exercise the layouts.
 */

export type VideoKind = "LONG_FORM" | "SHORT_FORM";

/**
 * Long-form videos are landscape (16:9); shorts are portrait (9:16).
 * Preview images are assumed to share the video's orientation.
 */
export type VideoOrientation = "LANDSCAPE" | "PORTRAIT";

export interface Video {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: VideoKind;
  orientation: VideoOrientation;
  durationSeconds: number;
  publishedAt: string;
  specialty: string;
  previewImageUrl: string;
  streamUrl: string;
}

const LONG_PREVIEW =
  "https://d3ngaae513epof.cloudfront.net/eyJidWNrZXQiOiJtdXJtdXJtZC5wb3N0dmlkZW9zIiwia2V5IjoicG9zdGVyRnJhbWVzLzdiYjIzNmFmLTAzMTYtNDY0Zi04YmQzLTU0NGFmODg0ODg1Zi5qcGVnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjo2MDAsImhlaWdodCI6NjAwLCJmaXQiOiJpbnNpZGUifX19";
const LONG_STREAM =
  "https://s3.us-west-2.amazonaws.com/murmurmd.postvideos/CMAF/7bb236af-0316-464f-8bd3-544af884885f/stream.m3u8";
const SHORT_PREVIEW =
  "https://d3ngaae513epof.cloudfront.net/eyJidWNrZXQiOiJtdXJtdXJtZC5wb3N0dmlkZW9zIiwia2V5IjoicG9zdGVyRnJhbWVzL2UzNmE3ODNhLTk5ZWUtNDljNy05MjU5LWVlMmUzNTAyMGI3My5qcGVnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjo2MDAsImhlaWdodCI6NjAwLCJmaXQiOiJpbnNpZGUifX19";
const SHORT_STREAM =
  "https://s3.us-west-2.amazonaws.com/murmurmd.postvideos/CMAF/e36a783a-99ee-49c7-9259-ee2e35020b73/stream.m3u8";

function long(
  n: number,
  title: string,
  description: string,
  specialty: string,
  durationSeconds: number,
  publishedAt: string,
): Video {
  return {
    id: `long-${n}`,
    slug: `long-${n}`,
    title,
    description,
    kind: "LONG_FORM",
    orientation: "LANDSCAPE",
    durationSeconds,
    publishedAt,
    specialty,
    previewImageUrl: LONG_PREVIEW,
    streamUrl: LONG_STREAM,
  };
}

function short(
  n: number,
  title: string,
  description: string,
  specialty: string,
  durationSeconds: number,
  publishedAt: string,
): Video {
  return {
    id: `short-${n}`,
    slug: `short-${n}`,
    title,
    description,
    kind: "SHORT_FORM",
    orientation: "PORTRAIT",
    durationSeconds,
    publishedAt,
    specialty,
    previewImageUrl: SHORT_PREVIEW,
    streamUrl: SHORT_STREAM,
  };
}

export const videos: Video[] = [
  long(
    1,
    "Navigating Peer-to-Peer Insurance Denials",
    "Practical strategies for coordinators and physicians when a case gets denied: preparing for the peer-to-peer call, documentation criteria, and NCD coverage nuances.",
    "Interventional Cardiology",
    2340,
    "2026-06-24",
  ),
  short(
    1,
    "Dual PREP: IVL Post Atherectomy",
    "Key takeaways from the Dual-Prep Registry on the safety and efficacy of IVL after rotational or orbital atherectomy in severely calcified lesions.",
    "Interventional Cardiology",
    96,
    "2026-06-26",
  ),
  long(
    2,
    "Calcium Modification Roundtable",
    "A panel discussion on lesion prep strategy: when to reach for IVL, atherectomy, or both, with case examples from high-volume operators.",
    "Interventional Cardiology",
    3125,
    "2026-06-10",
  ),
  short(
    2,
    "OCT-Based Calcification Scoring in 90 Seconds",
    "How to apply the OCT calcification score to pick a lesion-prep strategy before stent implantation.",
    "Interventional Cardiology",
    88,
    "2026-06-12",
  ),
  long(
    3,
    "CTO PCI: Lessons From My Toughest Cases",
    "A veteran operator walks through failed and rescued chronic total occlusion cases, and what each one changed about his approach.",
    "Interventional Cardiology",
    2865,
    "2026-05-28",
  ),
  short(
    3,
    "Radial vs. Femoral: What the Data Actually Says",
    "A rapid review of access-site outcomes and when femoral still wins.",
    "Interventional Cardiology",
    112,
    "2026-05-30",
  ),
  long(
    4,
    "TAVR in Bicuspid Anatomy: Planning and Pitfalls",
    "CT sizing, valve selection, and deployment technique for bicuspid aortic valves, with structural imaging pearls.",
    "Structural Cardiology",
    2710,
    "2026-05-15",
  ),
  short(
    4,
    "One Poll, 400 Cardiologists: Anticoagulation After LAAO",
    "What the MurmurMD community actually does for post-LAAO antithrombotic therapy.",
    "Electrophysiology",
    75,
    "2026-05-18",
  ),
  long(
    5,
    "Pulsed Field Ablation: Early Real-World Experience",
    "Electrophysiologists compare workflows, complication rates, and patient selection a year into PFA adoption.",
    "Electrophysiology",
    2450,
    "2026-04-30",
  ),
  short(
    5,
    "Reading the Post-Atherectomy Angiogram",
    "Sixty seconds on what adequate lesion prep looks like before you commit to a stent.",
    "Interventional Cardiology",
    64,
    "2026-05-02",
  ),
];

export const longFormVideos = videos.filter((v) => v.kind === "LONG_FORM");
export const shortFormVideos = videos.filter((v) => v.kind === "SHORT_FORM");

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatPublishedAt(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

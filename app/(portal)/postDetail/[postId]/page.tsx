import type { Metadata } from "next";

import BackButton from "@/components/portal/back-button";
import PortalPageHeader from "@/components/portal/page-header";
import PostDetail from "@/components/portal/post-detail";

export const metadata: Metadata = { title: "Post" };

/**
 * Full view of one post, as a page rather than a modal over the feed. The
 * post itself loads in the browser from the entity store, so nothing here
 * depends on the request beyond the id.
 */
export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return (
    <>
      <PortalPageHeader title="Post" leading={<BackButton />} />
      <PostDetail postId={postId} />
    </>
  );
}

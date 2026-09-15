"use client";

import { useEffect, useRef } from "react";

import { useMembers } from "@/lib/portal/groups";
import { usePostGroup } from "@/lib/portal/store";

import BackButton from "./back-button";
import { PortalError } from "./feed";
import { PersonRow } from "./group-details";
import PortalPageHeader from "./page-header";

/** GroupMembersView: members 30 at a time, each a link to their profile. */
export default function GroupMembers({ postGroupId }: { postGroupId: string }) {
  const group = usePostGroup(postGroupId);
  const members = useMembers(postGroupId);
  const sentinel = useRef<HTMLLIElement>(null);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = members;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const ids = [
    ...new Set((members.data?.pages ?? []).flatMap((p) => p.userIds)),
  ];

  return (
    <>
      <PortalPageHeader
        title={group?.groupName ?? "Members"}
        leading={<BackButton fallback={`/groups/${postGroupId}`} />}
      />
      {members.status === "pending" && (
        <p className="text-muted-foreground px-4 py-8">Loading...</p>
      )}
      {members.isError && !members.data && (
        <PortalError error={members.error} retry={() => members.refetch()} />
      )}
      {members.status === "success" && ids.length === 0 && (
        <p className="text-muted-foreground px-4 py-8">
          There aren&apos;t any members yet
        </p>
      )}
      {ids.length > 0 && (
        <ul className="px-2 py-2">
          {ids.map((id) => (
            <li key={id}>
              <PersonRow userId={id} />
            </li>
          ))}
          <li ref={sentinel} aria-hidden />
          {isFetchingNextPage && (
            <li className="text-muted-foreground px-2 py-3 text-sm">
              Loading...
            </li>
          )}
        </ul>
      )}
    </>
  );
}

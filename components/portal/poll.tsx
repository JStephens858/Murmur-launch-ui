"use client";

import { CheckCircle2 } from "lucide-react";

import {
  NULL_OPTION_ID,
  pollOptions,
  tally,
  usePollResults,
  useSelectPollOption,
} from "@/lib/portal/polls";
import type { PortalMediaElement } from "@/lib/portal/types";
import { cn } from "@/lib/utils";

/**
 * A poll media element, following the app's PollView: until the reader
 * has chosen, one outlined button per option plus "Just show the Results";
 * afterwards a bar per option with its percentage, a check on the reader's
 * own choice, the vote total, and the anonymity note. Votes can't be
 * changed. Results load once when the poll appears; the vote response
 * carries the new counts.
 */
export default function PollElement({
  element,
}: {
  element: PortalMediaElement;
}) {
  const options = pollOptions(element);
  const results = usePollResults(element.mediaElementId);
  const vote = useSelectPollOption(element.mediaElementId);
  const voted = results.data?.usersSelection != null;

  return (
    <div className="border-border/60 bg-card/50 flex flex-col gap-3 rounded-2xl border p-4">
      {element.mediaText && <p className="font-medium">{element.mediaText}</p>}

      {results.status === "pending" && (
        <ul
          className="flex animate-pulse flex-col gap-2"
          aria-busy="true"
          aria-label="Loading poll"
        >
          {options.map((o) => (
            <li key={o.id} className="bg-muted h-10 rounded-lg" />
          ))}
        </ul>
      )}

      {results.status === "error" && (
        <p className="text-destructive-foreground text-sm">
          Couldn&apos;t load this poll.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => results.refetch()}
          >
            Try again
          </button>
        </p>
      )}

      {results.data && !voted && (
        <ul className="flex flex-col gap-2">
          {[
            ...options,
            { id: NULL_OPTION_ID, text: "Just show the Results" },
          ].map((o) => (
            <li key={o.id}>
              <button
                type="button"
                disabled={vote.isPending}
                onClick={() => vote.mutate(o.id)}
                className={cn(
                  "border-primary/60 text-primary hover:bg-primary/10 w-full rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors disabled:opacity-60",
                  o.id === NULL_OPTION_ID &&
                    "text-muted-foreground border-border/60 hover:bg-muted",
                )}
              >
                {o.text}
              </button>
            </li>
          ))}
        </ul>
      )}

      {results.data && voted && (
        <PollResultsList options={options} results={results.data} />
      )}

      {vote.isError && (
        <p className="text-destructive-foreground text-sm">
          {vote.error instanceof Error
            ? vote.error.message
            : "Couldn't record your vote."}
        </p>
      )}

      <p className="text-muted-foreground text-xs">
        * Poll responses are anonymous
      </p>
    </div>
  );
}

function PollResultsList({
  options,
  results,
}: {
  options: ReturnType<typeof pollOptions>;
  results: NonNullable<ReturnType<typeof usePollResults>["data"]>;
}) {
  const { rows, total } = tally(options, results);
  return (
    <>
      <ul className="flex flex-col gap-2" aria-label="Poll results">
        {rows.map((row) => (
          <li key={row.id} className="relative overflow-hidden rounded-lg">
            {/* Bar. Width is data-derived, so it has to be inline. */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-lg",
                row.winner ? "bg-primary/30" : "bg-foreground/15",
              )}
              style={{ width: `${row.percent}%` }}
              aria-hidden
            />
            <div className="relative flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-12 shrink-0 text-right font-bold tabular-nums">
                {row.percent}%
              </span>
              <span className="flex-1">{row.text}</span>
              <CheckCircle2
                className={cn(
                  "size-5 shrink-0",
                  row.mine ? "text-primary" : "invisible",
                )}
                aria-label={row.mine ? "Your choice" : undefined}
                aria-hidden={!row.mine}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-sm">
        {total} {total === 1 ? "vote" : "votes"}
      </p>
    </>
  );
}

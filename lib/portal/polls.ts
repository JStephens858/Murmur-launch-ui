import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { PortalApiError, portalQuery } from "./graphql";
import type { MurmurResponse, PortalMediaElement } from "./types";

/**
 * Polls, as the app does them (PollView.swift, DataStore.ingestPollResults):
 * the question is the element's mediaText and the options are a JSON array
 * in its `properties`; counts and the reader's own choice come from
 * getPollResults, fetched once when the poll shows; voting is
 * selectPollOption, whose response carries the new counts. There is no
 * way to change or withdraw a vote. "Just show the Results" is a vote for
 * the null UUID: it reveals the tallies without counting toward them.
 */

export const NULL_OPTION_ID = "00000000-0000-0000-0000-000000000000";

export interface PollOption {
  id: string;
  text: string;
}

/** Options in authoring order, from the element's properties JSON. */
export function pollOptions(element: PortalMediaElement): PollOption[] {
  if (element.mediaType !== "poll" || !element.properties) return [];
  try {
    const parsed: unknown = JSON.parse(element.properties);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (o): o is { id: string; text: string } =>
          typeof o === "object" &&
          o !== null &&
          typeof o.id === "string" &&
          typeof o.text === "string",
      )
      .map((o) => ({ id: o.id.toLowerCase(), text: o.text }));
  } catch {
    return [];
  }
}

export interface PollResults {
  /** The reader's choice; NULL_OPTION_ID when they asked to see results. */
  usersSelection: string | null;
  /** Votes per option id (lowercased); options without votes are absent. */
  counts: Record<string, number>;
}

interface PollResultsPayload {
  usersSelection: string | null;
  pollResults: { optionId: string; count: number }[];
}

function toResults(r: PollResultsPayload): PollResults {
  const counts: Record<string, number> = {};
  for (const row of r.pollResults)
    counts[row.optionId.toLowerCase()] = row.count;
  return { usersSelection: r.usersSelection?.toLowerCase() ?? null, counts };
}

const GET_POLL_RESULTS = /* GraphQL */ `
  query getPollResults($mediaElementId: ID!) {
    getPollResults(mediaElementId: $mediaElementId) {
      success
      errorMsg
      errorCode
      results {
        mediaElementId
        usersSelection
        pollResults {
          optionId
          count
        }
      }
    }
  }
`;

const SELECT_POLL_OPTION = /* GraphQL */ `
  mutation selectPollOption($mediaElementId: ID!, $optionId: ID!) {
    selectPollOption(mediaElementId: $mediaElementId, optionId: $optionId) {
      success
      errorMsg
      errorCode
      results {
        mediaElementId
        usersSelection
        pollResults {
          optionId
          count
        }
      }
    }
  }
`;

type PollResponse = MurmurResponse & { results: PollResultsPayload | null };

export const pollResultsKey = (mediaElementId: string) =>
  ["pollResults", mediaElementId] as const;

export function pollResultsOptions(mediaElementId: string) {
  return queryOptions({
    queryKey: pollResultsKey(mediaElementId),
    queryFn: async (): Promise<PollResults> => {
      const data = await portalQuery<{ getPollResults: PollResponse }>(
        GET_POLL_RESULTS,
        {
          mediaElementId,
        },
      );
      const res = data.getPollResults;
      if (!res.success || !res.results) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't load poll results",
          res.errorCode,
        );
      }
      return toResults(res.results);
    },
    staleTime: 5 * 60_000,
  });
}

export function usePollResults(mediaElementId: string) {
  return useQuery(pollResultsOptions(mediaElementId));
}

export function useSelectPollOption(mediaElementId: string) {
  const client = useQueryClient();
  const key = pollResultsKey(mediaElementId);
  return useMutation({
    mutationFn: async (optionId: string): Promise<PollResults> => {
      const data = await portalQuery<{ selectPollOption: PollResponse }>(
        SELECT_POLL_OPTION,
        {
          mediaElementId,
          optionId,
        },
      );
      const res = data.selectPollOption;
      if (!res.success || !res.results) {
        throw new PortalApiError(
          res.errorMsg ?? "Couldn't record your vote",
          res.errorCode,
        );
      }
      return toResults(res.results);
    },
    // Reveal the results at once, as the app does, counting the new vote.
    onMutate: async (optionId) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<PollResults>(key);
      const counts = { ...(previous?.counts ?? {}) };
      if (optionId !== NULL_OPTION_ID)
        counts[optionId] = (counts[optionId] ?? 0) + 1;
      client.setQueryData<PollResults>(key, {
        usersSelection: optionId,
        counts,
      });
      return { previous };
    },
    onSuccess: (results) => client.setQueryData(key, results),
    // Unlike the app, put the buttons back if the vote didn't take.
    onError: (_error, _optionId, context) =>
      client.setQueryData(key, context?.previous),
  });
}

export interface TalliedOption extends PollOption {
  count: number;
  /** Truncated, as the app computes it, so a set can sum below 100. */
  percent: number;
  winner: boolean;
  mine: boolean;
}

/** Joins options with counts: every option renders, ties all win. */
export function tally(
  options: PollOption[],
  results: PollResults,
): {
  rows: TalliedOption[];
  total: number;
} {
  const total = options.reduce(
    (sum, o) => sum + (results.counts[o.id] ?? 0),
    0,
  );
  const most = Math.max(0, ...options.map((o) => results.counts[o.id] ?? 0));
  const rows = options.map((o) => {
    const count = results.counts[o.id] ?? 0;
    return {
      ...o,
      count,
      percent: total > 0 ? Math.floor((100 * count) / total) : 0,
      winner: total > 0 && count === most,
      mine: results.usersSelection === o.id,
    };
  });
  return { rows, total };
}

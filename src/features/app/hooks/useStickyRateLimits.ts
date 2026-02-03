import { useCallback, useEffect, useRef } from "react";

import type { RateLimitSnapshot } from "../../../types";
import {
  loadRateLimitCache,
  saveRateLimitCache,
} from "../../threads/utils/threadStorage";

type RateLimitMap = Record<string, RateLimitSnapshot | null | undefined>;

export function useStickyRateLimits(
  rateLimitsByWorkspace: RateLimitMap,
  workspaceIds: string[],
) {
  const cacheRef = useRef<Map<string, RateLimitSnapshot>>(
    new Map(
      Object.entries(loadRateLimitCache()).filter(
        ([, value]) => value && typeof value === "object",
      ) as Array<[string, RateLimitSnapshot]>,
    ),
  );
  const hasRateLimitData = (snapshot: RateLimitSnapshot | null | undefined) =>
    Boolean(snapshot?.primary || snapshot?.secondary || snapshot?.credits);

  useEffect(() => {
    const cache = cacheRef.current;
    let didChange = false;
    for (const [workspaceId, snapshot] of Object.entries(rateLimitsByWorkspace)) {
      if (snapshot && hasRateLimitData(snapshot)) {
        cache.set(workspaceId, snapshot);
        didChange = true;
      }
    }

    if (workspaceIds.length) {
      const activeIds = new Set(workspaceIds);
      for (const workspaceId of cache.keys()) {
        if (!activeIds.has(workspaceId)) {
          cache.delete(workspaceId);
          didChange = true;
        }
      }
    }
    if (didChange) {
      saveRateLimitCache(Object.fromEntries(cache.entries()));
    }
  }, [rateLimitsByWorkspace, workspaceIds]);

  const getRateLimits = useCallback(
    (workspaceId: string | null) => {
      if (!workspaceId) {
        return null;
      }
      const live = rateLimitsByWorkspace[workspaceId] ?? null;
      if (hasRateLimitData(live)) {
        return live;
      }
      return cacheRef.current.get(workspaceId) ?? null;
    },
    [rateLimitsByWorkspace],
  );

  return { getRateLimits };
}

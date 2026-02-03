import { useCallback, useEffect, useRef } from "react";

import type { RateLimitSnapshot } from "../../../types";

type RateLimitMap = Record<string, RateLimitSnapshot | null | undefined>;

export function useStickyRateLimits(
  rateLimitsByWorkspace: RateLimitMap,
  workspaceIds: string[],
) {
  const cacheRef = useRef<Map<string, RateLimitSnapshot>>(new Map());

  useEffect(() => {
    const cache = cacheRef.current;
    for (const [workspaceId, snapshot] of Object.entries(rateLimitsByWorkspace)) {
      if (snapshot) {
        cache.set(workspaceId, snapshot);
      }
    }

    if (workspaceIds.length) {
      const activeIds = new Set(workspaceIds);
      for (const workspaceId of cache.keys()) {
        if (!activeIds.has(workspaceId)) {
          cache.delete(workspaceId);
        }
      }
    }
  }, [rateLimitsByWorkspace, workspaceIds]);

  const getRateLimits = useCallback(
    (workspaceId: string | null) => {
      if (!workspaceId) {
        return null;
      }
      return (
        rateLimitsByWorkspace[workspaceId] ??
        cacheRef.current.get(workspaceId) ??
        null
      );
    },
    [rateLimitsByWorkspace],
  );

  return { getRateLimits };
}

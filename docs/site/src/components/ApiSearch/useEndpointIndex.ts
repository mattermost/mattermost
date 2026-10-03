import {useCallback, useEffect, useState} from 'react';
import type {Endpoint} from './search';

export type EndpointIndex = {
  /** Undefined until the index resolves; empty array if it held no endpoints. */
  endpoints?: Endpoint[];

  /** True once a load attempt has failed and no index is in hand. */
  failed: boolean;

  /** Starts a fresh load attempt; no-op while one is in flight or done. */
  retry: () => void;
};

/** Shared across mounts, so the sidebar remounting doesn't refetch. */
let cache: Endpoint[] | undefined;

/**
 * Loads the generated endpoint index (data/api-search-index.json, built by
 * scripts/gen-api-search-index.mjs).
 *
 * The index is ~100 KB of JSON, so it's pulled in with a dynamic import:
 * webpack splits it into its own chunk that only the API pages ever fetch,
 * instead of adding it to every page's bundle.
 */
export default function useEndpointIndex(): EndpointIndex {
  const [endpoints, setEndpoints] = useState<Endpoint[] | undefined>(cache);
  const [failed, setFailed] = useState(false);
  // Bumping this re-runs the effect, which is what makes `retry` work.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache) {
      return undefined;
    }

    let cancelled = false;

    // @ts-ignore — generated build output, see docs/site/.gitignore.
    import('@site/data/api-search-index.json')
      .then((module) => {
        const data = (module.default ?? module) as {endpoints?: Endpoint[]};
        cache = data.endpoints ?? [];
        if (!cancelled) {
          setEndpoints(cache);
          setFailed(false);
        }
      })
      .catch((error) => {
        // Chunk loads fail for transient reasons — a dropped connection, or a
        // stale hashed URL after a redeploy. Surface it so the box can say
        // search is unavailable and offer a retry, rather than sitting on
        // "Loading endpoints…" until someone reloads the page.
        console.error('[api-search] could not load the endpoint index', error);
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  return {endpoints, failed, retry};
}

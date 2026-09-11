import {useEffect, useState} from 'react';
import type {Endpoint} from './search';

/**
 * Loads the generated endpoint index (data/api-search-index.json, built by
 * scripts/gen-api-search-index.mjs).
 *
 * The index is ~100 KB of JSON, so it's pulled in with a dynamic import:
 * webpack splits it into its own chunk that only the API pages ever fetch,
 * instead of adding it to every page's bundle. Module-level `cache` keeps
 * it out of the network a second time when the sidebar remounts.
 */
let cache: Endpoint[] | undefined;

export default function useEndpointIndex(): Endpoint[] | undefined {
  const [endpoints, setEndpoints] = useState<Endpoint[] | undefined>(cache);

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
        }
      })
      .catch((error) => {
        // Leaves the box in its loading state rather than breaking the page.
        console.error('[api-search] could not load the endpoint index', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return endpoints;
}

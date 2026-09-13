/**
 * Matching and ranking for the API endpoint search.
 *
 * Kept free of React so the scoring can be reasoned about (and exercised)
 * on its own. The index it runs over is built at build time by
 * scripts/gen-api-search-index.mjs.
 */

export type Endpoint = {
  /** Docs id, e.g. `reference/get-user` — the page lives at `/api/<id>`. */
  id: string;
  method: string;
  path: string;
  /** Operation summary; the same text the sidebar uses as the label. */
  title: string;
  tag: string;
  deprecated?: boolean;
};

export type SearchResult = {
  endpoint: Endpoint;
  score: number;
};

/** Verbs a leading query token is read as a method filter, e.g. `post channel`. */
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

const MAX_RESULTS = 50;

export type ParsedQuery = {
  /** Uppercased method if the query led with a verb, else undefined. */
  method?: string;
  /** Remaining tokens, lowercased; every one must match. */
  tokens: string[];
};

/**
 * Splits a raw query into an optional method filter and the tokens that have
 * to match. A leading verb is read as a filter, so `post channel` means
 * "POST endpoints mentioning channel" and a bare `delete` lists every
 * DELETE endpoint.
 */
export function parseQuery(raw: string): ParsedQuery {
  const tokens = raw.toLowerCase().split(/\s+/).filter(Boolean);

  if (tokens.length > 0 && METHODS.has(tokens[0]!)) {
    return {method: tokens[0]!.toUpperCase(), tokens: tokens.slice(1)};
  }

  return {tokens};
}

/**
 * Score one token against one endpoint, or 0 when it doesn't match at all.
 *
 * The ladder encodes where readers expect a hit to come from: they type
 * fragments of the URL they're calling first, the summary they saw in the
 * sidebar second, and the resource group only as a fallback.
 */
function scoreToken(token: string, endpoint: Endpoint): number {
  const path = endpoint.path.toLowerCase();
  const title = endpoint.title.toLowerCase();
  const tag = endpoint.tag.toLowerCase();

  const pathIndex = path.indexOf(token);
  if (pathIndex !== -1) {
    // A hit at the start of a path segment (`/users`, `/{user_id}`) is what
    // someone pasting part of a URL means; mid-word is a weaker signal. A
    // token that itself opens with a slash lands on a boundary by
    // definition, wherever in the path it matched.
    const startsSegment =
      pathIndex === 0 || token.startsWith('/') || '/{_-'.includes(path[pathIndex - 1]!);
    return startsSegment ? 60 : 40;
  }

  const titleIndex = title.indexOf(token);
  if (titleIndex !== -1) {
    const startsWord = titleIndex === 0 || /[\s\-_/(]/.test(title[titleIndex - 1]!);
    return startsWord ? 30 : 20;
  }

  if (tag.includes(token)) {
    return 10;
  }

  return 0;
}

/** Returns null when the endpoint isn't a match at all (scores can go negative). */
function scoreEndpoint(query: ParsedQuery, endpoint: Endpoint): number | null {
  if (query.method && endpoint.method !== query.method) {
    return null;
  }

  let score = 0;
  for (const token of query.tokens) {
    const tokenScore = scoreToken(token, endpoint);
    if (tokenScore === 0) {
      return null; // Every token has to land somewhere.
    }
    score += tokenScore;
  }

  // A method-only query ("delete") has nothing else to rank by; give every
  // surviving endpoint the same base so the path tie-break orders them.
  if (query.tokens.length === 0) {
    score = 1;
  }

  const joined = query.tokens.join(' ');
  if (joined && endpoint.path.toLowerCase() === joined) {
    score += 200;
  }

  // Among equally-matching endpoints the shorter path is the more general
  // one (`/users` before `/users/{user_id}/sessions/revoke/all`), which is
  // almost always what a short query is after.
  score -= endpoint.path.length * 0.05;

  if (endpoint.deprecated) {
    score -= 25;
  }

  return score;
}

/**
 * Runs `rawQuery` over the index and returns the best `limit` matches, plus
 * the unclipped match count so the UI can say "top 50 of 171". An empty or
 * whitespace-only query matches nothing rather than everything.
 */
export function searchEndpoints(
  endpoints: readonly Endpoint[],
  rawQuery: string,
  limit: number = MAX_RESULTS,
): {results: SearchResult[]; total: number} {
  const query = parseQuery(rawQuery);

  if (!query.method && query.tokens.length === 0) {
    return {results: [], total: 0};
  }

  const matches: SearchResult[] = [];
  for (const endpoint of endpoints) {
    const score = scoreEndpoint(query, endpoint);
    if (score !== null) {
      matches.push({endpoint, score});
    }
  }

  matches.sort(
    (a, b) =>
      b.score - a.score ||
      a.endpoint.path.localeCompare(b.endpoint.path) ||
      a.endpoint.method.localeCompare(b.endpoint.method),
  );

  return {results: matches.slice(0, limit), total: matches.length};
}

# Entities: parse on read

Status: implemented on branch `plan/entities`. Replaces the storage model in
[entities-implementation.md](entities-implementation.md) sections 4–6 and the
`PostEntities` table in [entities-framework.md](entities-framework.md) section
6.4. The feature stays off unless `MM_ENTITIES=1` or the Enterprise feature
flag is set.

## 1. Decision

Delete `postentities`, `entitydictionaries`, and `entityterms`, and do not ship
migrations `000236` and `000237`. The server computes entities while it
prepares a post for the client. The platform cache, LRU or Redis according to
`CacheSettings.CacheType`, holds the pattern spans so another app node and a
restarted process do not scan them again. There is no process-local pattern
memo and no realtime dictionary websocket. Postgres is not on the entity read
path and not on the entity write path.

Exact terms already work this way. `ApplyTerms` reads the in-memory dictionary
on every response and never reads a row. Pattern spans are a cache of a regex
scan. A cold page with a few matchers is on the order of tens of milliseconds;
a platform-cache hit avoids repeating that scan across nodes and restarts.

## 2. What each table was for

`postentities` stored pattern spans. `entitydictionaries` and `entityterms`
stored the exact-term list. Those tables are gone. Plugins register types,
matchers, and terms into process memory on activate. Dictionary and pattern
hashes ride the post etag so clients refetch on the next channel or thread
load after a change.

## 3. Read path

`preparePostForClient` still calls `hydratePostEntities`. Nothing is skipped
that is skipped today: empty message, deleted post, burn-on-read, `system_*`,
and `custom_*` other than the two Tactical Fusion types that stay eligible.

For each eligible post on a page:

1. Look up pattern spans in the platform cache by post id and message hash
   (`GetMulti` once per page).
2. When the stored generation matches the process generation, run `ApplyTerms`
   with the stored protected ranges and then `Present`.
3. When the entry is missing or the generation differs, scan on the request
   inside the page budget. A finished scan is written to the platform cache
   off the request. An incomplete scan is not written. A post the budget does
   not reach is returned with no entities and is not stored.

`ApplyTerms` stays a separate step so a dictionary change does not scan the
message again. The cache value is the pattern detection, not the merged list:

```
patternEntry{
    generation string
    protected  [][2]int
    patterns   []*PostEntity
}
```

`Present` still runs after the merge, on the request, so channel scope and
`SkipBots` follow the reader.

An edit changes the message hash, so the lookup misses. The previous entry
stays until eviction and is never returned for the new text.

One post is scanned once per process at a time (`singleflight`, keyed by post
id, hash, and generation). Scans on one page run a few at a time and share
the page budget. A matcher change invalidates by generation: the next read
rescans rather than serving stale spans in the background.

## 4. Constraints

### Validation cannot hold the post list

`EntityValidate` runs the way `EntityLookup` already does: the RPC is in a
goroutine, and the server stops waiting on the request context or the page
deadline. Successful accepts stay in a short validate cache keyed by
generation. A plugin whose environment is missing is remembered as unavailable
for about 10 seconds.

### Incomplete scans are not cached

An incomplete result is returned for that request and omitted from the
platform cache so a node with a stopped plugin cannot hide a finished entry
from the rest of the cluster. The response omits the entity etag so clients
do not 304 on an incomplete page.

### The dictionary epoch is a hash

`TermEpoch` is a hash of the sorted terms. Re-registering the same list on
activate does not change the etag.

## 5. Dictionary

Plugins register types, matchers, and the full term list from `OnActivate`,
on every app node. The dictionary lives in that process. There is no
`LoadTerms` and no dictionary websocket. Clients pick up term and matcher
changes when they next fetch posts whose etag includes the new hashes.

`RemovePlugin` drops that plugin's types, matchers, and terms and recomputes
both hashes. Other nodes keep matching until their own deactivation runs.

## 6. Shared pattern cache

One cache, name `entity_pattern`, created with `CacheProvider().NewCache`,
the same seam as `entity_card`. `CacheSettings.CacheType` picks the backend.

The key is the post id and the message hash. Terms stay out of it. A page
that misses calls `GetMulti` once. Writes leave the request through a bounded
background worker. TTL for a finished entry is 24 hours.

## 7. ETags

`AppendEntityEtag` appends the pattern hash, the dictionary hash, and the
provider hash when the feature is on. Incomplete or budget-exhausted pages
omit the etag so clients refetch. There is no `entities_dictionary_changed`
event and no `POST /api/v4/entities/posts` batch refresh.

## 8. Removed

- Migrations `000236_create_post_entities` and `000237_create_entity_terms`.
- `PostEntityStore` and `EntityTermStore`.
- `LoadTerms`, process pattern/applied memos, background stale-generation
  refresh, `entities_dictionary_changed`, and `POST /api/v4/entities/posts`.

## 9. Unchanged

- The message is not rewritten. Entities are metadata on the read model.
- Matcher, term, and scan limits.
- One provider per type, the card cache, and the card routes.
- The feature flag and `MM_ENTITIES=1`.

## 10. Out of scope

The side panel's related-card request, the rich-card check, markdown
placeholders, and right-hand-side history are webapp defects in the current
branch. They do not depend on these tables. This change does not fix them.

# Entities: parse on read

Status: implemented on branch `plan/entities`. Replaces the storage model in
[entities-implementation.md](entities-implementation.md) sections 4–6 and the
`PostEntities` table in [entities-framework.md](entities-framework.md) section
6.4. The feature stays off unless `MM_ENTITIES=1` or the Enterprise feature
flag is set.

Reviewed against the current scan path by Fable, and the shared cache in
section 7 was reviewed the same way. Both sets of constraints are part of the
design, not follow-up work.

## 1. Decision

Delete `postentities`, `entitydictionaries`, and `entityterms`, and do not ship
migrations `000236` and `000237`. The server computes entities while it
prepares a post for the client. A process memo answers a warm page. The
platform cache, LRU or Redis according to `CacheSettings.CacheType`, holds
the pattern spans so another app node and a restarted process do not scan
them again. Postgres is not on the entity read path and not on the entity
write path.

Exact terms already work this way. `ApplyTerms` reads the in-memory dictionary
on every response and never reads a row. The dictionary table only reloads
that memory at startup. Pattern rows are a cache of a regex scan. A warm
process already skips them: the page benchmark on this branch is 13µs from the
memo, 1.14ms for one `GetMany` of a 60-post page, and about 48ms to scan that
page cold with three matchers and one-line messages. The row exists to avoid
repeating the cold scan on another request, another app node, and after a
restart.

## 2. What each table is for today

`postentities` stores pattern spans only: post id, channel id, message hash,
pattern generation, protected ranges, entities, a skipped flag, and
`updateat`. `hydratePostList` loads them by post id when the process memo
misses.

- Hash and generation match: apply the current dictionary and return. No write.
- Hash matches and the generation is older: return those spans plus the
  dictionary, and rescan in the background. Four scans run at once.
- Anything else: scan on the request, and write the pattern spans when the
  scan finishes. An incomplete scan is not written.

`entitydictionaries` and `entityterms` store the exact-term list and a
per-type generation. `Server.Start` loads them before plugins activate.
`RegisterPluginEntityTerms` updates memory, then Postgres, and rolls memory
back when the write fails. A row lock refuses an older generation.
Deactivation deletes that plugin's rows. No post read queries these tables.

## 3. Read path

`preparePostForClient` still calls `hydratePostEntities`. Nothing is skipped
that is skipped today: empty message, deleted post, burn-on-read, `system_*`,
and `custom_*` other than the two Tactical Fusion types that stay eligible.

For each eligible post:

1. Look up pattern spans by post id and message hash.
2. When the stored generation matches the process generation, and the entry
   is not an incomplete result still inside its TTL, run `ApplyTerms` with
   the stored protected ranges and then `Present`.
3. When the entry exists and the generation differs, do the same with the old
   spans, and refresh that entry in the background. The reader does not wait.
   This is the path a matcher change uses today when a row is already stored.
4. When the entry is missing, look in the platform cache (section 7), then
   scan on the request, inside the page budget in section 4. A finished scan
   is stored in the memo and written to the platform cache off the request.
   An incomplete scan is stored in the memo only, for a short TTL. A post the
   budget does not reach is returned with no entities and is not stored.

`ApplyTerms` stays a separate step so a dictionary change does not scan the
message again. The cache value is the pattern detection, not the merged list:

```
patternEntry{
    generation string
    protected  [][2]int
    patterns   []*PostEntity
    incomplete bool
    until      int64
}
```

`ApplyTerms` needs `protected`. Caching only the final spans lets a later
dictionary pass underline inside code, links, and mentions. `Present` still
runs after the merge, on the request, so channel scope and `SkipBots` follow
the reader.

An edit changes the message hash, so the lookup misses. The previous entry
stays until eviction and is never returned for the new text.

One post is scanned once per process at a time (`singleflight`, keyed by post
id, hash, and generation). A page does not wait for posts one after another.
Scans on one page run a few at a time and share the page budget. The same post
opened twice at once shares one scan.

Background refresh keeps the current cap of four scans per process. It writes
the memo and publishes nothing. The next read of that post sees the new
generation. Clients that already hold the post learn about a matcher change
from the etag, the same way they do today.

## 4. Constraints from review

### Validation cannot hold the post list

`EntityValidate` is a plugin RPC with no deadline. The 2 second budget is
checked between calls, so one plugin that accepts the call and stalls holds
the post-list request. `hydratePostList` then walks the page serially, so a
slow plugin is paid once per post. With a table that cost is paid once per
post per cluster. Without a table it is paid on every node, after every
restart, and after every memo eviction.

`EntityValidate` runs the way `EntityLookup` already does: the RPC is in a
goroutine, and the server stops waiting on the request context or the
deadline. The goroutine may outlive the wait. That is the same bound the card
lookup already accepts.

The deadline is one budget for the page, taken once in `hydratePostList`,
not two seconds times the number of posts. The page also caps how many
validate calls it will start. Past either limit the remaining posts are
returned without entities and are not stored as a successful scan.

### An incomplete scan is remembered briefly

A plugin that is down, or a scan that hits the cap, sets `incomplete` today
and is not saved. The next read tries again immediately. `singleflight` also
shares the leader's cancelled result with every waiter. On a parse-on-read
path that is a retry storm for every visible post.

An incomplete result is stored in the process memo for 15 to 30 seconds. It
is not written to the platform cache. A node whose plugin is down must not
overwrite a finished entry that another node stored. A plugin whose
environment is missing is remembered as unavailable for about 10 seconds, and
further validates for that plugin are not started. A successful accept stays
in the existing 30 second validate cache. The next read after the TTL scans
again.

### A matcher change still has something to show

Keying the memo on the generation throws away every entry when a matcher is
added or removed, and the request has nothing to serve while it rescans. The
entry is keyed by post id and message hash, and the generation is a field.
A mismatch serves the previous spans plus the current dictionary, then
refreshes in the background.

A process that has never seen the post scans it on the request, inside the
page budget. There is no older copy to serve. That is the cold-node cost, and
it is paid once per post per process until the entry is evicted.

### The dictionary epoch is a hash

`TermEpoch` is a counter. Two nodes can hold different dictionaries at the
same count, return the same etag, and a client keeps a stale page.
`PatternGeneration` is already a hash of the matchers and matches across
nodes. `TermEpoch` becomes a hash of the sorted terms: type, value, title,
url, and display name. Re-registering the same list on activate does not
change the etag and does not publish `entities_dictionary_changed`.

### The card check does not validate again

`GetEntityCardFromPost` and `GetEntityCardForPost` keep calling
`hydratePostEntities`, so the spans the card sees are the spans the post
showed. One difference: the occurrence check runs detection with an accept
function that returns true. The pattern match is what proves the value is on
a post the caller can read. `EntityLookup` remains the authority for the card
body. A slow validate must not turn a visible underline into a 404.

## 5. Dictionary

Plugins register types, matchers, and the full term list from `OnActivate`,
on every app node. The dictionary lives in that process. There is no
`LoadTerms`, no startup query, and no store error to roll back.

`Server.Start` calls `Channels().Start`, which waits for every plugin
`Activate` to return, and only then listens. A cold boot does not serve a
channel page before registration. The gap is a plugin restarted or upgraded
on a server that is already listening: that node matches nothing from the
plugin until `OnActivate` returns. The table does not cover that window
either. Deactivation already deletes the rows, and `LoadTerms` does not run
again.

`RemovePlugin` drops that plugin's types, matchers, and terms and recomputes
both hashes. Other nodes keep matching until their own deactivation runs.
Matchers already behave that way, because pattern rows are hidden from memory
state and the dictionary read path never hit Postgres.

A plugin disabled in config no longer leaves terms behind. `LoadTerms` does
that today: it installs rows for a plugin that will not activate, and the
word scan still matches them.

## 6. Memo

The pattern memo stays the first tier, in front of both the LRU and the Redis
backend. It holds the list after `ApplyTerms`, keyed by post id, message
hash, and dictionary hash, and returns a clone. That is the 13µs page. A
platform-cache hit still decodes the stored spans and runs `ApplyTerms`, and
with client-side Redis caching disabled it is a network round trip. The LRU
backend is the same shape: each key takes the write lock and decodes. The
memo is what keeps a warm page off that path.

Cap stays on the order of the current 8,192 entries, with two changes because
a miss is now a scan rather than a primary-key read:

- A hit moves the entry to the back of the eviction order. The current ring
  does not, so a hot post leaves after 8,192 later inserts whether or not it
  was just served.
- The cap is on bytes as well as entries. A post with no matches stores an
  empty entry and that is worth keeping. A full post is up to 100 entities.

Empty results are stored. A channel of ordinary messages should hit the memo
on the second view.

A matcher change keeps the old memo entry until the background refresh
replaces it. A dictionary change misses the memo, because the dictionary
hash is part of its key, and is served from the pattern tier plus a fresh
`ApplyTerms`. It does not scan.

## 7. Shared pattern cache

One cache, name `entity_pattern`, created with `CacheProvider().NewCache`,
the same seam as `entity_card`. `CacheSettings.CacheType` picks the backend.
LRU when the server is in-memory. Redis when the server is already configured
for Redis. Redis requires the cluster feature on the license, which is the
existing rule in the platform service. A single node has no second process
to share with, so the LRU backend is the memo's second copy and nothing more.

The key is the post id and the message hash. The value is the pattern
detection only:

```
patternEntry{
    generation string
    protected  [][2]int
    patterns   []*PostEntity
    incomplete bool
}
```

Terms stay out of it. A merged list would go stale on every dictionary
change, and a node would serve another node's term titles and URLs while
their plugins were out of step. `ApplyTerms` runs after the read, in the
process, from that process's dictionary. The value is post content under a
post-id key. The recent-post cache already stores whole posts in the same
Redis.

A page that misses the memo calls `GetMulti` once. That is one `MGET` on
Redis. Hits at the current generation are applied and memoised. Hits at an
older generation are served the same way, and refreshed in the background.
Misses scan inside the page budget.

Writes leave the request. A finished scan is memoised and served, and a
bounded background worker calls `Set`. A page of misses must not wait on one
`Set` per post. Redis `Set` and `GetMulti` use `context.Background()` and the
connection write timeout is 5 seconds, with retries disabled. A slow Redis
on the request path turns a scan into a stalled post list. A failed write is
logged at debug. The reader already has the answer. Another node scans that
post once.

Incomplete results are not written. The 30 second negative entry stays in
the process memo, so a node with a stopped plugin cannot hide a finished
entry from the rest of the cluster.

TTL for a finished entry is 24 hours. Redis ignores `CacheOptions.Size`, so
expiry is the only bound this cache controls. A TTL of 0 keeps every post
and message hash ever read, including hashes left behind by edits and
deletes. A post read daily is scanned once a day by one node, which is less
than the table's `GetMany` cost. Reading an entry does not extend its TTL.

There is no Redis lock. On a matcher change each node refreshes through the
existing cap of four background scans, so a cluster does at most four scans
per node, plus redundant writes of the same value. A rolling upgrade can
have two generations overwrite each other until every node runs the new
plugin. The hash has no order that would pick a winner. That window is
short, and a lock would add a round trip to every refresh.

The Redis client keeps a local copy of `GET` and `MGET` results and drops a
key when any node writes it. The 5 minute client-cache ceiling applies when
that invalidation is missed, and the client drops its copy on reconnect. A
generation stored in the value still lets the node serve the previous spans
and refresh. `CacheSettings.DisableClientCache` skips that local copy, and
the process memo is then the only local tier.

When this response was served from an older generation, the handler omits
the `ETag` header. The channel and single-post etags already contain the
current pattern hash, computed before hydration. Sending that etag with the
old spans lets the client cache them and answer the next request with 304.
This is true of the table path today. The shared cache makes it every node's
behavior, so the exception belongs in this change. A refresh that finishes
inside the page budget writes the new spans into the response instead, and
that response keeps its etag.

## 8. ETags and websocket

`AppendEntityEtag` still appends the pattern hash and the dictionary hash
when the feature is on, on the channel post list and on a single post. A
response served from the current generation is not reused after a matcher or
a dictionary change. A response served from an older generation omits the
header, as section 7 describes.

`entities_dictionary_changed` is published when the dictionary hash changes.
The payload stays the type id and a generation, never the terms. Publishing
the same list again, which is what activate does on a rolling restart, does
not notify clients and does not make them refetch.

On Redis, a restarted process reads the pattern entry another node wrote and
does not scan. On LRU, a restart scans again. Card caches are unchanged.

## 9. Client

Posts already on screen do not notice a dictionary change until they are
fetched again. `POST /api/v4/entities/posts` still accepts the ids the client
sends, hydrates them, and returns entities. With the split memo, that
response includes terms added since the page was rendered.

The current client discards that response. It dispatches `RECEIVED_POSTS`
with the same `update_at`, the posts reducer drops it, and the reactions
reducer replaces each post's reactions with an empty map because the stored
post has no `metadata.reactions`. The refresh has to be a
`RECEIVED_POST_ENTITIES` action that writes `metadata.entities` and leaves
the rest of the post alone. The null check on the channel's recent post ids
belongs in the same change: `getPostIdsInChannel` returns null when the
channel has no recent block, and the handler calls `.slice` before it checks.

That client fix is required for on-screen updates. It is not a reason to
keep the tables. The server returns the right entities either way.

## 10. Removed

- Migrations `000236_create_post_entities` and `000237_create_entity_terms`,
  both directions.
- `PostEntityStore` and `EntityTermStore`, their sqlstore and storetest
  implementations, and the `GetMany` on the post read.
- `LoadTerms`, the startup load, the dictionary write, the generation row
  lock, and the memory snapshot around that write.
- `DeleteByPlugin`. Deactivation is `RemovePlugin` only.
- The background refresh no longer writes a row. It updates the memo and, for
  a finished scan, the platform cache.

## 11. Unchanged

- The message is not rewritten. Entities are metadata on the read model.
- Matcher limits: RE2, at most 1000 bytes, at most 50 per plugin, no empty
  match. Term limits: 500 per plugin, the current URL and title rules.
- Scan limits: the first 16000 runes, at most 100 entities.
- One provider per type, the card cache, and the card routes. A card named
  with a post still requires the post-read permission and the value on that
  post.
- The feature flag and `MM_ENTITIES=1`.

## 12. Cost

A steady page on a warm process is the memo plus the dictionary pass. There
is no entity query and no entity write on that path.

A memo miss on Redis is one `MGET` for the page. A hit there is cheaper than
the cold scan, about 48ms for 60 one-line posts with three matchers on this
branch. A miss scans, serves, and writes the cache in the background. The
first node to see a new post does the scan. The others read the entry.

A memo miss on LRU is a local cache read and then, on a second miss, the
same scan. A process restart on LRU scans again.

A validating matcher adds plugin RPCs, bounded by the page budget. An
incomplete result stays on that node for 15 to 30 seconds.

A matcher change serves the previous spans and refreshes in the background,
up to four scans at a time on each node.

There is no admin backfill. The framework spec describes one, and this branch
does not have it. Parse on read backfills by scanning a post when someone
reads it, and that result is what the next node reuses.

## 13. Out of scope

The side panel's related-card request, the rich-card check, markdown
placeholders, and right-hand-side history are webapp defects in the current
branch. They do not depend on these tables. This change does not fix them.

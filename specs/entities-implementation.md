# Entities: implementation notes for architecture and security review

Status: prototype on branch `plan/entities`. Not a product spec. The intended
end state remains [entities-framework.md](entities-framework.md). This note
describes what the branch actually does, where it differs, and what a reviewer
should look at.

Owner: Daniel Schalla
Server flag: `FeatureFlags.Entities`, default off. `MM_ENTITIES=1` forces the
feature on and skips the license check. That environment variable is a
development switch.

## 1. What this is

A message can contain tokens that mean something: a CVE, an IP address, an
acronym, a ticket id. The server finds those tokens and the webapp draws an
underline. Hover shows a short expansion. Click opens one side panel.

The stored message is not rewritten. Search, export, mobile, and a server
without the feature still see the author's text. Recognition is metadata
attached at read time.

Tactical Fusion still rewrites some tokens (CWE, hashes, and any type whose
entity registration did not succeed). CVE, IPv4, ATT&CK techniques, and
`FREQ:` stop being rewritten only after that plugin's entity registration
succeeds.

## 2. What was tried

On a local server with the flag forced on:

- Raw posts show underlines for CVE, IPv4, ATT&CK, `FREQ:`, and the Conflux
  acronym `MLT`.
- Hover sits above the compose box. Click opens the side panel.
- The vulnerability panel shows the score, known-exploited state, summary,
  rows, and the decoded CVSS vector. The data is fetched by the Tactical
  Fusion plugin from NVD, EPSS, KEV, and MITRE. It is not compiled into the
  server.
- `MLT` survives a server restart. The term is in Postgres
  (`entitydictionaries` / `entityterms`, generation 1) and the side panel
  still opens.

Weave 0.6.0, including the entity trigger and the entity card node, is
installed on the local server. The local user `tfdemo` was granted
`system_admin` so it could save a global automation. The saved automation
is "Incident entity" (`hi17r1myjbrm3fzho4py84ak5a`): regex `WX-[0-9]+`,
cache `none`, card title `Ticket {{.entity.value}}`. In TF Playground the
post "Weave entity WX-100 is the sample." underlines `WX-100`. Clicking it
opens a side panel titled Incident, with title "Ticket WX-100" and summary
"Opened from chat". The create response itself had empty metadata, because
Weave reconciles registrations after the save returns. The next read of the
post carried the span.

The plugin compiles against this branch because the server public module now
carries the automation value types and the six automation API methods as
stubs. Those stubs return "automation contributions are not available".
Playbooks' action registration still has no implementation behind it. Entity
registration does not call those methods.

There is one in-memory unit test: a trigger node and a card node render
`{{.entity.value}}` into the card title.

## 3. Shape

```
plugin OnActivate
    RegisterEntityType
    RegisterEntityMatcher          pattern, stored and re-detected with the post
    RegisterEntityTerms            exact words, applied on every read
    RegisterEntityProvider         who fills the side panel, and how it is cached

read a post
    compare message hash and pattern generation with postentities
    on a miss, scan patterns and write the row
    on a hit, reuse the row
    apply the current dictionary in memory
    put the spans on post.metadata.entities

webapp
    replace each span with an underline before markdown
    hover from the span's title and url
    click calls GET /api/v4/entities/card

dictionary change
    write terms, bump that type's generation
    websocket entities_dictionary_changed {type_id, generation}
    open clients wait a random delay up to 10s
    POST /api/v4/entities/posts for the open channel
```

One process-local registry holds types, matchers, providers, terms, and
dictionary generations. It is rebuilt at startup from Postgres, then plugins
register again.

There are no built-in types. `CoreLookup` always returns an error. The native
behavior is the autolink: an exact term, or a pattern with an optional https
URL template.

## 4. Ways to register

All four calls are plugin API methods. They return `EntitiesDisabledError`
(HTTP 501) when the feature is off. A plugin that sees that error keeps its
previous behavior. Invalid input is HTTP 400. Registration is idempotent:
the same id replaces the previous one.

A type id is `pluginID + "." + name`, charset `[a-z0-9.-]`, at most 80
characters. The display name is 1 to 64 runes. A plugin may attach a matcher
or a provider to a type it owns. It cannot attach one to another plugin's
type. There is no core type to attach to.

A plugin registers during `OnActivate`. The same calls are safe to repeat.
`EntitiesDisabledError` means the server is running with the feature off, and
the plugin should keep its own behavior.

```go
const typeID = "com.example.tickets.incident"

func (p *Plugin) OnActivate() error {
    if appErr := p.API.RegisterEntityType(&model.EntityType{
        ID:          typeID,
        DisplayName: "Incident",
    }); appErr != nil {
        if appErr.Id == model.EntitiesDisabledError {
            return nil
        }
        return appErr
    }

    if appErr := p.API.RegisterEntityMatcher(&model.EntityMatcher{
        ID:      typeID + ".scan",
        TypeID:  typeID,
        Pattern: `INC-[0-9]+`,
        URL:     "https://tickets.example.com/{value}",
    }); appErr != nil {
        return appErr
    }

    return p.API.RegisterEntityProvider(&model.EntityProvider{
        ID:              typeID + ".card",
        TypeIDs:         []string{typeID},
        HasCard:         true,
        Cache:           model.EntityCacheShared,
        CacheTTLSeconds: 30 * 60,
    })
}

func (p *Plugin) EntityLookup(_ *plugin.Context, req *model.EntityLookupRequest) (*model.EntityCard, error) {
    if req == nil || req.TypeID != typeID {
        return nil, nil
    }
    // A shared provider leaves req.UserID empty. user and none set it.
    return &model.EntityCard{
        Title:   req.Value,
        Summary: "Open incident",
        URL:     "https://tickets.example.com/" + url.PathEscape(req.Value),
        Rows: []model.EntityCardRow{
            {Label: "State", Value: "Open"},
        },
    }, nil
}
```

The server overwrites `TypeID` and `Value` on the card it returns to the
client. A provider that cannot answer returns `nil, nil`. The side panel then
shows "No additional information". Returning an error does the same and is
not cached. Returning a card with a nil error is cached when the mode asks
for it.

### 4.1 Pattern

`RegisterEntityMatcher`. RE2, 1 to 1000 bytes, must not match the empty
string. `ValueGroup` selects the capture that becomes the underlined span.
Zero means the whole match. At most 50 matchers per plugin. Matcher ids are
globally unique and must start with the plugin id.

Optional `URL` is an https template containing `{value}` once. The value is
query-escaped.

Changing a matcher changes the pattern generation (a hash of matcher id,
type, pattern, and value group). The next read serves the spans it already
has and refreshes them in the background. See
[entities-parse-on-read.md](entities-parse-on-read.md).

There is no API to delete one matcher. Deactivating the plugin drops every
registration from that plugin. A disabled Weave automation, once that path
exists, retires a regex by replacing it with a pattern that matches nothing.

### 4.2 Exact term

`RegisterEntityTerms(typeID, terms)` replaces the whole list for that type.
An empty list clears it. Each term is 2 to 32 characters, a letter followed
by letters and digits, case-sensitive. Title is 1 to 120 runes. URL is
required: `https://` with a host, or a root-relative path that is not `//`,
contains no `..`, and contains no whitespace or backslash. At most 500 terms
per plugin. Duplicates in one call are rejected.

Terms do not change the pattern generation and are not stored on the post.
They are applied while building the response. The same span as a pattern
keeps the pattern and fills an empty title or URL from the term. Any other
overlap keeps the stored pattern span.

`ReplaceTerms` returns a hash of the sorted term set. An identical list does
not change that hash and does not publish. A change is held in memory and
publishes `entities_dictionary_changed`. The websocket payload is the type
id and the generation. The term text does not travel. There is no term table.
A restart recognizes terms when each plugin registers again.

```go
appErr := p.API.RegisterEntityTerms("com.mattermost.conflux.acronym", []model.EntityTerm{{
    Value: "MLT",
    Title: "Mattermost leadership team",
    URL:   "/conflux/e3or5eeatpfoipcxx474ptyyuo/pages/yfp8eunb8iys3kkw3f4iu14jwo",
}})
```

An empty slice clears that type. The websocket that follows is:

```json
{
  "event": "entities_dictionary_changed",
  "data": {
    "type_id": "com.mattermost.conflux.acronym",
    "generation": "a1b2c3d4e5f60718"
  }
}
```

### 4.3 Card provider

`RegisterEntityProvider`. `HasCard` means a click calls the plugin hook
`EntityLookup`. The server forces `TypeID` and `Value` on the returned card
so a plugin cannot relabel the span.

The lookup value must be the entire match of a registered pattern, or an
exact registered term. A caller cannot ask for an arbitrary suffix.

If the hook returns an error or a nil card, the server falls back to the
term card, then to a thin card whose summary is "No additional information".

The first provider with `HasCard` for a type wins. A second provider for the
same type is stored and ignored. The spec's side-by-side stack is not built.

### 4.4 Who registers today

| Owner | Type id | How it matches | Card |
|---|---|---|---|
| Tactical Fusion | `…tactical-fusion.vuln` | CVE pattern, URL template to NVD | shared, 30 min |
| Tactical Fusion | `…tactical-fusion.ip` | IPv4 pattern, no URL | shared, 30 min. The card is the address only |
| Tactical Fusion | `…tactical-fusion.attack` | technique pattern, no URL | shared, 30 min |
| Tactical Fusion | `…tactical-fusion.frequency` | `FREQ:` pattern, value group 1 | shared, 30 min. Parsed in process |
| Conflux | `com.mattermost.conflux.acronym` | exact terms from acronym blocks on wiki pages | shared, 60 seconds |

Conflux reads every non-deleted page's document on each content save, finds
`acronym` blocks (short form, long form, description), and registers the
short forms. Newest page wins a duplicate short form. The link is
`/conflux/{team}/pages/{id}`. The hover title is the long form. The side
panel summary is the description.

CWE and hashes are still Tactical Fusion message rewrites. They were never
registered as entities.

### 4.5 Weave

An automation with trigger type `entity` would register one type,
`com.mattermost.weave.` plus the automation id. The trigger chooses a regex
or one exact term, the display name, the hover title, the link, and the
cache mode.

The graph runs only when the side panel opens. It does not run while
scanning a channel. The run is not saved in Weave history. The timeout is
2 seconds. Reachable nodes may be the trigger, transforms, HTTP requests,
and one entity card. Posts, membership changes, and dialogs are refused.
Conditions are refused too. That last refusal is stricter than the safety
rule. A condition does not write. It was left out so a branch could not
skip the card. Several HTTP requests are already allowed.

The automation must be global. The HTTP call uses the plugin's egress
client, not the reader's session. The card is then subject to the cache
mode on the trigger.

The trigger config and the card node look like this. The card templates see
the matched text as `.entity.value`.

```json
{
  "type": "entity",
  "config": {
    "display_name": "Incident",
    "match": "regex",
    "pattern": "INC-[0-9]+",
    "url": "https://tickets.example.com/{value}",
    "cache": "none",
    "cache_ttl_seconds": 0
  }
}
```

```json
{
  "type": "entity_card",
  "config": {
    "title": "Ticket {{.entity.value}}",
    "summary": "Opened from chat",
    "url": "https://tickets.example.com/{{.entity.value}}",
    "rows": [
      {"label": "Id", "value": "{{.entity.value}}"}
    ]
  }
}
```

An exact word uses `"match": "term"` and `"value": "INC"` instead of
`pattern`. That form requires `url`.

## 5. Read path

Pattern spans are computed while a post is prepared for the client and kept
in the process memo and the platform cache (`entity_pattern`). They are not
written to Postgres. The behavior below is the scan. Storage, the page
budget, and etags are in
[entities-parse-on-read.md](entities-parse-on-read.md).

`preparePostForClient` calls `hydratePostEntities`.

Skipped: empty message, deleted post, burn-on-read, `system_*`, `custom_*`.

The scan covers the first 16000 runes and keeps at most 100 entities. Spans
are stored as UTF-16 code units. The occurrence id is `start:end`.

Protected ranges, which a dictionary pass also skips: fenced code, inline
code, markdown links, bare URLs, at-mentions and channel mentions, emoji
shortcodes. A span must not contain `*_~\`[]` or a newline. The character
before the span is not a letter, digit, or underscore. The character after
is not a word character or `-`.

Overlap between patterns: the longest span wins, then the earlier start,
then the matcher id. The same span from two types is merged.

A finished scan stores the pattern generation, the protected ranges, and the
pattern spans, keyed by post id and message hash. Terms are not in that
entry. A later read applies the current dictionary to those ranges. An
acronym edit does not scan again. A matcher change serves the stored spans
and refreshes them off the request.

## 6. Caching

The provider chooses the mode at registration. An empty mode is `none`.
An unknown mode, or a TTL below 0 or above 86400 seconds, rejects the
registration. A TTL of 0 on `shared` or `user` uses 30 minutes.

| Mode | Key | Reader id sent to the plugin |
|---|---|---|
| `none` | nothing stored | yes |
| `shared` | sha256 of provider id, type id, and value | no |
| `user` | those three plus the reader id | yes |

A `user` card with an empty reader id is not stored.

```go
model.EntityProvider{
    ID:              typeID + ".card",
    TypeIDs:         []string{typeID},
    HasCard:         true,
    Cache:           model.EntityCacheShared, // "shared", "user", or "none"
    CacheTTLSeconds: 60,                      // 0 means 30 minutes for shared and user
}
```

`EntityCacheNone` calls the plugin on every open. `EntityCacheUser` includes
the reader in the cache key and in `EntityLookupRequest.UserID`.
`EntityCacheShared` uses one card for every reader and leaves `UserID` empty.

The cache is the platform cache named `entity_card`, size 10000, default
expiry 30 minutes. When `CacheSettings.CacheType` is Redis, that provider
is Redis. Otherwise it is the in-process LRU. The dictionary itself is not
in Redis. Losing Redis must not stop recognition. Pattern spans use a second
platform cache, `entity_pattern`, described in
[entities-parse-on-read.md](entities-parse-on-read.md). Redis pub/sub, when
configured, is already the cluster bus. This branch does not yet send a
dictionary-generation message across it. Each node learns a dictionary when
the plugin registers on that node.

A card is stored only after the plugin returns a card and a nil error.
Tactical Fusion returns a successful thin card when NVD or MITRE fails, so
a failure is cached for the TTL. The plugin also keeps its own 30 minute
catalog cache in process.

The cache key does not include the plugin's data version. A freshly loaded
KEV file is invisible until the TTL expires or the process restarts.

## 7. HTTP and websocket

Both routes require a session. The feature returns 404 when it is off.

`GET /api/v4/entities/card?type_id=&value=`

```http
GET /api/v4/entities/card?type_id=com.mattermost.plugin-tactical-fusion.vuln&value=CVE-2023-4966
```

```json
{
  "type_id": "com.mattermost.plugin-tactical-fusion.vuln",
  "value": "CVE-2023-4966",
  "title": "CVE-2023-4966",
  "summary": "...",
  "score": "9.4",
  "severity": "critical",
  "exploited": true,
  "rows": [{"label": "Vendor", "value": "..."}],
  "url": "https://nvd.nist.gov/vuln/detail/CVE-2023-4966"
}
```

Returns one card. This route does not check that the caller can read a post,
channel, or wiki page that contains the value. The only check is that the
value is a full match of a registered pattern or an exact term.

`POST /api/v4/entities/posts` with `{post_ids: [...]}`, at most 200 ids.

```json
{ "post_ids": ["abcdefghijklmnopqrstuvwx"] }
```

```json
{
  "posts": {
    "abcdefghijklmnopqrstuvwx": [
      {
        "id": "8:11",
        "start": 8,
        "end": 11,
        "type_ids": ["com.mattermost.conflux.acronym"],
        "matcher_id": "",
        "value": "MLT",
        "display_name": "Acronym",
        "title": "Mattermost leadership team",
        "url": "/conflux/TEAM_ID/pages/PAGE_ID"
      }
    ]
  }
}
```

`start` and `end` are UTF-16 offsets. `id` is those two numbers joined by a
colon. Loads those posts, skips any whose channel the session cannot read,
hydrates entities, and returns the map above. A mixed batch does not fail.

`entities_dictionary_changed` is published with an empty team and an empty
channel, so every connected client receives it. The payload is `type_id` and
`generation`. The webapp, after a random delay of up to 10 seconds, refetches
entity spans for the posts currently loaded in the open channel, capped at
200, and merges them into the existing posts.

## 8. Enabling

`MM_ENTITIES=1` enables the feature and does not consult the license.

Otherwise the feature flag must be true. A nil license is treated as
enabled. A real license must be at least Enterprise, and an explicit
`Features.Entities: false` disables it. The local Entry license has
`entities: true`. The flag still defaults to false, so the env var is what
turns the prototype on.

`MM_ENTITIES=1` should not remain a license bypass in a build that ships.

## 9. Review questions

These are the decisions the prototype makes and that a review should accept
or change.

1. **Card authorization.** `GET /api/v4/entities/card` with no post still
   answers a shared provider for any logged-in user and any value the
   registry recognizes. `user` and `none` providers require a post the caller
   can read, and the value has to be on that post. The check is the post-read
   check (`read_channel_content`, or `read_public_channel` for an unjoined
   public channel). A shared card is still public data: a CVE, or a Conflux
   acronym whose long form is server-global.

2. **Shared cache hides the reader.** A shared provider is not told who
   opened the card. It cannot enforce per-user authorization inside
   `EntityLookup`. A shared card has to be safe for every logged-in user.
   `user` and `none` do receive the reader id. The cache key includes the
   post id and the post time, so a token resolved against one post is not
   reused for another. The request still does not carry the channel or the
   locale. The spec asked for those.

3. **One provider per type.** The first `HasCard` provider is the whole side
   panel. A second plugin cannot add a section beside it. The spec's stack
   is not built.

4. **Acronym scope.** Terms are global. A short form defined on a page in
   one team is underlined in every channel on the server, and the card is
   available to every logged-in user who asks for that short form.

5. **Outbound fetch.** Tactical Fusion's vulnerability and ATT&CK cards call
   NVD and MITRE from the server. The plugin sets a 12 second timeout and
   the user agent `Mattermost-Entities`. Weave would add a general HTTP
   node on the same open-the-card path, under the plugin egress policy, with
   a 2 second budget for the whole graph. The reader's identity is not the
   identity of that call.

6. **Failure caching.** A plugin that returns a thin card and a nil error
   caches the failure. Callers should return an error when the answer is
   not worth keeping.

7. **Development bypass.** `MM_ENTITIES=1` skips the license check.

8. **Fan-out.** A dictionary save notifies every connected client. Each open
   client may POST up to 200 post ids. The event carries no term text.

9. **What is stored.** Pattern spans live beside the post. Term text, title,
   and URL live in Postgres in the clear. The message body is unchanged.
   Deleting the post deletes the pattern row. Deactivating a plugin deletes
   its dictionary rows. Historical pattern rows stay until the post is
   rescanned; they name the plugin's type id and are hidden as soon as the
   matcher is gone.

10. **Rewrite leftover.** Posts already rewritten by Tactical Fusion stay
    rewritten. Entities never sees the original token inside a markdown link,
    because links are protected.

## 10. Divergence from the spec

The earlier framework draft said core would ship `mm.vuln`, `mm.ip`, and
`mm.attack`, and that Conflux would fill a core type `mm.term` through an
Aho-Corasick dictionary of about 100,000 terms. The branch does not do that.

Built instead: plugin-owned types, exact-term autolinks capped at 500 per
plugin, a word-map scan, parse-on-read with no entity tables, the posts
refetch endpoint, provider cache modes, optional Mattermost Blocks on the
card body, and one core example type `mm.time` (RFC 3339 with timezone) so
underline + card work without a plugin.

Not built: stacked providers, the async re-detect queue for matcher changes,
`post_entities_updated`, cluster
reload of a dictionary generation, the stop-list, the 64 MB automaton, admin
types, mobile rendering, and a System Console.

## 11. Suggested next step

Settle card authorization before adding a provider that calls out, and
before Weave. The question is whether `GET /api/v4/entities/card` may answer
from the value alone, or whether it must be tied to a post the caller can
read.

After that, the useful prototype is one Weave automation: a regex or a
term, two HTTP requests if the graph needs them, conditions allowed, cache
mode `none` until the response is known to be safe to share, and a saved
run nowhere. That requires the automation-action server API on this branch
so the Weave plugin compiles.

Leave the large dictionary automaton and the mobile client until a channel
stays fast and the card endpoint's authorization is accepted.

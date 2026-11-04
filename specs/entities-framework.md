# Entities: a framework for enrichable labels

Status: ready for M1, after multi-model review (Opus, GPT, Gemini, Grok) and a
final spec review
Owner: Daniel Schalla
Feature flag: `FeatureFlags.Entities`
License: Enterprise and Enterprise Advanced

## 1. Summary

Messages are full of things that mean something: IP addresses, CVEs, coordinates,
times, airfields, ticket IDs, acronyms. Today each plugin that wants to make these
clickable does it alone. Tactical Fusion rewrites the stored message into markdown
links that point at its own routes, so a token belongs to exactly one plugin and
nothing else can add to it.

Entities moves that capability into core. Core owns a registry of entity types,
finds them in text, and renders a quiet underline. Any number of plugins (and
admins, without code) can register matchers that recognize a type and providers
that enrich it. On hover, core asks every provider for that type in parallel and
stacks their answers in one card. On click, the right-hand sidebar shows all of
them, or navigates straight to the link if a link is the only provider.

Examples this has to serve:

- An IP address enriched by Tactical Fusion's threat datasets, a map provider for
  its geolocation, and an internal asset inventory, all in one card.
- Coordinates with a single map provider.
- Conflux registering a new acronym such as `MLT` (Mattermost leadership team)
  from its wiki, which is then recognized everywhere within seconds.
- A CVE enriched by Tactical Fusion and linked to NVD.
- An admin-defined ticket ID such as `MM-12345` linked to Jira, with no code.

## 2. Background

### 2.1 What Tactical Fusion does today

Observed on a local server (master, Tactical Fusion 0.9.1):

- `MessageWillBePosted` rewrites each recognized token into
  `[label](/plugins/com.mattermost.plugin-tactical-fusion/decorate/<type>?<params>)`.
  The parsed data travels in the query string. That stored text is what search,
  exports, mobile and a server without the plugin see.
- Recognition is Go only: per decorator, an RE2 pattern, a boundary guard outside
  the regex, and a parser. Overlaps resolve longest-match first, then
  registration order. Code spans, code blocks and existing links are protected.
- The webapp never parses. A capture-phase click handler routes decorator links to
  an RHS panel; a hover card and an optional inline embed render from the params.
- A message that is nothing but a token can be expanded server side (a lone METAR
  becomes a markdown table containing nested airfield and time links) or rendered
  with an inline embed (a lone MGRS reference shows a map).
- Label monikers (`DEPLOC:PHNL`) are consumed into the link, so the reader sees
  only `PHNL`.
- One token, one owner. The IP card shows the country but no map, because the map
  belongs to a different decorator and there is no way to compose the two.

### 2.2 Prior art in core

- Webapp plugin registry: `registerMessageWillFormatHook`,
  `registerLinkTooltipComponent`, `registerPostWillRenderEmbedComponent`,
  `registerRightHandSidebarComponent`. Each covers a slice; none has a notion of a
  typed, shared, enrichable token.
- Auto-translation stores derived per-post data in its own `Translations` table and
  hydrates it into `PostMetadata.Translations` on read. This is the closest
  precedent, and also a warning: verified against master,
  - `PostStore.GetEtag` (`post_store.go`) hashes only `Posts.UpdateAt`, so a
    change to a side table is invisible to cached post lists;
  - data retention and permanent delete do not touch `Translations`.
  Entities must not inherit either gap.
- `PostMetadata.PropertyValues` is another per-post derived attachment.
- Mentions are tokenized in `doFormatText` (`$MM_ATMENTION$` style tokens). Marked
  calls `doFormatText` once per text node, after markdown is parsed
  (`utils/markdown/renderer.tsx`), so source offsets cannot be applied there.
  Entity rendering marks spans before markdown and restores them there (6.7).
- `RunMultiPluginHook` (`environment.go`) calls plugins one after another, so it is
  not usable for the lookup fan-out (6.5).

## 3. Goals and non-goals

Goals:

- A core registry of entity types, matchers, dictionaries and providers, open to
  any enabled plugin at runtime and to admins through the System Console.
- The message text is never rewritten.
- One to many providers per type, composed in one hover card and one RHS view.
- Retroactive: registering a type, matcher, term or provider affects existing
  posts.
- A data-card-first provider contract, so mobile can render enrichments later
  without running plugin code.
- Tactical Fusion becomes the first large consumer.

Non-goals for v1:

- Mobile rendering (the API is shaped for it; rendering lands in M4).
- Detection outside `Post.Message`: message attachments, channel headers and
  purposes, and text inside provider cards. None of them have a stable source
  position to anchor a span to yet.
- Entities on auto-translated views (spans do not survive translation).
- Inline embeds below a post.
- Validator or claim callbacks into plugins on the render path.
- Composer highlighting or autocomplete.
- Agents/MCP access to the registry.
- Search by entity ("every post mentioning 141.98.9.137"). The data model must
  allow it later.
- Migrating posts Tactical Fusion already rewrote. They keep rendering as they do.

## 4. Concepts

- **Entity type.** A kind of thing, with a namespaced ID (`mm.ip`,
  `com.mattermost.conflux.term`), a display name, an icon, a versioned canonical
  payload schema, and an owner. Core types use the `mm.` namespace; admin types use
  `admin.`; plugin types use the plugin ID. Only the owner may change a type.
- **Matcher.** A way to recognize a type in text: an RE2 pattern with boundary
  rules and a value group, a `PREFIX:value` form, or a term dictionary. Types are
  open: anyone may add matchers to a type, and an admin may disable any matcher.
  Tactical Fusion adds MGRS, UTM, GEOREF and GARS matchers to core's `mm.geo`.
- **Pattern matcher.** Regex and prefix matchers. Their results are stored.
- **Dictionary.** A term set attached to a type, maintained incrementally by its
  registering plugin, matched case-sensitively on whole words by default. Its
  results are computed on read and never stored.
- **Canonical payload.** The normalized value every provider receives, defined by
  the type's schema (for `mm.geo`: WGS84 lat/lon, precision, plus the raw text and
  the grammar it was written in). A matcher that cannot produce it from a regex
  alone declares a canonicalize hook.
- **Entity.** One detected occurrence: an occurrence ID, a span in UTF-16 code
  units of `Post.Message`, one or more type IDs, canonical payload per type, the
  matcher that found it. The occurrence ID is derived, not random:
  `<start>:<end>`, which is unique within a post because entities never overlap.
- **Provider.** Something that enriches a type. It declares what it can
  contribute: a link, a data card, actions, and, on web, an optional hover or
  panel component.
- **Card.** The structured data a provider returns for one entity, in a strict
  core schema.

## 5. Decisions made

Registration and matching:

- Core feature behind `FeatureFlags.Entities`, then an admin setting defaulting
  off. Enterprise and Enterprise Advanced, checked through a license feature bit.
  When the feature is off or unlicensed, `Register*` calls return
  `ErrEntitiesDisabled`, so a plugin such as Tactical Fusion knows to keep its own
  behavior.
- Any enabled plugin may register types, matchers, dictionaries and providers,
  within per-plugin quotas (10.). Admins can disable any type, matcher or
  provider globally.
- Admins can define types in the System Console: a regex or prefix, plus a URL
  template link provider.
- Matchers in v1: regex with boundary rules and a value group, prefix sugar on
  regex, term dictionaries. Validator callbacks and author markup are deferred.
- Dictionaries may hold 100k+ terms. Updates are incremental (upsert/remove) with
  a full replace for resync, and reach every cluster node within seconds.
- Dictionary terms are case-sensitive and whole-word by default, overridable per
  term.
- When types match the same span, the entity merges them and shows every type's
  providers.
- Partial overlap: longest span wins, then admin type priority, then matcher ID in
  byte order. Never registration order, which differs between nodes.
- Detection covers `Post.Message` of user, bot and webhook posts. It skips
  ephemeral posts, system posts, burn-on-read posts, and posts whose type a plugin
  owns (`custom_*`).
- Never detected inside code spans and blocks, existing links and URLs, and
  mentions, channel links and emoji.
- Edits re-detect in full.
- New types, matchers, terms and providers apply to existing posts.

Noise control for dictionaries, all per dictionary:

- An admin-editable global stop-list (`IT`, `US`, `OK`, `AM`, ...).
- A minimum term length, default 2, raisable by the provider.
- First occurrence only, default on for dictionaries and off for pattern types.
- Plugins upsert only terms they already accept. There is no claim mode.

Rendering:

- An entity renders whenever a matcher hits: the author's text, unchanged, with a
  subtle dotted underline. The type icon appears on hover. No provider count.
- Prefix text stays visible exactly as written; only the value group is
  underlined.
- Hover after about 400 ms. Keyboard focus plus Enter opens the RHS; Space or
  Shift+F10 opens the card. The card is a dialog for assistive technology.
- Card header: type icon, type name, canonical value (or the raw text while the
  canonical value is pending), copy. Below it, one section per provider, titled
  with the provider's name, stacked in an order the admin sets per type,
  defaulting to each provider's declared weight.
- Sections render progressively with a skeleton each. A failed or timed-out
  section collapses. With no data from any provider the card says "No additional
  information" and still offers copy.
- Click opens the RHS with every provider's panel stacked. If the only provider
  is a link, click navigates to it.
- Copying message text returns the original text.
- Auto-translated views render no entities.
- Web and Desktop in v1. Mobile shows plain text until M4.

Providers and data:

- Provider contributions in v1: link (URL template), structured data card, a fixed
  set of actions (copy, open URL), and on web an optional hover and panel
  component that replaces the generic card.
- Data is fetched lazily on hover or click, through one core endpoint that takes a
  stored occurrence, not a client-supplied value, and streams provider results.
- Providers receive the reader user ID, channel and team ID, post ID, and the
  reader's locale and timezone. They do not receive surrounding text.
- Client cache per reader with a TTL each provider declares.
- Providers declare external egress. The System Console shows it, and egressing
  providers are off by default in air-gapped mode.
- Providers declare a cost (cheap or expensive). Clients on constrained links skip
  hover prefetch and expensive providers.
- Cards use a strict schema: text, key/value rows, badges, links with http, https
  or provider-scoped relative URLs only. No HTML, no markdown, no images, no map.
- Bulk export includes detected entities. Compliance export formats are handled
  per format (6.9).
- Entities are local to a server. Shared channels detect on receipt and never sync
  entities.

API shape:

- Go plugin API: `RegisterEntityType`, `RegisterEntityMatcher`,
  `RegisterEntityProvider`, `UpsertEntityTerms`, `RemoveEntityTerms`,
  `ReplaceEntityTerms`.
- Plugin hooks `EntityCanonicalize` (after save) and `EntityLookup` (on hover or
  click).
- Webapp: `registerEntityProvider({type, Hover?, Panel?})`.
- Type payload schemas and the card schema are versioned. Unknown fields are
  ignored.

## 6. Architecture

### 6.1 Registry

An in-memory registry on every node, built from three sources:

1. Core predefined types and matchers, compiled in.
2. Admin-defined types from config (`EntitySettings.AdminTypes`).
3. Plugin registrations, made during or after `OnActivate`.

Plugins activate on every node, so every node builds its own plugin
registrations; nothing about types, matchers or providers is gossiped.
Registrations are keyed by plugin ID and dropped when the plugin is deactivated.
Registration is idempotent, so a plugin re-registers on every activation without
first unregistering.

Two generations describe the registry, and neither is a node-local counter:

- **Pattern generation, one for the registry.** A hash of every enabled pattern
  matcher definition (ID, pattern, value group, boundary, prefixes, canonicalize
  flag), sorted by matcher ID, plus the admin type priorities. Every node with the
  same plugins computes the same value. It is one value rather than one per type
  because a new matcher of any type can match any post, and a priority change
  moves overlaps between types, so any change makes every post a candidate.
- **Dictionary generation, per type.** A counter stored in the database next to
  the terms and bumped in the same transaction as every term change.

Dictionaries are stored in the database (`EntityTerms`: type ID, plugin ID, term,
flags, generation), so a node that starts or restarts rebuilds them without asking
every plugin. A term change writes through, then broadcasts a small cluster
invalidation (type ID, new generation). A receiving node loads the terms changed
since its own generation and applies them to its automaton. Term contents never
travel in cluster messages.

### 6.2 Matching engine

Detection runs on the server and is markdown-aware. It has two halves.

**At save (pattern matchers), stored:**

1. Compute protected ranges: code spans, fenced and indented code, link text and
   destinations, autolinked URLs, mentions, channel links, emoji shortcodes. This
   is the riskiest piece; Tactical Fusion's `findProtectedRanges` and its tests
   are the starting point, extended with a corpus of emoji, CJK, RTL, combining
   characters and astral-plane text.
2. Run regex and prefix matchers. RE2 only. Boundary rules live outside the
   pattern, never in it, so a match cannot eat the guard the next match needs.
   The span is the matcher's value group, so `DEPLOC:` stays plain text. A span
   containing a markdown metacharacter (`` * _ ~ ` [ ] \ ``) or a line break is
   dropped, so a span can never straddle markdown syntax.
3. Resolve overlaps among pattern entities (5. Registration and matching).
4. Apply caps: scan at most the first 16,000 characters; keep at most 100 entities
   per post.
5. Store the entities, the protected ranges, the pattern generation used and a
   hash of the message (6.4). Spans are converted from Go byte offsets to UTF-16
   code units, which is what both webapp and mobile index strings by. A row is
   written for every detected post, including posts with no entities, so the
   read-time dictionary pass has its protected ranges and a post is not taken
   for undetected.
6. Queue canonicalization for entities whose matcher asks for it (6.3).

Budget: steps 1 to 4 p99 under 2 ms for a 4,000-character post. On overrun the
row is written with no entities and marked `skipped`, which is logged and
counted. A skipped row is not retried until the pattern generation changes.

**On read (dictionaries), computed:**

When posts are prepared for a client (post lists, single posts, threads, search
results, and the `posted` and `post_edited` broadcasts), core runs the per-node
Aho-Corasick automaton over each post's message, skipping the stored protected
ranges and the stored pattern spans. A post with no row or a `skipped` row gets no
dictionary entities. The pass applies the same metacharacter rule as patterns,
whole-word checks, the stop-list, minimum length and first-only. Dictionary entities that land on exactly a pattern span merge into
it; any other overlap with a pattern entity is dropped, so stored entities always
win. Dictionary terms are their own canonical value and need no hook.

Budget: p99 under 2 ms for a 60-post page at typical post length with a 100k-term
dictionary loaded.

### 6.3 Canonicalize hook

A matcher that cannot produce its payload from a regex (MGRS to WGS84, a DTG
resolved against the post's timestamp) declares a canonicalize hook. It runs after
the post is committed, never inside the save:

1. The save stores those entities with a payload marked `raw_only`.
2. A background worker calls each plugin once per post with every entity it needs
   and the post's `CreateAt` as the reference time, with a 50 ms timeout.
3. The worker updates `PostEntities` and sends a `post_entities_updated`
   websocket event to the channel, scoped like the post itself. Updates for one
   channel are coalesced into one event per second.
4. On failure or timeout the entities stay `raw_only`. Providers must cope with
   that, and the card shows the raw text.

The queue is in memory. A post whose row still holds `raw_only` entities from an
active canonicalizing plugin is queued again when it is read, so a node restart
loses no work for good. Edits re-run the same path.

### 6.4 Storage model: stored pattern entities, read-time dictionaries

The prototype does not ship this table. Pattern spans are computed on read
and held in the platform cache. See
[entities-parse-on-read.md](entities-parse-on-read.md). The rest of this
section is the earlier storage design.

`PostEntities` table: post ID, channel ID, pattern generation used, a hash of the
message it was detected on, protected ranges, entities JSON, a `skipped` flag,
`UpdateAt`, indexed on (channel ID, `UpdateAt`). The row is written right after
the post is saved and before it is broadcast. If that write fails, the post is
still delivered and is detected again on its first read. Hydrated into
`PostMetadata.Entities` on read, after the read-time dictionary pass. A row whose
message hash no longer matches the post is ignored, so an edit racing a
re-detection never shows spans from the old text.

Retroactivity:

- New terms and dictionary types reach every post on the next read, because
  dictionaries are never stored. Posts already on screen are updated by the
  dictionary change event (7.4).
- A new or changed pattern matcher changes the pattern generation. A post whose
  row has an older generation, or that has no row because it predates the
  feature, is queued for asynchronous re-detection when it is read. Posts that
  detection skips by kind (5.) are never queued. The old entities are served
  meanwhile, and the update arrives as a `post_entities_updated` event.
  Re-detection is rate-limited per node.
- A node does not re-detect until its plugins have finished activating, so a
  restart does not rewrite rows from a half-built registry.
- A node never re-detects a row written after its own last registry change. During
  a rolling upgrade two nodes can hold different generations, and this rule stops
  them rewriting each other's rows back and forth.
- An optional admin job backfills a channel or a date range.

Caching and sync:

- The channel post-list etag includes the newest `PostEntities.UpdateAt` for the
  channel, the pattern generation and the dictionary generations, so a cached page
  is not served with stale entities.
- Fetches with `since` also return posts whose `PostEntities.UpdateAt` is newer
  than `since`, with their entities.

Lifecycle:

- Edit: re-detect and replace the row.
- Soft delete: the row stays with the post and is hidden with it.
- Permanent delete and data retention delete the row in the same pass as the
  post. Tests assert it.
- Turning the feature off stops detection and hydration; rows stay. An admin job
  purges them.
- Shared channels: a post received from a remote is detected locally on arrival.
  `PostEntities` is never synchronized.

Read cost for a 60-post page: one indexed fetch of up to 60 rows by post ID,
plus the dictionary pass (6.2).

Access: entities are hydrated only after the post passes every filter that
applies to its message (channel membership, ABAC, burn-on-read, the post's own
visibility). A post the reader cannot see carries no entities.

### 6.5 Lookup path

`POST /api/v4/entities/lookup` takes a post ID and an occurrence ID. Core:

1. Loads the post with the same access checks as fetching it directly, and
   rejects posts that would not carry entities (6.4).
2. Resolves the occurrence from `PostEntities`, or for a dictionary occurrence,
   reruns the dictionary pass on that post and requires the occurrence to be
   present. The client never supplies the value or the type.
3. Selects the enabled providers for each of the entity's types, in admin order,
   at most 8 per type.
4. Calls each provider's `EntityLookup` hook in parallel, through `HooksForPlugin`
   in one goroutine per provider, with a 2 s timeout. Link-only providers resolve
   in core from the URL template with no RPC.
5. Validates each card against the schema and strips anything invalid.
6. Streams results as newline-delimited JSON, one line per provider, as they
   arrive, with `X-Accel-Buffering: no` so reverse proxies do not hold the
   stream. A closing line lists providers that failed or timed out.

Rate limiting: per reader and per provider, with expensive providers limited more
tightly.

The client caches each provider's result per reader, keyed by provider, type and
canonical value (or raw text while `raw_only`), for the provider's TTL, so the
same IP in ten posts costs one lookup.

Target: p95 under 300 ms to the first section.

Batch lookup (every entity in the viewport at once) is designed for, by allowing
an array of occurrences in the request, but not implemented in v1.

### 6.6 Card schema (sketch)

```json
{
  "schema": 1,
  "provider": "com.mattermost.plugin-tactical-fusion.threat",
  "ttl_seconds": 1800,
  "title": "Threat reports",
  "rows": [
    {"key": "Autonomous system", "value": "AS209605 HOSTBALTIC"},
    {"key": "Country", "value": "LT"}
  ],
  "badges": [{"text": "Known exploited", "tone": "danger"}],
  "links": [{"text": "CISA AA23-325A", "url": "https://www.cisa.gov/..."}],
  "actions": [{"kind": "copy", "text": "Copy", "value": "141.98.9.137"}]
}
```

Link and action URLs must be absolute http or https, or relative under
`/plugins/<provider plugin id>/`. Anything else is stripped.

The webapp renders this generically. A provider with a registered webapp Hover or
Panel component replaces the generic rendering of its own section only. A map is
a provider's own component, not part of the generic card.

### 6.7 Webapp

- Rendering is two passes, because marked runs `doFormatText` per text node after
  parsing and source offsets mean nothing there:
  1. Before markdown, `formatText` replaces each entity span in the raw message
     with a sentinel: a private-use code point, the entity index, and a closing
     private-use code point. Sentinels contain no markdown metacharacters, and
     spans never straddle markdown syntax (6.2), so parsing is unchanged. Spans
     index the raw `Post.Message` in UTF-16 code units, which is what a
     JavaScript string indexes by.
  2. `doFormatText` restores each sentinel as an `EntityMention` element carrying
     the escaped original text and a `data-entity` occurrence ID, using the same
     token map as mentions. The code, code span and link renderers restore
     sentinels to plain original text, in case one lands there anyway.
- Entities count against `FORMAT_TOKEN_LIMIT`; past it, the rest render as plain
  text.
- If the message handed to formatting differs from `Post.Message` (a
  `registerMessageWillFormatHook` plugin changed it, or a translation is shown),
  the post renders no entities.
- No markdown is generated, so the author's text and copy behavior are untouched.
- `post_entities_updated` replaces the listed posts' entities in the store.
- `entities_dictionary_changed` makes the client refetch entities for the posts of
  the channel and thread it has open, after a random delay of up to 10 s.
- One delegated hover/click controller, the same pattern as Tactical Fusion's
  capture-phase handler, owns hover timing, keyboard access and the RHS.
- The RHS is a core component with a back stack of entities.
- `registerEntityProvider` lets a plugin replace its section with React components.
  All other provider kinds need no webapp code.

### 6.8 System Console

One page under Site Configuration, "Entities":

- Enable/disable, the stop-list, the dictionary memory cap.
- A list of types (core, admin, plugin), each expandable to its matchers, its
  providers with a numeric priority, each provider's egress and cost
  declarations, and an enable toggle per type, per matcher and per provider.
- An editor for admin types: ID suffix, name, icon, regex or prefix, boundary
  preset, a URL template with `{value}` and `{canonical.<field>}` placeholders
  (always URL-encoded), and a test box that shows what a sample message would
  detect.
- Jobs: backfill a channel or date range, purge all entities.

### 6.9 Export

Compliance and bulk export read posts through their own queries, which bypass
`PostMetadata`, so both join `PostEntities` explicitly.

- Bulk export: an `entities` array per post (type IDs, span, canonical payload,
  matcher ID). Bulk import ignores it and detects again, so an import file cannot
  plant a value that lookups would then send to providers.
- CSV compliance export: one extra column with the same data as JSON.
- Actiance and Global Relay: their schemas are fixed, so v1 exports no entities in
  them.
- Dictionary entities are computed at export time with the current dictionaries,
  and are marked as such.
- No provider results are exported.

## 7. API sketches

### 7.1 Go plugin API

```go
RegisterEntityType(t *model.EntityType) *model.AppError
RegisterEntityMatcher(m *model.EntityMatcher) *model.AppError
RegisterEntityProvider(p *model.EntityProvider) *model.AppError

UpsertEntityTerms(typeID string, terms []*model.EntityTerm) *model.AppError
RemoveEntityTerms(typeID string, terms []string) *model.AppError
ReplaceEntityTerms(typeID string, terms []*model.EntityTerm) *model.AppError
```

All of them return `ErrEntitiesDisabled` when the feature is off or unlicensed.

```go
type EntityType struct {
    ID            string // "mm.geo", "<plugin-id>.<name>"
    DisplayName   string
    Icon          string // Compass icon name
    SchemaVersion int
    PayloadSchema json.RawMessage
}

type EntityMatcher struct {
    ID           string
    TypeID       string
    Kind         string // "regex", "prefix", "dictionary"
    Pattern      string // RE2, for regex and prefix
    ValueGroup   int    // capture group that becomes the span; 0 is the whole match
    Prefixes     []string
    Boundary     string // named preset: "word", "token", "none"
    Canonicalize bool   // calls the owning plugin's EntityCanonicalize hook
    Dictionary   *EntityDictionaryOptions
}

type EntityDictionaryOptions struct {
    MinLength     int
    CaseSensitive bool
    FirstOnly     bool
}

type EntityProvider struct {
    ID          string
    TypeIDs     []string
    DisplayName string
    Weight      int
    LinkURL     string // optional URL template
    HasCard     bool   // served by EntityLookup
    Actions     []EntityActionSpec
    Egress      bool
    Cost        string // "cheap", "expensive"
    TTLSeconds  int
}
```

### 7.2 Plugin hooks

```go
EntityCanonicalize(c *plugin.Context, req *model.EntityCanonicalizeRequest) (*model.EntityCanonicalizeResponse, error)
EntityLookup(c *plugin.Context, req *model.EntityLookupRequest) (*model.EntityCard, error)
```

`EntityCanonicalizeRequest` carries the post ID, the post's `CreateAt` as the
reference time, and the entities (occurrence ID, matcher ID, raw text).

`EntityLookupRequest` carries the provider ID, type ID, canonical payload, raw
text, reader user ID, channel ID, team ID, post ID, locale and timezone, all
resolved by core from the stored occurrence.

### 7.3 REST

- `POST /api/v4/entities/lookup`: stream provider results for a stored
  occurrence.
- `POST /api/v4/entities/posts`: entities for up to 200 post IDs, with the same
  access checks as fetching the posts. Used after `entities_dictionary_changed`.
- `GET /api/v4/entities/registry`: types and providers visible to the client, for
  rendering icons and names, cached by the pattern generation plus a hash of the
  type and provider definitions. Dictionary changes do not touch it.
- Admin: CRUD for admin types, provider priority and toggles, and the backfill and
  purge jobs under `/api/v4/entities/admin/...`.

### 7.4 Websocket

- `post_entities_updated`: channel ID and, per post, the post ID and its entities.
  Broadcast to the channel like a post edit, coalesced to one per channel per
  second.
- `entities_dictionary_changed`: type ID and generation, never the terms.
  Coalesced to one per type per 10 s, so a burst of wiki edits costs one round of
  client refetches.
- `entities_registry_changed`: the new registry hash, so clients refetch the
  registry. Each node sends it to its own connections when its registry changes.

### 7.5 Webapp

```ts
registry.registerEntityProvider({
    provider: 'com.mattermost.plugin-tactical-fusion.location',
    type: 'mm.geo',
    Hover,  // optional, replaces this provider's hover section
    Panel,  // optional, replaces this provider's RHS section
});
```

## 8. Predefined types

| Type | Matchers in core | Notes |
|---|---|---|
| `mm.ip` | IPv4, IPv6, CIDR | Boundary rules exclude version strings such as `1.2.3.4-beta` |
| `mm.vuln` | CVE, CWE, ATT&CK technique and tactic IDs | Recognized by shape |
| `mm.hash` | MD5, SHA-1, SHA-256 hex | |
| `mm.geo` | Decimal lat/lon | Tactical Fusion adds DMS, DDM, MGRS, UTM, GEOREF, GARS, Plus Code with a canonicalize hook |
| `mm.time` | RFC 3339 | Tactical Fusion adds DTG |
| `mm.term` | none | Dictionary-only; Conflux and others supply terms |

`mm.domain` (hostnames, email addresses) is deferred: it collides with core's
existing URL and email autolinking.

## 9. Security and privacy

- The lookup endpoint takes only a post ID and an occurrence ID. Core resolves the
  type and value from what it stored or detected, so the endpoint is not an
  oracle that sends arbitrary values to providers, including egressing or paid
  ones.
- Lookups apply every access check that fetching the post applies before any
  provider is called, so a provider never learns about a post the reader cannot
  see. The same filters gate hydration.
- Any registered regex is RE2, so no catastrophic backtracking, but core still
  enforces a pattern length limit, per-plugin quotas and the detection budget.
- URL templates URL-encode every substitution and only produce http, https or
  provider-scoped relative URLs.
- Cards are validated against the schema server side; the webapp renders text as
  text. No HTML or markdown reaches the DOM from a provider.
- Card actions are limited to copy and open URL. Running slash commands is
  deferred until it can carry a confirmation and the reader's own permissions.
- Providers do not receive surrounding text.
- Egress declarations make it visible which providers send values outside the
  server; air-gapped mode disables them by default.
- A provider's `EntityLookup` is responsible for its own authorization of the data
  it returns, using the reader ID core passes.
- Lookups are rate-limited per reader and per provider.

## 10. Performance budgets and limits

| Path | Budget |
|---|---|
| Pattern detection at save (protected ranges, regex, overlap) | p99 < 2 ms for 4,000 characters |
| `PostEntities` write per saved post | one insert, outside the post's own write, never blocking delivery |
| Dictionary pass on read | p99 < 2 ms for a 60-post page with a 100k-term dictionary |
| Canonicalize hook | after commit, one batched call per plugin per post, 50 ms timeout |
| Scan length / entities per post | first 16,000 characters / 100 entities |
| Dictionary memory per node | configurable, default about 64 MB, shared across plugins; over-cap upserts rejected |
| Per plugin | at most 50 pattern matchers, patterns at most 1,000 bytes, a share of the dictionary cap |
| Lookup proxy | p95 < 300 ms to first section, 2 s per provider, at most 8 providers per type |
| Cluster propagation of a registration or term | seconds to every node; up to about 20 s to an open client |

Load tests in M1 must cover a channel scroll of several hundred posts with dense
entities, the post save path, and a re-detection storm after a pattern generation
change. M2 adds the read path with a 100k-term dictionary loaded.

## 11. Milestones

**M1: framework and predefined types.** Registry and the pattern generation,
matching engine with protected ranges and UTF-16 spans, `PostEntities` with etag,
since, retention and permanent-delete coverage, asynchronous canonicalize with
`post_entities_updated`, lazy re-detection with the startup and rolling-upgrade
guards, lookup proxy with stored-occurrence resolution and NDJSON streaming, card
schema, the two-pass sentinel rendering with a webapp corpus test, generic
hover and RHS, link and data providers, System Console listing and toggles,
license bit, bulk and CSV export. Predefined `mm.ip`, `mm.vuln`, `mm.hash`,
`mm.geo` (decimal), `mm.time` (RFC 3339).
Proving cases: CVE with an NVD link provider plus a data provider; coordinates
with a single map provider.

**M2: dictionaries and Conflux.** `EntityTerms` storage and dictionary
generations, invalidation-only cluster broadcast, per-node Aho-Corasick matcher,
the read-time dictionary pass, stop-list, minimum length, first-only, memory cap,
`entities_dictionary_changed` and `POST /api/v4/entities/posts`.
Conflux registers wiki acronyms into `mm.term` with a definition provider.
Proving case: Conflux creates `MLT` in its wiki and it is recognized in existing
posts on every node within seconds, and in open clients within about 20 s.

**M3: Tactical Fusion migration and admin types.** Tactical Fusion registers its
grammars as matchers on `mm.geo` and `mm.time` (with canonicalize hooks), its own
types (airfields, frequencies), and providers on `mm.ip`, `mm.vuln`, `mm.hash`,
`mm.geo`. Admin-defined types and the backfill and purge jobs in the System
Console.
Proving cases: an IP with Tactical Fusion threat intel plus a separate map
provider in one card; `MM-12345` linked to Jira with no code.

**M4: mobile.** Mobile renders underlines, the generic card and link providers
from the same metadata and lookup endpoint. Webapp-only components are skipped.

## 12. Tactical Fusion migration notes

- Tactical Fusion stops rewriting messages for the token types it has moved to
  the framework only when its registrations succeed. On `ErrEntitiesDisabled` it
  keeps rewriting, and it re-checks on configuration and license changes, so a
  post is never decorated twice or not at all.
- Post types it stamps (CoT, GeoJSON, aviation report cards) are unaffected, and
  core skips them (5.).
- Posts Tactical Fusion already rewrote stay as they are and keep rendering
  through its existing click handler.
- Its grammar test suites move with its matchers, and its protected-range tests
  are the seed for core's.
- Its maps become its own provider Hover and Panel components on `mm.geo` and
  `mm.ip`.
- Its inline map has no framework equivalent until inline embeds land; lone-token
  posts keep Tactical Fusion's current behavior until then.

## 13. Deferred

- Detection in message attachments, channel headers and purposes, and in provider
  card text.
- Entities on auto-translated views.
- `mm.domain`.
- Inline embeds.
- Validator and claim callbacks on the render path.
- Card actions that run slash commands; images and maps in the generic card.
- Entities in Actiance and Global Relay exports.
- Author markup to force or suppress an entity.
- Composer highlighting and autocomplete.
- Agents/MCP tools over the registry and providers.
- Search and facets by entity.
- Per-team, per-channel and per-user scoping.
- Batch lookup implementation.

## 14. Resolved questions

Settled by majority of the four reviews, or by the final spec review where the
reviews did not vote:

1. Lookup transport: NDJSON over one POST (three of four). Parallel requests per
   provider (Grok) stay the fallback if mobile or a proxy cannot stream.
2. Pattern generation granularity: one generation for the whole registry (6.1).
   Per-type generations do not help, because a new matcher of any type can match
   any post. Lazy, rate-limited re-detection of read posts bounds the cost.
3. A record of which dictionary entities a reader saw: not in v1. Exports mark
   dictionary entities as computed at export time (6.9).
4. Channel headers and purposes: deferred with the other non-message text (all
   four). Render-time detection with a cache (Grok) is the starting proposal
   when they come into scope.

No open questions remain for M1.

# Entities migration: Autolink and Tactical Fusion

Status: consolidated after review. This replaces the draft. It follows `specs/entities-framework.md` and `specs/entities-implementation.md`, and it does not change either of those documents.

Reviewed by Grok, GPT, Gemini, and Opus. All four accepted the same product rule: the stored message stays what the author wrote, a URL with no card body is a normal link, and a card with a body opens the side panel. The API and the Tactical Fusion inventory below are the corrections they converged on. Where they disagreed, the choice is named.

## Render rule

The side panel opens when the span has a card provider. A matcher with a URL and no card provider renders the matched text as a real link. Clicking it navigates. Middle-click, copy link, and open-in-new-tab work because the anchor is in the message, not the result of a lookup.

A title that only repeats the matched text, and a URL, are not a reason to open the panel. Conflux terms keep their hover title. The hover shows the expansion, and the link still navigates.

A span with a card provider opens the panel on click, including when that provider also has a URL. CVE keeps its NVD address and its card. The client learns which case it is from `has_card` on the span. It does not fetch a card in order to discover that there is nothing to show.

A fetched card with no body shows the title and the link inside the panel. The click is not turned into a navigation after the fetch. The fallback sentence "No additional information" is not a body. A provider that has nothing to show returns a nil card or an error, and when the matcher has a URL the panel offers that URL. A title-only card, which is what IPv4 returns today, still opens the panel until that type grows rows.

Weave follows the static case. An automation that only builds a link registers a matcher and no card provider. An automation that fills rows, a summary, a vector, a section, or a map registers a provider, and the click opens the panel.

## 1. What the API can do today

A plugin registers a type, RE2 matchers, exact terms, and one card provider. A matcher has one value group and an optional `https` template with a single `{value}`. Terms are case-sensitive. Cache is `shared`, `user`, or `none`. A shared lookup is not told who the reader is. The card is a fixed document. Pattern matches are stored. Terms are applied when the post is read.

Detection skips a smaller set of protected ranges than Tactical Fusion: unindented fences, inline code, simple markdown links, `https` URLs, mentions, and emoji. The boundary is fixed, and it is applied to the value group rather than the whole match. There is no unregister call, no scope, no reader settings, and no post time on lookup. Fifty matchers per plugin. Opening any underline opens the side panel.

Frequency, CVE, IPv4, and ATT&CK are already registered. Their boundary is the core `token` rule, which is weaker than Tactical Fusion's `BoundaryOK`, so an IPv4 span can sit inside a longer dotted number. CWE, hashes, IPv6, and ATT&CK tactics still rewrite. The CVE and ATT&CK cards in `server/entitycard` fetch NVD, FIRST, CISA, and MITRE over the network. Tactical Fusion's own cyber path does not: it reads embedded catalogs and datasets on disk. That live fetch is replaced by the local path before any more cyber types move.

## 2. Autolink

Source: `mattermost-community/mattermost-plugin-autolink` at `master`. It rewrites the message on post, and on edit only when that switch is on. It walks markdown text and bare URLs, skips existing links and images, applies links in list order, and lets a later link see the earlier replacement.

| Feature | Behavior today | Decision |
|---|---|---|
| Pattern | Go RE2, `(?i)`, `(?P<name>...)`, `$1` | Same engine. Named groups and numbered groups both fill the link template. A placeholder may appear more than once |
| Template | The whole replacement, so the visible words can change | Accepted when the template is one markdown link and the label is the full match. The visible text stays the match. The destination becomes the href. Redaction, inserted mentions, and any other template stay on Autolink and the import tool says so |
| WordMatch | `\b` around the pattern | Boundary preset `word` |
| Default guard | Previous rune is the start or whitespace. Next rune is the end, whitespace, or one of `. ! ? , )`. The guard is not part of the span | Boundary preset `autolink`. The prefix-off and suffix-off flags select `autolink_prefix_off`, `autolink_suffix_off`, or `autolink_guards_off` |
| Scope | Team name, or `team/channel`, compared without case. A scoped link does not apply in a direct message or a group message | Stored as those names. Applied when the post is read, not by rescanning every post when a scope changes. Direct and group messages are skipped whenever the list is non-empty |
| ProcessBotPosts | Default false. A failed user lookup still rewrites. Webhook posts are not given a special case in the plugin | `SkipBots`. False, the zero value, scans bots, which is what entity matchers do today. Migrated rules set true. A failed author lookup still matches |
| EnableOnUpdate | Off leaves edits alone | Edits always scan |
| Disabled, name | Per link | One Weave automation per link. Disabling it removes that matcher |
| AdminUserIds | Extra admins who are not system admins | Not carried over. The import tool lists the accounts that lose `/autolink` |
| `/autolink` | list, test, add, delete, set, enable, disable | The Weave editor is the admin UI for this migration. The slash command is a later writer of the same automations, not a step in the first cut |
| Overlap and chaining | List order, and a replacement can create the next match | Longest span, then start, then matcher id. Links do not chain. The import tool says so |
| Where it renders | The rewritten markdown renders in mobile, email, and push | A server that still depends on those clients keeps Autolink until they render a `has_card: false` span as a link |
| http and root-relative URLs | Written as-is | Matchers accept `https`, `http`, and a root-relative path. Path segments are path-escaped. Query values are query-escaped |

`MM-123` with destination `https://jira.example.com/browse/MM-$jira_id` becomes a link whose text is `MM-123`. A pasted `https://...` URL stays that URL. A rule whose pattern is itself a URL is reported and left on Autolink.

## 3. Tactical Fusion

### 3.1 Tokens

Each format stops rewriting only after every grammar of that format has registered and validated. A partial move is how IPv4 already suppressed IPv6, and how ATT&CK techniques already suppressed tactics. That is not repeated.

| Format | Grammars the move includes | Card |
|---|---|---|
| Frequency | The existing matcher, re-registered on the `strict` boundary | `Describe`: band, spacing, allocation, and the kilohertz. The page stays |
| Cyber | CVE, CWE, techniques, tactics (`TA####`), IPv4, IPv6, labeled and unlabeled hashes | `cyber.Describe` against the installed datasets. A missing dataset and a missing row stay different sentences. No live HTTP |
| Date-time group | Long form, year form, bare `DDHHMMZ`, RFC 3339, and the moniker | Rows are absolute times in the reader's zones, plus the assumed month and year when the token omitted them. The countdown and the urgent flash stay in the client |
| Location | The twelve matchers behind the nine switches: `DD`; `DDH`, `DMS`, `DDM`; `LATM`, `VLATM`, `LATD`; `MGRS`; `UTM`; Plus Code; label-only `GEOREF` and `GARS` | Every conversion row. Hidden rows stay a client filter. UTM stays unregistered while its switch is off. `GEOREF` and `GARS` are registered only with the moniker switch, and only the labeled form |
| Airfields | `ICAO:`, `LOC:`, `DEPLOC:`, `ARRLOC:`, `IATA:` | The field details that the stored table shows today. A message that is only `KIND`, with no label, stays plain. IATA is its own switch |
| Notes | Nothing is matched in prose | Unchanged |

The label of a moniker stays in the message. The underline is the value. `DTG: 091630ZAUG26` keeps the `DTG:` prefix. The label match is case-insensitive where the grammar already is. The token is not.

A grammar that today rejects a regex hit in `Parse` does not become a span until the same check has passed. Airfield codes must exist. CWE and ATT&CK ids must exist in the embedded catalog. MGRS and UTM must project. Coordinates must be in range. A date-time group must be a real day. The check runs before the span is stored. A grammar whose check cannot be expressed that way does not move.

Boundaries, all presets, checked on the full match rather than the value group:

| Preset | Rule |
|---|---|
| `token` | Today's core rule. The default, so existing matchers do not change until they opt in |
| `strict` | Tactical Fusion `BoundaryOK`: no letter, digit, `_`, or `. , - + / :` on either side. Frequency, cyber, location, and airfields use this |
| `field` | A word boundary, and neither neighbor is `/` or `:`. Date-time groups use this |
| `word` | `\b`. Autolink `WordMatch` |
| `autolink` | The default Autolink guard in the table above |
| `none` | No neighbor check |

The underlined span and the canonical value can be different capture groups. The airfield pattern matches a trailing `//` so the boundary sees past it, underlines the label and the code, and parses the code. The `//` stays in the message.

Short date-time groups resolve against the post's `CreateAt`. Two posts from different months do not share a card. The lookup receives the post id and that timestamp, and the cache key includes the reference month for a token that omitted it.

### 3.2 Reader settings

The plugin keeps owning the values. Core stores one opaque JSON document per plugin per user, passes it to lookup, and hashes it into the user cache key. Core does not know what a zone is, does not apply defaults, and does not grow a `zones` type. An absent document is passed as absent. The plugin applies the built-in zone table.

Tactical Fusion's existing preference blob moves as that one document, so a save cannot drop the location, CoT, or GeoJSON sections. The first read copies a blob already in the plugin KV, including a zone stored as a bare IANA string. The plugin still validates the zone list (25, 64 characters each) and the urgent window (1 to 1440). Restore defaults deletes the document.

Only the zone list changes the card rows, but the hash covers the whole document. A change to a hidden row busts that reader's cards. That is a few extra lookups, and it keeps one store.

The urgent window does not change the stored rows. The card carries absolute times. The client flashes the countdown from the window it already has, the way the page does today.

There is no server-scoped entity setting. Admin switches stay plugin configuration. The provider reads them and omits a map from the card when the panel switch is off. A dataset reload bumps a generation on the provider, and that generation is part of the cache key, so a new file does not wait for the TTL.

### 3.3 What stays outside a matcher

| Feature | Decision |
|---|---|
| Cursor on Target, GeoJSON, and the aviation-report stamp | Custom post types. The read path keeps skipping them |
| Aviation report inside a sentence | Still a rewrite for this migration. It has its own line-start boundary and is not the stamp |
| Inline coordinate map, and the airfield route | Custom post types. A route is several codes on one post. One lookup cannot see the others. `custom_tf_location` and `custom_tf_airfields` are allow-listed so the entities in that message still hydrate. CoT and GeoJSON stay skipped |
| Map packages, dataset directories | Plugin configuration. Unchanged |
| Standalone pages | Unchanged. A card URL may point at one |
| Bridge | Still returns markdown to other plugins. It has no reader and does not start returning entity metadata |
| MCP, slash-command examples, help pages | Unchanged, apart from the help that describes a format on the day it stops rewriting |
| Already rewritten posts | Stay rewritten and keep the current click handler |
| Protected ranges | Location, airfields, and cyber do not move until core also skips emails, `www` URLs, tilde fences, reference links, and USMTF `//` blocks. Otherwise those grammars match inside text Tactical Fusion currently leaves alone |

The side-panel map is a payload the Tactical Fusion webapp draws with its own map stack. Core does not bundle MapLibre or the basemap. Core caps the point count and the GeoJSON bytes and rejects a geometry it cannot parse. The payload is one point, one cell, or one runway pair. It is not a route.

## 4. API

### 4.1 Matchers

```go
type EntityMatcher struct {
    ID         string
    TypeID     string
    Pattern    string
    ValueGroup int      // canonical value. Zero is the whole match
    SpanGroup  int      // underlined span. Zero means the value group
    URL        string   // {value} and {name}, repeatable. https, http, or a root-relative path
    Scope      []string // "team" or "team/channel". Empty means everywhere
    Boundary   string   // empty means token
    SkipBots   bool     // zero value false: bots are scanned
    Validate   bool     // plugin must accept the value before the span is stored
}

UnregisterEntityMatcher(id string) *model.AppError
```

`SkipBots` replaces the draft's `IncludeBots`, whose zero value would have flipped every matcher registered today. `Boundary` replaces the two guard flags for the same reason, and because the flags did not compose with `word` and `strict`.

Scope is filtered when the post is read, from the channel's team name and channel name. It is not part of the global pattern generation. A scoped matcher stores nothing the client can see in a direct or group message. Named groups travel on the span only when the link template needs them, and they are capped in count and size.

`Validate` calls the plugin with the value, the groups, and the post time. A rejection leaves the text plain and lets a shorter match win. Generation changes when a matcher is added, removed, or its pattern, groups, boundary, bot flag, or template changes.

### 4.2 Settings

```go
type EntitySetting struct {
    ID          string // one per plugin in this migration: the preferences document
    Scope       string // "user"
    Label       string
    AffectsCard bool
}

RegisterEntitySettings(settings []EntitySetting) *model.AppError
SetEntitySetting(id, userID string, value json.RawMessage) *model.AppError
// A nil value deletes the document.
```

Lookup receives the document for a `user` provider. A `shared` provider receives neither the user id nor the document. Putting the user id on a shared lookup would let one reader's card be stored for everyone.

The user cache key is the provider, the type, the value, the user, the hash of every setting with `AffectsCard`, the provider's dataset generation, and, for a short date-time group, the reference month. Invalidation is a new key. Nothing scans the cache to delete a prefix.

### 4.3 Lookup

```go
type EntityLookupRequest struct {
    ProviderID string
    TypeID     string
    Value      string
    Groups     map[string]string
    PostID     string
    CreateAt   int64
    UserID     string                     // empty when the provider is shared
    Settings   map[string]json.RawMessage // empty when the provider is shared
}
```

The card request is a post id and an occurrence id. Core checks that the reader can read the post, that the occurrence is on it, and then fills the value, the channel, and `CreateAt`. The client does not send a channel id or a team id. Locale is omitted. Weekday and month names in a date-time card stay English, which is what the plugin renders today.

### 4.4 Map payload

```go
type EntityCardMap struct {
    Kind    string           // "point", "cell", "runway"
    Points  []EntityCardPin  // lat, lon, label. A runway has two. A cell has its ring
    GeoJSON json.RawMessage  // optional, size-capped, parsed by core
}
```

`Exploited` counts as a body, with summary, rows, score, severity, vector, related links, sections, and a map. One function in the model package is the test the webapp, Weave, and the server all use. The fallback sentence is not a body.

### 4.5 Not added

- A write-time rewrite mode.
- Chained replacements, visible relabeling, redaction, and inserted mentions.
- A callback boundary.
- A second admin list.
- Server-scoped settings that copy a plugin configuration switch.
- A core zone type.
- Channel or team fields supplied by the client.
- Reader context on the bridge.
- An airfield route inside one entity card.
- MapLibre inside core.

## 5. Weave

One global automation is one link, and it counts against Weave's own limit of fifty matchers. Tactical Fusion has its own limit. The two do not share a pool.

The trigger grows the matcher fields in 4.1. A link with no rows registers no provider, and the id is an anchor. Rows, a summary, or a map register a provider, and the click opens the panel. The `WX-100` automation is the second kind. An `MM-123` automation with only a destination is the first.

The import tool accepts a single markdown link whose label equals the full match, translates `$name`, `${name}`, `$1`, and `$$`, and writes a Weave automation. Every other rule is listed and left on Autolink, including redaction, mentions, visible relabeling, URL-shaped patterns, and rules owned by an `AdminUserIds` account that is not a system admin. Overlap order and the lack of chaining are in that report.

`/autolink test` is a later Weave action. It is not required to prove the link.

## 6. Order

1. Matcher fields, `has_card` on the span, unregister, the render rule, and the body predicate. Tests: `MM-123` is an anchor, a scoped link is plain in a direct message and a group message, `SkipBots` false still scans a bot, and removing a matcher changes the generation.
2. Lookup by post id and occurrence id, with `CreateAt`. Shared lookups still omit the user.
3. The preferences document, the user cache key, and the provider generation. Two zone lists produce two cards. An empty document yields the built-in zone table. The card has no urgent flag.
4. Weave link automations, then the `MM-123` proof in the client. No import tool yet.
5. Re-register frequency, CVE, IPv4, and ATT&CK on `strict`. Point their cards at `Describe` and delete the live HTTP fetch.
6. Count Tactical Fusion's patterns. Raise that plugin's matcher cap if the set does not fit in fifty. Then CWE, hashes, tactics, and IPv6, and only then stop the cyber rewrite. Then date-time groups, then location grammars whose preset and protected ranges exist, then labeled airfields. Each one stops rewriting only when its whole set has registered.
7. The panel map payload, drawn by the Tactical Fusion webapp. Inline maps and routes stay stamped. Allow-list the two decoration post types so their text entities still hydrate.
8. Protected-range parity is a gate in front of step 6, not a follow-up after it.

Mobile rendering of a URL-only span gates turning Autolink off. It does not gate the API or the Tactical Fusion work.

## 7. Proofs

- `MM-123` in town square is a link to the Jira browse URL. The stored message is still `MM-123`. The side panel does not open. The same token in a direct message and in a group message is plain when the link is scoped to town square.
- A bot post containing `MM-123` stays plain for a migrated rule, and is still underlined for a Tactical Fusion matcher.
- `091630Z` posted in September resolves to September for every reader, including a reader who opens it in October. A second user with a different zone list sees different clocks. Neither card says "urgent".
- Deleting the preferences document restores the built-in zone table, and the location and CoT sections of the old blob are still there.
- `CVE-2023-4966` still opens its card, and the server log shows no request to NVD while it does.
- `DTG: 091630ZAUG26` leaves the label in the message and underlines the token.
- A message that is only `ICAO: PHNL` is not rewritten into a table. The panel shows the field. A message that is only `KIND` stays plain.
- A post stamped with the inline location map still underlines a date-time group in the same message.
- A Cursor on Target post still renders through Tactical Fusion.

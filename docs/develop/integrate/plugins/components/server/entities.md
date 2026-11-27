---
title: "Entities"
sidebar_position: 25
---

Entities let a plugin recognize tokens in message text (CVEs, ticket IDs, coordinates, and similar) and show a card when a reader opens a mention. Core owns parse-on-read; your plugin registers types and matchers, optionally returns cards, and can supply leading mention badges.

Feature flag: `Entities` (and related server configuration). When entities are disabled, registration API calls return `app.entities.disabled.app_error` (`model.EntitiesDisabledError`).

For method signatures, see the [server plugin SDK reference](/developers/integrate/reference/server) (`RegisterEntityType`, `RegisterEntityMatcher`, `RegisterEntityProvider`, `EntityLookup`, `EntityBadges`).

## Register on activate

In `OnActivate` (and again when configuration changes what you offer):

1. **`RegisterEntityType`** — local `Name` becomes `<plugin_id>:<name>` everywhere else. Optional static `Badge` on the type is the default mention chrome when no dynamic badge is returned.
2. **`RegisterEntityMatcher`** — RE2 `Pattern` plus `Type` (your type name or a built-in id such as `mm:time`). Set `SkipBots` / `Scope` / `URL` as needed.
3. **`RegisterEntityProvider`** — list the types you describe. `HasCard: true` enables the `EntityLookup` hook. `Cache` is `none` (default), `shared`, or `user`.

```go
_ = p.API.RegisterEntityType(&model.EntityType{
    Name: "ticket", DisplayName: "Ticket",
    Badge: &model.EntityBadge{Text: "T", Color: model.EntityBadgeColorNone},
})
_ = p.API.RegisterEntityMatcher(&model.EntityMatcher{
    Name: "ticket", Type: "ticket",
    Pattern: `TKT-[0-9]+`, Boundary: "token", SkipBots: true,
    URL: "https://tickets.example.com/{value}",
})
_ = p.API.RegisterEntityProvider(&model.EntityProvider{
    Name: "tickets", Types: []string{"ticket"},
    HasCard: true, Cache: model.EntityCacheShared,
})
```

## EntityLookup

Implement `EntityLookup` to return a `model.EntityCard` for a value you provide. Return `(nil, nil)` when the type is not yours so other providers can answer. Always call `model.NormalizeEntityCard` before returning.

Prefer a Mattermost Blocks body (`card.Blocks`, including [`fields`](/developers/integrate/reference/mm-blocks#fields) blocks) over legacy `Summary` / `Rows` alone. Normalization migrates legacy body fields into blocks when `Blocks` is empty.

## Dynamic badges (`EntityBadges`)

Static badges live on `EntityType.Badge`. For **per-value** chrome (for example a CVSS severity letter), set `DynamicBadge: true` on the matcher and implement `EntityBadges`.

```go
_ = p.API.RegisterEntityMatcher(&model.EntityMatcher{
    Name: "cve", Type: "cve",
    Pattern: `CVE-[0-9]{4}-[0-9]{4,}`, Boundary: "token",
    DynamicBadge: true,
})
```

### Request and response

`EntityBadgeRequest.Items` is a batched, deduped list (at most 100). Return one `*EntityBadge` per item **in the same order**; `nil` means no badge for that item.

```go
func (p *Plugin) EntityBadges(c *plugin.Context, req *model.EntityBadgeRequest) ([]*model.EntityBadge, error) {
    out := make([]*model.EntityBadge, len(req.Items))
    for i, item := range req.Items {
        // Look up from local data only — do not call the network.
        out[i] = p.badgeFor(item.Type, item.Value)
    }
    return out, nil
}
```

The request carries **no user or post**. The answer is stored with the pattern cache for every reader of that post. Do not call `EntityLookup` or the network from this hook; invalid badges are dropped by the server.

### `EntityBadge` shape

Exactly one of `Text` or `Icon` must be set.

| Field | Rules |
| --- | --- |
| `Text` | 1–4 runes; mutually exclusive with `Icon` |
| `Icon` | Compass glyph allowlist: `shield-outline`, `shield-alert-outline`, `alert-outline`, `lock-outline` |
| `Color` | Optional: `none`, `low`, `medium`, `high`, `critical` (empty is treated like none) |

Minimum server version for `EntityLookup` and `EntityBadges`: **12.2**.

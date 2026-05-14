# Post Policy (ABAC for posts) — Architectural Research

This report investigates the codebase to scope a new Post Policy
feature: per-channel CEL expressions referencing `post.attributes.*`
and `user.attributes.*`, evaluated post-fetch and used to hide post
bodies the requester is not authorized to see.

All paths are absolute.

---

## 1. CEL infrastructure (enterprise + core)

### Where the CEL engine lives

- `/Users/mgdelacroix/dev/enterprise/access_control/service.go` — wires
  the env, the policy cache, and the evaluator. `Service.Init`
  (line 145) constructs `*cel.Env` once.
- `/Users/mgdelacroix/dev/enterprise/access_control/engine/compiler.go`
  — compiles each policy's expression into a `cel.Program`. Uses
  `env.Compile(expr)` (line 53) then `env.Program(ast)` (line 61).
- `/Users/mgdelacroix/dev/enterprise/access_control/evaluation/evaluator.go`
  — runs `program.ContextEval(ctx, evalCtx)` (line 164). `evalCtx` is
  `map[string]any{"user": *pb.Subject, "resource": *pb.Resource}`
  (line 67).
- `/Users/mgdelacroix/dev/enterprise/access_control/cel_utils/` —
  reusable env libraries (session functions, attribute normalizer,
  attribute extractor, SQL-izer, visual format).
- `/Users/mgdelacroix/dev/enterprise/access_control/pb/access_control.proto`
  — the `Subject` / `Resource` protos used as CEL types.

### Current variable bindings

In `service.go:148-153` the env is built with exactly one bound
variable:

```go
cel.NewEnv(
    cel.Types(&pb.Subject{}),
    cel.Types(&pb.Resource{}),
    cel.Variable("user", cel.ObjectType("pb.Subject")),
    cel_utils.SessionLib(),
)
```

- `user` is bound as the `pb.Subject` proto. `Subject.attributes` is
  `map<string, google.protobuf.Value>`, so `user.attributes.<field>`
  works.
- `resource` has a registered Type but **no variable binding**, so
  expressions today cannot reference `resource.*`. The evaluator
  passes `resource` in `evalCtx` regardless — harmless but unused at
  the language level.

### Extending the env with `post`

Direct and small: add another `cel.Variable("post", ...)` line and
populate `evalCtx["post"]` at evaluation time. Two options:

1. **Reuse the `pb.Subject` proto shape** by binding
   `post` as `cel.ObjectType("pb.Subject")` (since it already has an
   `attributes` map field). Cheapest path. Slight semantic abuse but
   no proto edits, no codegen.
2. **Add a `pb.PostResource` proto** with `id`, `channel_id`,
   `user_id`, `attributes`. Cleaner long-term, requires regenerating
   `access_control.pb.go`.

For demo: pick option 1.

### Walking the AST to extract referenced attribute keys

This already exists and is exactly what we need:

- `/Users/mgdelacroix/dev/enterprise/access_control/cel_utils/attributes.go`
  — `ExtractAttributes(ast *cel.Ast) (map[string][]string, error)`.
  Walks the parsed expression and returns
  `{attributeName -> [literal values it's compared to]}`.
- The extractor today returns only the **last selector field** (line
  214 in `selectorField`): for `user.attributes.team` it returns key
  `team`. It does **not** distinguish `user.attributes.x` from
  `post.attributes.x` — both yield `x`. For Post Policy we want to
  know which keys belong to which root selector.

Two practical paths:

- Write a thin `ExtractPostAttributes(ast)` variant that walks the
  same AST but only records selectors whose chain root is `post`
  (matching `post.attributes.<field>`). The walker code is short
  enough to fork; mark it `// quick-port from ExtractAttributes`.
- Or call `ExtractAttributes` and use it loosely — given a known
  list of post fields, intersect the result map's keys with the
  channel's post-property field names. Less precise (ambiguity if a
  user CPA and a post field share a name) but zero new walker code.
  Acceptable for a demo.

The compiler already stores extracted attributes on the rule:
`engine/compiler.go:66-74` calls `ExtractAttributes` once at compile
time and stashes them on `CompiledRule.Attributes`. We'd do the same
for post-attribute keys.

### How `*einterfaces.AccessControlServiceInterface` is wired

- Registered in `enterprise/access_control/service.go:46`:
  ```go
  app.RegisterAccessControlServiceInterface(func(a *app.App) einterfaces.AccessControlServiceInterface {
      return NewService(a)
  })
  ```
- Interface composition:
  `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/einterfaces/access_control.go`
  combines `PolicyAdministrationPointInterface` (`pap.go`) and
  `PolicyDecisionPointInterface`.
- App-side accessor: `a.Srv().Channels().AccessControl` (see
  `setupBroadcastHookForAbacFiles` at `post.go:1046`). When the
  enterprise package is not linked, this is `nil` — meaning every
  consumer guards `if a.Srv().Channels().AccessControl == nil`.
- App-level helper for building the subject:
  `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/channels/app/access_control.go:686`
  `BuildAccessControlSubject(rctx, userID, roles)` — already loads
  the user's materialized CPA attributes from the store. We can use
  this verbatim for the `user` side of the eval context.

### Evaluating CEL from the core app layer

There is no public "evaluate this raw expression with custom
variables" method on the interface today. Closest extant entrypoints:

- `PolicyDecisionPointInterface.AccessEvaluation(rctx, AccessRequest)`
  — runs the resource-policy + permission-policy lanes on a
  resource-bound policy. Wrong shape: no `post` binding, no
  per-post inputs.
- `PolicyAdministrationPointInterface.QueryUsersForExpression` —
  compiles an expression but evaluates it as a SQL-pushdown, not as
  in-process CEL.

Three implementation options:

1. **Add a new method on the enterprise service**, exposed via the
   interface, e.g.
   `EvaluatePostPolicies(rctx, channelID, post, subject) (allow bool, err)`.
   Cleanest but touches the einterface and the mock.
2. **Add a generic `EvaluateExpression(rctx, expr, vars map[string]any) (bool, error)`**
   on the interface. Very small, reusable for future "raw" needs.
3. **Cache compiled post policies inside the enterprise service**
   keyed by channel, evaluate them inline when the app asks.

Option 2 is the smallest path for a demo (one new interface method,
one new method on `*Service`, one new line in the mock). Option 3 is
where this naturally lands long-term.

### License & feature-flag gating

`Service.isReady` (`service.go:124`) gates everything on:

```go
if !model.MinimumEnterpriseAdvancedLicense(s.app.License()) { ... }
if !s.app.Config().FeatureFlags.AttributeBasedAccessControl { ... }
if !*s.app.Config().AccessControlSettings.EnableAttributeBasedAccessControl { ... }
```

Implication for a demo:

- Cannot run any of the enterprise CEL stack on a vanilla core build
  without a license stub. The dev environment used for the existing
  ABAC features works, so reusing that path is fine.
- For an even cheaper demo we could **inline a tiny CEL helper in
  the core build** using `github.com/google/cel-go` directly (the
  go.mod already pulls it transitively via enterprise; verify before
  committing). That would let us demo without a license at all.
- Recommendation: pick the existing path (enterprise + license)
  since the same demo box already runs Membership Policy. Gate the
  new behavior behind a feature flag, e.g. `FeatureFlags.PostPolicy`.

---

## 2. Membership Policy / Access Rules UI

### Channel-settings entry point

- `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/webapp/channels/src/components/channel_settings_modal/channel_settings_access_rules_tab.tsx`
  — the tab body. Loads attributes, loads the channel policy via
  `useChannelAccessControlActions(channel.id)`, renders a
  `TableEditor` (simple builder) and persists changes through
  `actions.updateAccessControlPolicy` (see how the file calls
  validation + save further down).
- Companion modals/files in the same directory:
  `channel_access_rules_confirm_modal.tsx`,
  `channel_activity_warning_modal.tsx`,
  `channel_settings_access_rules_activity_warning.test.tsx`,
  `channel_settings_access_rules_tab.scss`.

### Shared editor components (admin_console/access_control/editors)

- `editors/table_editor/table_editor.tsx` — the **simple builder**.
  Parses CEL via `actions.getVisualAST(expr)` → array of
  `TableRow{attribute, operator, values, attribute_type}`; serializes
  rows back to CEL via `rowToCEL`. Currently hardcoded to prefix
  selectors with `user.attributes.` (line 29) and to strip exactly
  16 chars on parse (line 116). To support `post.attributes.*` rows,
  this prefix has to become configurable (or a sibling editor must
  be written that mirrors the same shape).
- `editors/table_editor/attribute_selector_menu.tsx`,
  `value_selector_menu.tsx`, `operator_selector_menu.tsx`,
  `multi_value_selector_menu.tsx` — the row-level pickers.
- `editors/cel_editor/editor.tsx` — the **advanced raw editor**
  (Monaco-based, with `language_provider.tsx` providing the CEL
  language). Generic; doesn't care which variables are referenced.
- `editors/shared.tsx` + `shared.scss` — `OPERATOR_CONFIG`,
  `OPERATOR_LABELS`, `OperatorLabel`, `AddAttributeButton`,
  `TestButton`, `HelpText`, multi-value detection. Reusable as-is.

### Data model and Client4 wiring

- Type: `@mattermost/types/access_control` — `AccessControlPolicy`,
  `AccessControlPolicyRule`. The membership rule is identified by
  helper `getMembershipRule(rules)` and constructed via
  `buildRulesWithMembership(...)`. The `Rule.Actions` slice keys the
  rule type ("membership", "upload_file_attachment", etc.).
- Hook: `hooks/useChannelAccessControlActions.ts` (verify path) wraps
  Client4 calls.
- Client4 (server side, `client4.ts`) talks to
  `/api/v4/access_control_policies` and the channel-scoped helpers.
  Backend handler in
  `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/channels/api4/access_control.go`
  (verify path) calls
  `a.Srv().Channels().AccessControl.SavePolicy(...)`.
- Storage layer: `store.AccessControlPolicyStore`
  (`/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/channels/store/store.go:1165-1175`).

### Reuse map for Post Policy UI

| Surface needed                       | Reuse from                                    |
|--------------------------------------|-----------------------------------------------|
| Tab below "Access Rules" in channel settings modal | duplicate `channel_settings_access_rules_tab.tsx` shape |
| Simple builder rows                  | `TableEditor` with a `selectorPrefix` prop (`user.attributes.` / `post.attributes.`) |
| Mixed `post + user` rows in one rule | one TableEditor + a "scope" column (post vs user), or two stacked editors joined with AND |
| Raw CEL editor                       | `cel_editor/editor.tsx` (unchanged) |
| Attribute picker                     | `attribute_selector_menu.tsx` (fed with post-property fields instead of `UserPropertyField[]`) |
| Operator picker / multi-value picker | unchanged |
| Save panel, confirm modal            | reuse `SaveChangesPanel`, `ConfirmModal` |
| Backend save/load                    | extend `AccessControlPolicyStore` or add a parallel store |

---

## 3. Post properties (this POC)

### Where post property fields live

- Group registered at boot via
  `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/channels/app/migrations.go:809`
  (`doSetupChannelPostProperties`): a single PSAv2 group named
  `model.ChannelPostPropertyGroupName`, version
  `PropertyGroupVersionV2`.
- Field rows are stored in the standard PropertyField store (channel
  ID is encoded on the field; see `property_field.go` and
  `IsPSAv2()` check at line 250).
- App methods live in
  `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/channels/app/property_field.go`
  and `property_value.go` (CRUD + WS broadcast on changes).

### Where post property values live

- Stored as standard `PropertyValue` rows with
  `TargetType = "post"` and `TargetID = postID`. Group ID is the
  channel-post group; the field IDs identify which property.
- Created/upserted via `App.UpsertPropertyValues`
  (`property_value.go:135`), which also broadcasts
  `WebsocketEventPropertyValuesUpdated` scoped to
  `(team, channel, post)` so clients can refresh.

### Are property values attached to `*model.Post` on fetch?

**No.** Examined `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/public/model/post.go`
and `post_list.go` — there is no `Properties`, `PropertyValues`, or
similar field. The webapp fetches values via a separate REST call.
The only post-property-specific endpoint observed during this audit
is content-flagging-scoped:
`/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/channels/api4/content_flagging.go:27`
(`/content_flagging/post/{post_id}/field_values`). There is **no
general** "give me all PSAv2 values for these post IDs" endpoint
yet.

Frontend confirmation:
- `webapp/channels/src/components/post_property_chips/post_property_chips.tsx`
  calls `loadPostPropertyValues(postId)` on mount. Action lives at
  `mattermost-redux/actions/properties` (imported by both the chips
  component and `rhs_post_properties_panel/index.tsx`).

### What `*model.Post` looks like at filter time

A standard `Post` struct — no property values inline. If the filter
runs server-side, it must **load values for the candidate posts**
itself (one batched store call per fetch). Otherwise we hand the
client the policy and let it decide, but then secrecy is lost.

Conclusion: server-side filtering must look up
`PropertyValue` rows for posts that carry any of the policy's
referenced field IDs.

---

## 4. Custom Profile Attributes (CPA)

### Where the values live and how to fetch them

- Group: `model.CustomProfileAttributesGroupName` (PSAv2). Group ID
  cached on the app via
  `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/channels/app/custom_profile_attributes.go:26`
  `App.CpaGroupID()`.
- Field defs: `CPAField` (wraps `PropertyField`), CRUD in
  `custom_profile_attributes.go`.
- Per-user materialized view fetched via
  `store.AttributesStore.GetSubject(rctx, userID, groupID)`
  (`store/store.go:1179`). Returns a `*model.Subject` with
  `Attributes map[string]any`.
- The materialized view is refreshed by
  `App.refreshAttributeViewIfStale` (lazy, ≤30s).

### Single helper to use

`App.BuildAccessControlSubject(rctx, userID, roles)`
(`server/channels/app/access_control.go:686`). This is the canonical
"give me this user with their CPA attribute map" call. Use it
directly for the `user` half of the post-policy eval context.

### Availability on `*model.User` in the request path

CPA values are **not** populated on `*model.User` in the request
path. They live in the materialized attribute view and are looked
up by user ID. So a Post Policy filter must explicitly call
`BuildAccessControlSubject` for the requester. This is cheap (an
LRU/store read) and matches what the existing ABAC code does.

---

## 5. Post-fetch paths — where to inject the filter

### The BurnOnRead analog

The user's intuition is correct: BurnOnRead is **the** pattern to
copy. Two helpers and many call sites:

- Filter helper: `App.filterBurnOnReadPosts(postList)` at
  `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/channels/app/post_helpers.go:270`.
  Walks `postList.Posts`, removes/blanks the targeted posts, fixes
  up `Order`, `NextPostId`, `PrevPostId`.
- Reveal helper: `App.revealBurnOnReadPostsForUser(rctx, postList, userID)`
  at `post_helpers.go:363`. Per-user materialization; the inverse of
  filter.

### Every user-facing post fetch (in `server/channels/app/post.go`)

The `revealBurnOnReadPostsForUser` call sites give us the complete
enumeration we need:

| Function (line)                                | Purpose                              | Hook |
|-----------------------------------------------|--------------------------------------|------|
| `GetPostsPage` (1225)                          | channel page                         | after revealBOR, before applyHook |
| `GetPostsForView` (1255)                       | view-scoped page                     | same |
| `GetPosts` (1282)                              | basic channel posts                  | same |
| `GetPostsSince` (1323)                         | delta since timestamp                | same |
| `GetPostThread` (1443)                         | thread root + replies                | same |
| `GetFlaggedPosts` (1481)                       | user's flagged                       | same |
| `GetFlaggedPostsForTeam` (1503)                | flagged in team                      | same |
| `GetFlaggedPostsForChannel` (1525)             | flagged in channel                   | same |
| `GetPermalinkPost` (1547)                      | permalink                            | calls `revealSingleBurnOnReadPost`; hook there |
| `GetPostsBeforePost` (1591)                    | pagination cursor                    | same |
| `GetPostsAfterPost` (1627)                     | pagination cursor                    | same |
| `GetPostsAroundPost` (1663)                    | jump-to                              | same |
| `GetPostsForChannelAroundLastUnread` (1810)    | last-unread jump                     | same |
| `SearchPostsForUser` / `searchPostsInTeam`     | search                               | `filterBurnOnReadPosts` is also invoked from search results path (`post.go:2009, 2182`) |
| `GetSinglePost` (1413)                         | single post                          | hook here for permalink-style hides |
| `GetPostsByIds` (2624)                         | batch by IDs                         | not currently BOR-gated; review |

There is **no single chokepoint**. Reveal/filter is applied at each
entrypoint individually. We should mirror this pattern: add a
`filterPostsByPostPolicy(rctx, postList, userID)` helper and call it
in the same set of functions, right after the BOR reveal step.

Note: `applyPostsWillBeConsumedHook` (the post-WillBeConsumed plugin
hook) runs *after* the BOR reveal in every site, so policy filtering
should run *before* it (plugins shouldn't see blanked posts as if
they were the source of truth).

### Risk: per-fetch evaluation cost

For N policies in a channel and M returned posts:
- Compile programs once at policy save (already the pattern in
  `engine/compiler.go`). Cache compiled programs per channel.
- For each post, look at which fields it carries; if it has any
  field referenced by policy P, run P. Otherwise skip.
- Subject is loaded once per request, not once per post.

Eval per post should be sub-millisecond with cached programs.

---

## 6. WebSocket post broadcast

### Where new posts are pushed

- All websocket emissions for a new post route through
  `App.publishWebsocketEventForPost` at
  `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/server/channels/app/post.go:985`.
- BurnOnRead handles per-recipient hiding via a **broadcast hook**
  (`processBroadcastHookForBurnOnRead`, line 1158) that swaps the
  payload per recipient. ABAC file attachments do the same
  (`setupBroadcastHookForAbacFiles`, line 1045). These hooks are the
  established mechanism for per-recipient WS filtering.

### Does the REST pipeline also handle WS?

No. The REST fetch goes through `revealBurnOnReadPostsForUser` /
`filterBurnOnReadPosts`. The WS pipeline has its own per-recipient
hooks. They are independent. Filtering only on REST means a
freshly-posted message **will** leak via the live WS push to clients
that should not see it.

### MVP recommendation

For a demo:

1. **MVP — REST only.** Filter on every REST `GetPosts*` and search
   path. Skip the WS hook. Live posts may briefly appear in the
   composer of clients who shouldn't see them; on next fetch they
   disappear. Document this as a known follow-up.
2. **Phase 2 — WS hook.** Add a `postPolicyBroadcastHook` mirroring
   `processBroadcastHookForBurnOnRead`. Each recipient gets either
   the full post or a blanked variant. This is a clean, focused
   addition once the REST path is proven.

---

## 7. Channel-scoped storage for post policies

Two practical options:

### Option A — extend `AccessControlPolicy`

`model.AccessControlPolicy` already has `Type` (`parent`, `channel`,
`permission`) and rules with `Actions`. Add `Type = "post"` (or a
new `Action = "post_filter"`).

Pros:
- Reuses the existing store, API, normalizer, AST extractor, cache
  invalidation, cluster events.
- The webapp's `AccessControlPolicyStore` interface already has
  `GetPoliciesByFieldID` (used to invalidate caches when a property
  field changes) — directly useful for invalidating post policy
  caches when a post-property field changes.
- Adds a versioned validation branch in
  `accessPolicyVersionV0_3` (`model/access_policy.go:266`).

Cons:
- The existing `Action` enumeration only allows three values
  (line 33). Need to add one.
- Existing UI flows that iterate over channel policies might pick
  up post policies and treat them as membership policies. Must filter
  by action.

### Option B — dedicated `PostPolicy` table + store

Pros: clean separation; smaller blast radius.
Cons: duplicates CRUD, API, store, cache, normalization, WS
invalidation. A lot of code for a demo.

### Recommendation

**Option A.** Add `AccessControlPolicyActionPostFilter = "post_filter"`
to the allowed-actions set in `access_policy.go`, and let the existing
store/handlers carry it. Channel-scoped post policies use
`Type = "channel"` (since they're channel-bound and inheritable from a
parent, same shape as Membership Policy) with `Actions: ["post_filter"]`.

The enterprise service then needs:
- A new compile path that recognizes the new action.
- A new evaluator method `EvaluatePostPolicies(channelID, post, subject) (allow bool, error)`
  exposed via the einterface.
- A program cache keyed by channel ID for fast lookup.

---

## 8. Reuse opportunities and risks

### Reuse — frontend (highest yield)

- **`TableEditor`** with a configurable `selectorPrefix` and the
  ability to render rows from either `user.attributes.*` or
  `post.attributes.*`. Two stacked editors joined with AND is the
  minimum-disruption shape; one row table with a "scope" column is
  the more polished shape.
- **`cel_editor/editor.tsx`** — unchanged; raw editor is generic.
- **`SaveChangesPanel`, `ConfirmModal`** — unchanged.
- The whole `channel_settings_access_rules_tab.tsx` body can be
  copied/adapted line-for-line: same load → edit → validate → save
  loop, different policy action.
- `useChannelAccessControlActions` hook — add a `getPostPolicies` /
  `savePostPolicy` set of actions next to the existing membership
  set.

### Reuse — backend

- `ExtractAttributes` AST walker (existing) — for surfacing which
  post fields a policy references.
- `BuildAccessControlSubject` — user side of eval context.
- `engine.CompilePolicy` — reuse with a slightly extended env.
- Filter pattern from `filterBurnOnReadPosts` — copy verbatim.
- Broadcast-hook pattern from `processBroadcastHookForBurnOnRead` —
  copy for Phase 2.

### Risks

- **Unknown-field references.** A policy referencing
  `post.attributes.dept` when no such field exists on the channel
  needs to either skip silently or fail loudly. CEL will error if
  the key isn't on the bound `post` map. Recommend skipping the
  policy with a logged warning rather than denying.
- **CEL errors at eval.** Mid-fetch failures should fail-closed
  (blank the post) and log, never serve raw content on error.
- **License/feature-flag gating** — see Section 1; demo box must
  satisfy `MinimumEnterpriseAdvancedLicense` + flag.
- **Performance** — N policies × M posts. With compiled programs
  cached per channel and only running policies whose referenced
  fields actually appear on the post, real cost is bounded by the
  number of property-value joins. A single batched store call to
  load values for all post IDs in the list is fine; do not query
  per-post.
- **WS leak** in MVP (Section 6). Document.
- **Action enum drift** — adding `post_filter` to the allowed
  actions touches the policy validator; existing v0.3 channel-type
  policies must not be inadvertently rejected.
- **Self-exclusion** — Membership Policy's UI guards against the
  admin locking themselves out. Post Policy can lock the admin out
  of reading their own posts; consider whether to keep an analogous
  guard or document the trap.
- **Edit history / search index leakage** — search results,
  permalinks, and the post edit history endpoint all need the same
  filter. The enumeration in Section 5 covers the search path; edit
  history is a separate API to audit (`/posts/{id}/edit_history`).

---

## Open questions for the user

1. **Policy granularity inside a channel.** Single policy per
   channel (one CEL expression, ANDed with system policies), or
   multiple named policies (deny-wins like Membership)? The PDF
   mocks aren't included in the brief — I assumed single for
   simplicity, but multiple aligns better with existing patterns.

2. **`post + user` row composition.** In the simple builder, do you
   want rows that can mix scopes in one expression
   (e.g. `post.attributes.dept == user.attributes.dept`), or two
   separate panels (post conditions AND user conditions)? The latter
   is cheaper UI but less expressive.

3. **WS path for MVP.** Confirm REST-only filtering is acceptable
   for the demo, with the WS broadcast hook deferred to a follow-up.
   Otherwise the WS hook doubles the implementation scope.

4. **Hide behavior.** When a policy denies a post, do we (a) blank
   `Message`, `FileIds`, `Props` and mark the post with a sentinel
   prop (so the UI can render "hidden by policy")? Or (b) drop the
   post entirely from the list (BurnOnRead's filter mode)? The
   brief says "blank the post body and mark hidden", which is (a) —
   confirm this is the intent for thread replies and search hits as
   well.

5. **Storage shape.** Confirm Option A (`Action = "post_filter"`
   inside `AccessControlPolicy`) vs Option B (dedicated table). I
   recommend A; it's a single new constant and an extra validator
   branch.

6. **License gate for the demo.** Are we running on a license-stub
   build that already satisfies `MinimumEnterpriseAdvancedLicense`,
   or do we need a license-free path (inline CEL helper in core)?

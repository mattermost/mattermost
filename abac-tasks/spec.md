# Post Policy (ABAC for Posts) — Spec

> Companion research: [`research.md`](research.md). Low-level coding
> details live in [`plan.md`](plan.md) once authored.

## 1. Objective

Let a channel admin author **CEL-based policies** that combine post
attributes (from the Properties-on-Posts POC) and user attributes
(CPA) to decide who can read a given post. Policies are enforced on
the server during post fetch. Posts denied by a policy are returned
with a blanked body and a sentinel prop so the client can render a
"hidden by policy" placeholder.

Target outcome: a demoable end-to-end flow on a licensed dev box,
gated behind a feature flag, that reuses Membership Policy's CEL +
UI infrastructure with the minimum surface area of new code.

## 2. Demo workflow

1. Admin creates a user attribute (CPA), e.g. `rank` with values
   `R1|R2|R3`. (Existing feature.)
2. Admin creates a post property field on a channel, e.g.
   `secretlevel` with values `L1|L2|L3`. (Existing POC feature.)
3. Admin tags posts with `secretlevel` values.
4. Admin opens **Channel Settings → Post Policies** (new section
   directly below Access Rules) and adds rules such as:
   `post.attributes.secretlevel == "L1" && user.attributes.rank == "R1"`
5. Other users in the channel see filtered posts:
   - Posts they're allowed: shown normally.
   - Posts denied by a policy whose post attribute is present on the
     post: body blanked, replaced by "Hidden by policy" placeholder
     (sentinel prop set).
   - Posts not touched by any policy's referenced fields: shown
     normally (policies only apply to posts carrying the policy's
     post attribute keys).

## 3. Scope

### In scope (MVP)

- Backend: per-channel storage of multiple post policies, CEL
  compilation/cache, evaluation during REST post fetches, hydration
  of property values for the candidate post set, blank-and-sentinel
  hide behavior.
- Frontend: a new **Post Policies** section in the channel settings
  modal mirroring the Access Rules section (simple builder +
  advanced raw editor).
- Multiple policies per channel, AND across them (deny-wins).
- Mixed `post.* + user.*` rows in a single rule expression.
- Feature flag: `FeatureFlags.PostPolicy`.

### Out of scope (deferred, must be tracked as TODOs in code)

- **WebSocket broadcast filtering.** New posts will briefly leak via
  the live `posted` push to clients that should not see them; they
  disappear on the next REST fetch. Code that emits the WS event
  must carry a `// TODO(post-policy): per-recipient WS hook` comment
  pointing at the deferred work. (Pattern to copy:
  `processBroadcastHookForBurnOnRead`.)
- A dedicated post-policy storage table (we extend the existing
  `AccessControlPolicy` model instead).
- License-free demo path (dev env is licensed).
- Self-exclusion guard (admin can lock themselves out — document
  as a known sharp edge in the demo runbook).
- Edit-history endpoint filtering (separate API; document as
  follow-up).

## 4. Architectural decisions

### 4.1 CEL infrastructure — extend, don't fork

- Reuse the enterprise access-control service
  (`enterprise/access_control/`). Extend its CEL env with one new
  bound variable: `post`, typed as `pb.Subject` (reuses the existing
  attributes-map shape, no proto regeneration).
- Add a new compile path that recognizes the new policy action and
  caches compiled programs keyed by channel ID.
- Expose a new method on the enterprise service via
  `einterfaces.AccessControlServiceInterface`:
  `EvaluatePostPolicies(rctx, channelID, post, subject) (allow bool, err)`.
  Single new interface method, single new mock entry.
- On any CEL eval error: **fail closed** (treat as deny). Log via
  `rctx.Logger().Warn`.

### 4.2 Policy storage — Option A: extend `AccessControlPolicy`

- New action constant `AccessControlPolicyActionPostFilter = "post_filter"`
  in `model/access_policy.go`. Update the v0.3 validator branch.
- Channel-scoped post policies use `Type = "channel"` with
  `Actions: ["post_filter"]`. Existing membership flows must filter
  by action so they don't accidentally treat post policies as
  membership policies.
- Each policy holds one rule with one CEL expression. Multiple
  policies per channel are stored as separate `AccessControlPolicy`
  rows with the `post_filter` action.

### 4.3 Where the filter runs

- New helper `filterPostsByPostPolicy(rctx, postList, userID)` in
  `server/channels/app/post_helpers.go`, alongside the BurnOnRead
  helpers.
- Called from every user-facing post-fetch entrypoint in
  `server/channels/app/post.go`, immediately **after**
  `revealBurnOnReadPostsForUser` and **before**
  `applyPostsWillBeConsumedHook`. Enumerated in Section 5 of
  `research.md` (15 call sites; the new helper mirrors the BOR
  reveal helper's placement at each).
- For `GetSinglePost` and `GetPermalinkPost`, a `filterSinglePost`
  variant blanks the single post in place.

### 4.4 Post-value hydration — `PostWithValues`

- New transient wrapper struct in `server/channels/app/`:

  ```go
  type PostWithValues struct {
      *model.Post
      Values map[string]any // field name -> value, channel-post group only
  }
  ```

- A new `hydratePostValues(rctx, posts) ([]PostWithValues, error)`
  helper batches a single store call to load `PropertyValue` rows
  for all posts in the page, scoped to the channel-post group, and
  pivots them into the map by field name. No per-post queries.
- The CEL `post` variable is constructed from `PostWithValues.Values`
  at eval time.
- `PostWithValues` is **internal to the filter** — never returned
  to the client. The client still sees a `*model.Post` (either
  intact or blanked).

### 4.5 Hide behavior

- Blank `Message`, `FileIds`, `Attachments`, `Reactions` count
  (leave `Id`, `UserId`, `ChannelId`, `CreateAt`, `Type` intact so
  the timeline/order is preserved).
- Set a sentinel `Props["hidden_by_policy"] = true` (constant
  `model.PostPropsHiddenByPolicy`).
- Strip any non-essential props that would leak content (e.g.
  `attachments`, file metadata) — same blanking rules BurnOnRead
  uses, kept in one helper.
- Frontend renders a "Hidden by policy" placeholder when the
  sentinel prop is present (parallel to the existing BurnOnRead
  placeholder UI).

### 4.6 Which policies apply to which posts

- A policy applies to a post **only if** the post carries at least
  one of the post-attribute field IDs referenced by that policy's
  expression. Otherwise the post is unaffected (shown).
- Resolution of "which post-attribute keys does this expression
  reference" reuses `cel_utils.ExtractAttributes` plus a small
  walker that distinguishes selectors rooted at `post` vs `user`
  (sketched in `research.md` §1). Stored on the compiled program
  cache entry so we don't walk the AST per fetch.
- If a post is touched by N applicable policies, **all must allow**
  (deny-wins, AND semantics across policies).
- A policy that references a field not present on the channel's
  post-property field set is logged once at save time as a
  warning, but is not rejected (forward-compat for cross-channel
  inheritance later).

### 4.7 Feature flag and license

- New `FeatureFlags.PostPolicy` flag, default off in core,
  on in the demo env.
- License: relies on the same `MinimumEnterpriseAdvancedLicense`
  gate the enterprise access-control service already enforces. No
  license-stub work in the MVP.

## 5. Data model

```go
// model/access_policy.go (additions)
const AccessControlPolicyActionPostFilter = "post_filter"
const PostPropsHiddenByPolicy = "hidden_by_policy"
```

No new tables. Channel-scoped post policies are
`AccessControlPolicy` rows with:

- `Type = "channel"`
- `Resource = channelID`
- `Actions = ["post_filter"]`
- `Rules[0].Expression = "<CEL expression>"`

Multiple policies for the same channel are multiple rows with
distinct IDs.

## 6. API surface

Reuse the existing `/api/v4/access_control_policies` endpoints —
they already handle CRUD by ID and by resource. The new behavior
is purely a different `Actions` value, which the existing handlers
pass through unchanged. The webapp will list/filter by action
client-side.

If a dedicated convenience endpoint is wanted later
(`/channels/{id}/post_policies`), it's a thin wrapper; **not** in
MVP.

## 7. UI structure

- New file `channel_settings_post_policies_tab.tsx` (and `.scss`)
  in `webapp/channels/src/components/channel_settings_modal/`,
  cloned from `channel_settings_access_rules_tab.tsx`. Loads
  policies for the channel filtered by `Actions: ["post_filter"]`.
- Two stacked editors per policy:
  - `TableEditor` (extended with a `selectorPrefix` prop) to render
    `post.attributes.*` and `user.attributes.*` rows in the same
    grid. A new "Scope" column on each row toggles `post` vs
    `user`. Rows are joined with `&&` when serialized to CEL.
  - `CelEditor` (unchanged) for advanced raw expression mode.
- A "+ Add policy" button creates a new policy row in the section.
  Each policy has its own delete button and its own simple/advanced
  toggle.
- Save uses the same `SaveChangesPanel` and `ConfirmModal` as Access
  Rules.
- Section appears in the channel settings modal **directly below**
  the existing "Access Rules" tab/section (modal navigation TBD in
  `plan.md`: either a sibling tab or a stacked section under the
  same tab).

## 8. Reuse map (compact)

| Surface                | Reuse                                                 |
|------------------------|-------------------------------------------------------|
| CEL compile/eval/cache | `enterprise/access_control/engine.CompilePolicy`, `evaluation.evalPrograms` |
| Attribute extraction   | `cel_utils.ExtractAttributes` + small `post`-rooted variant |
| User subject load      | `App.BuildAccessControlSubject`                       |
| Filter pattern         | `App.filterBurnOnReadPosts` (copy structure)          |
| Storage / API / store  | `AccessControlPolicy` + existing `/access_control_policies` |
| Simple builder         | `editors/table_editor/TableEditor` (+ `selectorPrefix`) |
| Advanced editor        | `editors/cel_editor/editor.tsx` (unchanged)           |
| Save flow              | `SaveChangesPanel`, `ConfirmModal`                    |
| Channel actions hook   | `useChannelAccessControlActions` (extend)             |

## 9. Risks and trade-offs

- **WS leak (deferred).** Live `posted` events bypass the REST
  filter. Acceptable for demo; documented; code-level TODO required.
- **Self-lockout.** No guardrail in MVP; document in runbook.
- **Cross-action UI bleed.** Existing UI that iterates channel
  policies must filter by action so post policies don't appear as
  membership policies. Audit in implementation.
- **Performance.** N policies × M posts per fetch, bounded by
  applicability check. Compiled program cache per channel keeps
  per-eval cost sub-millisecond. Single batched value load per
  fetch.
- **Forward-compat with inheritance.** Channel-scoped only in MVP.
  The data model leaves room for parent policies later.

## 10. Phase progress

| Phase | Description                                                                                              | Status      |
|-------|----------------------------------------------------------------------------------------------------------|-------------|
| 0     | Research and spec                                                                                         | Complete    |
| 1     | Implementation plan (`plan.md`) — low-level coding decisions, file-by-file changes, specific test cases   | Not started |
| 2     | Backend: model + action constant + validator branch + feature flag                                        | Complete    |
| 3     | Backend: extend enterprise CEL env with `post` binding; `EvaluatePostPolicies` interface method + cache   | Not started |
| 4     | Backend: `PostWithValues` hydration + `filterPostsByPostPolicy` helper + sentinel prop                    | Not started |
| 5     | Backend: wire filter into all 15 fetch sites in `post.go` (after BOR reveal, before consumed-hook)        | Not started |
| 6     | Frontend: `channel_settings_post_policies_tab` cloned from access-rules tab                                | Not started |
| 7     | Frontend: extend `TableEditor` with `selectorPrefix` + per-row scope column                               | Not started |
| 8     | Frontend: render "Hidden by policy" placeholder when sentinel prop present                                | Not started |
| 9     | Demo runbook addition: ABAC walkthrough in `abac-tasks/demo-runbook.md`                                   | Not started |

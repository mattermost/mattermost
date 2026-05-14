# Post Policy (ABAC for Posts) — Implementation Plan

> Spec: [`spec.md`](spec.md). Research: [`research.md`](research.md).
>
> This document covers the low-level coding decisions: file
> changes, code shapes, and test cases. Each phase below is a
> vertical slice — small, mergeable, demoable at its boundary.

## Reading guide

- Paths under `server/` and `webapp/` are relative to the worktree
  root `/Users/mgdelacroix/dev/mattermost.properties-on-posts-poc/`.
- Paths under `enterprise/` are relative to
  `/Users/mgdelacroix/dev/enterprise/`.
- "MM-EE" = enterprise repo; "MM-CORE" = core repo (this worktree).
- A slice is **done** when (a) the listed acceptance test passes
  and (b) a checkpoint review confirms scope.

---

## Slice 1 — Model constant + feature flag + validator branch

**Goal.** A policy with `Actions: ["post_filter"]` round-trips
through the existing `/api/v4/access_control_policies` API.

### MM-CORE changes

- `server/public/model/access_policy.go`
  - Add constant:
    ```go
    AccessControlPolicyActionPostFilter = "post_filter"
    ```
    next to lines 26–28.
  - Add to `validActions` map (line 34–36):
    ```go
    AccessControlPolicyActionPostFilter: true,
    ```
  - In `accessPolicyVersionV0_3` (line 266) validator branch, allow
    `Type == "channel"` policies whose `Actions` is exactly
    `[AccessControlPolicyActionPostFilter]` to skip any
    membership-only checks.
  - Add sentinel constant for the hide flag:
    ```go
    PostPropsHiddenByPolicy = "hidden_by_policy"
    ```

- `server/public/model/feature_flags.go`
  - Add field (group with the existing ABAC flags around line 70):
    ```go
    PostPolicy bool
    ```
  - In `SetDefaults` (line 115), default to `false`.
  - Document the dependency in a comment: `// Depends on AttributeBasedAccessControl.`

- `server/config/client.go`
  - Surface `PostPolicy` into the client feature-flag map (mirrors
    how `IntegratedBoards` is surfaced).

### Test cases beyond standard

- `model/access_policy_test.go`:
  - A policy with `Type=channel`, `Actions=["post_filter"]`, valid
    expression → `IsValid()` returns nil.
  - Same policy with `Actions=["membership","post_filter"]` →
    rejected (single-action invariant).
  - `Actions=["post_filter"]` with `Type=parent` → rejected (post
    policies are channel-scoped in MVP; parent inheritance is
    deferred).
- `model/feature_flags_test.go`: default value is `false`.

### Acceptance

Curl flow on the demo box:
```bash
curl -X POST $URL/api/v4/access_control_policies \
  -d '{"type":"channel","resource":"<CH>","actions":["post_filter"],"rules":[{"expression":"post.attributes.secretlevel == \"L1\""}]}'
curl $URL/api/v4/access_control_policies/<id>
```
Round-trip OK. No filtering yet — backend wiring lands in Slice 3.

---

## Slice 2 — Enterprise CEL env extension + service method

**Goal.** From the channels app layer, calling
`EvaluatePostPolicies(rctx, channelID, postWithVals, subject)` returns
`(allow bool, err error)` using compiled policies for the channel.

### MM-EE changes

- `enterprise/access_control/service.go` (line 145, `Service.Init`)
  - Extend the env:
    ```go
    env, err := cel.NewEnv(
        cel.Types(&pb.Subject{}),
        cel.Types(&pb.Resource{}),
        cel.Variable("user", cel.ObjectType("pb.Subject")),
        cel.Variable("post", cel.ObjectType("pb.Subject")), // NEW — reuses Subject shape
        cel_utils.SessionLib(),
    )
    ```
  - Add per-channel compiled-program cache:
    ```go
    postPolicyPrograms sync.Map // channelID -> []postPolicyEntry
    type postPolicyEntry struct {
        id          string
        program     cel.Program
        postAttrs   map[string]struct{} // keys referenced under post.attributes.*
    }
    ```
  - Invalidation: on `SavePolicy` / `DeletePolicy` whose action is
    `post_filter`, clear the entry for that channel ID.

- `enterprise/access_control/cel_utils/attributes.go`
  - Add `ExtractAttributesByRoot(ast *cel.Ast) (map[string]map[string][]string, error)`
    that returns `{rootName: {attrName: [literals]}}`. The walker is
    the existing one with one extra step: record the root identifier
    of each selector chain (the leftmost `Ident`) alongside the leaf
    name. Use this in the service to populate `postAttrs` (root ==
    `"post"`).

- `enterprise/access_control/service.go` — new method:
  ```go
  func (s *Service) EvaluatePostPolicies(
      rctx request.CTX,
      channelID string,
      post *model.PostWithValues,
      subject *pb.Subject,
  ) (bool, *model.AppError) {
      entries := s.loadOrCompilePostPoliciesForChannel(rctx, channelID)
      for _, e := range entries {
          if !postCarriesAnyKey(post, e.postAttrs) {
              continue
          }
          postSubj := buildPostSubject(post) // pb.Subject{Attributes: ...}
          out, _, err := e.program.ContextEval(rctx.Context(), map[string]any{
              "user": subject,
              "post": postSubj,
          })
          if err != nil {
              rctx.Logger().Warn("post policy eval error", mlog.String("policy_id", e.id), mlog.Err(err))
              return false, nil // fail-closed
          }
          if b, ok := out.Value().(bool); !ok || !b {
              return false, nil
          }
      }
      return true, nil
  }
  ```

- `server/einterfaces/access_control.go`
  - Add to the interface:
    ```go
    EvaluatePostPolicies(rctx request.CTX, channelID string, post *model.PostWithValues, subject *pb.Subject) (bool, *model.AppError)
    ```
  - Regenerate the mock at
    `server/einterfaces/mocks/AccessControlServiceInterface.go`.

### MM-CORE additions to support the interface signature

- `server/public/model/post_with_values.go` — see Slice 3 below.

### Test cases beyond standard

- `enterprise/access_control/service_test.go`:
  - Policy `post.attributes.lvl == "L1" && user.attributes.rank == "R1"`,
    post `{lvl:"L1"}`, subject `{rank:"R1"}` → allow.
  - Same, subject `{rank:"R2"}` → deny.
  - Post that does NOT carry `lvl` → policy skipped, allow.
  - Multiple policies, one allows / one denies → deny (deny-wins).
  - Expression that references `user.attributes.unknown` → eval
    error → deny (fail-closed) + warning logged.
  - Cache invalidation: save-policy clears the channel entry; next
    eval recompiles.

### Acceptance

Go test green. No fetch-path integration yet.

---

## Slice 3 — `PostWithValues` + filter helper + sentinel blanking

**Goal.** Given a `*model.PostList`, the new
`filterPostsByPostPolicy` returns a list where denied posts are
blanked and tagged. Not yet wired into HTTP endpoints.

### MM-CORE changes

- New file `server/public/model/post_with_values.go`:
  ```go
  package model

  type PostWithValues struct {
      *Post
      Values map[string]any // PSAv2 channel-post group: field name -> value
  }
  ```
  (Lives in `model` so the einterface signature can reference it.
  The `Values` map is populated only on the server side; never
  serialized to clients.)

- New helpers in `server/channels/app/post_helpers.go` (next to the
  BOR helpers around line 270):

  ```go
  func (a *App) hydratePostValues(rctx request.CTX, posts []*model.Post) ([]*model.PostWithValues, *model.AppError) {
      // One batched store call:
      //   AttributesStore.GetValuesForTargets(ctx, groupID=ChannelPostPropertyGroupID, targetIDs=postIDs)
      // Pivot rows into a map[postID]map[fieldName]any.
      // Field-name lookup uses the channel-post property group's fields, cached.
  }

  func (a *App) filterPostsByPostPolicy(rctx request.CTX, postList *model.PostList, userID string) (*model.PostList, *model.AppError) {
      if !a.Config().FeatureFlags.PostPolicy {
          return postList, nil
      }
      if a.Srv().Channels().AccessControl == nil {
          return postList, nil
      }
      // 1) Build subject once.
      subject, err := a.BuildAccessControlSubject(rctx, userID, /*roles*/ nil)
      if err != nil { return nil, err }

      // 2) Group posts by channel.
      byChannel := groupPostsByChannel(postList)

      // 3) Hydrate property values for ALL posts in one call.
      hydrated, err := a.hydratePostValues(rctx, postList.ToSlice())
      if err != nil { return nil, err }

      // 4) For each post, ask the enterprise service.
      for _, pwv := range hydrated {
          allow, err := a.Srv().Channels().AccessControl.EvaluatePostPolicies(rctx, pwv.ChannelId, pwv, subject)
          if err != nil { return nil, err }
          if !allow {
              blankPostInPlace(postList.Posts[pwv.Id])
          }
      }
      return postList, nil
  }

  func blankPostInPlace(p *model.Post) {
      p.Message = ""
      p.FileIds = nil
      // Clear potentially-leaky props but keep timeline-essential fields.
      p.DelProp(model.PostPropsAttachments)
      // Mark.
      if p.Props == nil { p.Props = model.StringInterface{} }
      p.Props[model.PostPropsHiddenByPolicy] = true
  }
  ```

- Also add a single-post variant `filterSinglePostByPostPolicy` for
  `GetSinglePost` / `GetPermalinkPost`.

- Add a `// TODO(post-policy): per-recipient WS hook` comment at
  `server/channels/app/post.go:985` (`publishWebsocketEventForPost`)
  with a 2-line description and a link to the spec section 3.

### Test cases beyond standard

- `server/channels/app/post_helpers_test.go`:
  - Post with no property values → unfiltered (no blanking).
  - Post with `lvl=L1`, user with `rank=R1`, policy allows → unfiltered.
  - Post with `lvl=L1`, user with `rank=R2`, policy denies →
    `Message == ""`, `FileIds == nil`, `Props[hidden_by_policy] == true`,
    `Id/UserId/ChannelId/CreateAt/Type` intact, `PostList.Order`
    unchanged.
  - Two policies, one allows / one denies → blanked.
  - Feature flag off → no-op.
  - `AccessControl == nil` → no-op.
  - Eval error → blanked (fail-closed) and warning emitted.
- Batched hydration: 50 posts → exactly one store call (use a
  store mock with a call counter).

### Acceptance

Direct unit test: construct a `PostList` and a subject; call
`filterPostsByPostPolicy`; assert blanking and order preservation.

---

## Slice 4 — Wire filter into every user-facing fetch site

**Goal.** Every REST path that returns posts for a user runs the
new filter immediately after BOR reveal and before the
`PostsWillBeConsumed` plugin hook.

### MM-CORE changes

- `server/channels/app/post.go` — at each line below, **after** the
  existing `revealBurnOnReadPostsForUser` call (`postList, appErr = ...`),
  add:
  ```go
  postList, appErr = a.filterPostsByPostPolicy(rctx, postList, <userID>)
  if appErr != nil { return nil, appErr }
  ```

  Sites (from `research.md` §5):
  - L1238 `GetPostsPage`
  - L1268 `GetPostsForView`
  - L1295 `GetPosts`
  - L1336 `GetPostsSince`
  - L1459 `GetPostThread`
  - L1489 `GetFlaggedPosts`
  - L1511 `GetFlaggedPostsForTeam`
  - L1533 `GetFlaggedPostsForChannel`
  - L1563 `GetPermalinkPost` (single-post variant)
  - L1604 `GetPostsBeforePost`
  - L1640 `GetPostsAfterPost`
  - L1684 `GetPostsAroundPost`
  - L2009 search path #1
  - L2182 search path #2
  - `GetPostsForChannelAroundLastUnread` (find the BOR call; mirror)
  - `GetSinglePost` (L1413) — single-post variant
  - `GetPostsByIds` (L2624) — single batched call

- For the two `filterBurnOnReadPosts` sites in the search path,
  add the new filter call adjacent (single-line addition each).

- Refactor: if all 15 sites read the same `userID` plumbing pattern,
  consider a one-line wrapper
  `a.applyPostReadFilters(rctx, postList, userID)` that chains
  BOR reveal + post policy + (future) hooks. **Optional** — only do
  this if it reduces duplication without changing call-site
  semantics. Otherwise leave 15 individual additions.

### Test cases beyond standard

- API-level integration tests in `server/channels/api4/post_test.go`
  (one per primary endpoint, gated by feature flag):
  - `GET /channels/{id}/posts` — denied posts come back blanked.
  - `GET /posts/{id}/thread` — denied replies blanked.
  - `GET /teams/{id}/posts/search` — denied search hits blanked.
  - `GET /posts/{id}` (single) — single post blanked.
  - Permalink endpoint — single post blanked.
- Order preservation: a 10-post list with the middle three denied
  → `Order` slice length and ordering unchanged.

### Acceptance

Manual smoke on demo box: a real channel with two policies + two
viewers (admin and rank-R2 user) — admin sees everything, R2 user
sees the filtered set.

---

## Slice 5 — Frontend "Hidden by policy" placeholder

**Goal.** When a post carries `props.hidden_by_policy === true`, the
post body is replaced by a muted placeholder. No editing UI yet.

### Webapp changes

- New constant in
  `webapp/channels/src/utils/constants.tsx` (or wherever post-prop
  sentinels live; mirror `BurnOnReadProp`):
  ```ts
  export const HiddenByPolicyProp = 'hidden_by_policy';
  ```

- `webapp/channels/src/components/post_view/post_body/post_body.tsx`
  (or the component that renders the message body):
  - Early-return a `<HiddenByPolicyPlaceholder/>` component if
    `post.props?.[HiddenByPolicyProp] === true`.

- New file `webapp/channels/src/components/post_view/hidden_by_policy_placeholder/`
  with `.tsx`, `.scss`, and a snapshot test. Visual: muted italic
  text "Hidden by policy" with a lock icon — matches the muted
  placeholder visual language used elsewhere.

### Test cases beyond standard

- Snapshot test for the placeholder.
- Post-body test: when `hidden_by_policy` is set, the placeholder
  renders and the original message text never appears in the DOM.
- The post still shows author + timestamp (timeline integrity).

### Acceptance

Manual: with Slice 4 wired up on the demo, a denied post renders
as the placeholder in channel view, RHS thread, search results,
and permalink.

---

## Slice 6 — Channel Settings: Post Policies section (list + simple builder)

**Goal.** Admin opens Channel Settings → sees a new "Post
Policies" section directly below Access Rules. Can list, add,
edit (simple builder only), delete policies.

### Webapp changes

- New file
  `webapp/channels/src/components/channel_settings_modal/channel_settings_post_policies_tab.tsx`
  cloned from `channel_settings_access_rules_tab.tsx`. Differences:
  - Loads policies via the same actions, filtered to
    `Actions.includes('post_filter')`.
  - Renders **multiple** policy cards (Access Rules tab has one
    membership rule per channel; this section has N policy cards
    + an "Add policy" button at the bottom).
  - Each card: editor + a delete button.

- `webapp/channels/src/components/admin_console/access_control/editors/table_editor/table_editor.tsx`
  - Add prop:
    ```ts
    type Props = {
        // existing...
        selectorPrefix?: 'user.attributes.' | 'post.attributes.';
        showScopeColumn?: boolean; // when true, each row has a scope toggle
    };
    ```
  - Line 29: replace hardcoded `'user.attributes.'` with
    `props.selectorPrefix ?? 'user.attributes.'`.
  - Line 116: replace the magic `16` (the `'user.attributes.'.length`)
    with a computed `prefixLength`.
  - When `showScopeColumn`, render a `Scope` cell per row with a
    two-option select (`Post` / `User`). On serialize, each row uses
    its scope's prefix; on parse, route by leftmost-root.

- `webapp/channels/src/components/admin_console/access_control/editors/table_editor/attribute_selector_menu.tsx`
  - When scope is `post`, source attributes from the channel's
    PSAv2 fields (loaded via a new selector
    `getPostPropertyFieldsForChannel(channelID)`).
  - When scope is `user`, source from CPA fields (existing).

- `webapp/channels/src/components/channel_settings_modal/channel_settings_modal.tsx`
  - Register the new tab/section in the modal navigation, directly
    below the existing Access Rules entry.

- `webapp/channels/src/components/channel_settings_modal/hooks/useChannelAccessControlActions.ts`
  (verify exact path)
  - Add `getPostPolicies`, `savePostPolicy`, `deletePostPolicy`
    actions that proxy to Client4. These call the same
    `/access_control_policies` endpoints used today; only the
    `Actions` value differs.

### Test cases beyond standard

- `channel_settings_post_policies_tab.test.tsx`:
  - Renders empty state when no policies.
  - Renders N cards for N policies.
  - "Add policy" appends a new draft card; canceling discards it.
  - Save flow: dirty banner appears; clicking save calls
    `savePostPolicy` with the serialized expression.
  - Each card's delete confirms and calls `deletePostPolicy`.
- `table_editor.test.tsx`:
  - `selectorPrefix='post.attributes.'` round-trips a post-rooted
    expression (parse → rows → serialize).
  - Mixed-scope rows produce
    `post.attributes.x == "v" && user.attributes.y == "w"` on save.
  - Switching a row's scope re-sources the attribute dropdown.

### Acceptance

Manual: build a policy in the UI using the builder, save, reload
channel — policy persists and filtering applies.

---

## Slice 7 — Advanced raw CEL editor toggle

**Goal.** Each policy card has a "Simple / Advanced" toggle
(matching Access Rules). Advanced mode uses the existing Monaco
CEL editor unchanged.

### Webapp changes

- `channel_settings_post_policies_tab.tsx`: reuse the same
  Simple/Advanced toggle pattern used in the Access Rules tab
  (`useState<'simple' | 'advanced'>`). When advanced is selected,
  render `<CelEditor value={expression} onChange={...} />`.
- When switching simple → advanced, serialize the current rows to
  CEL. When switching advanced → simple, attempt to parse via
  `actions.getVisualAST(expr)`; if it fails (non-table-able
  expression), keep advanced mode and surface the existing "this
  expression can't be edited visually" inline banner.

### Test cases beyond standard

- A non-table-able expression (e.g. `post.attributes.x.startsWith("L")`)
  → simple toggle is disabled and advanced editor is the only mode
  available.
- Round-trip: simple → advanced → simple preserves the rows.

### Acceptance

Manual: write a policy with a `startsWith` call in advanced mode,
save, reload — policy persists; the toggle correctly stays on
advanced.

---

## Slice 8 — Demo runbook + known-issue notes

**Goal.** A runnable, copy-pasteable walkthrough for the demo and
honest documentation of MVP gaps.

### Changes

- New file `abac-tasks/demo-runbook.md`. Sections:
  1. Pre-flight: feature flag, license, dev env, fresh channel.
  2. Step-by-step:
     - Create CPA `rank` (R1/R2/R3) for two test users.
     - Create post property `secretlevel` on a channel.
     - Tag three posts with L1/L2/L3 from one author.
     - Add a Post Policy in Channel Settings.
     - Switch users → observe filtering.
  3. Verify in: channel view, RHS thread, search results,
     permalink.
  4. Known gaps for MVP:
     - WS live-push leak (refresh fixes it; TODO comment in code
       points here).
     - No self-lockout guard.
     - Edit-history endpoint unfiltered.

### Acceptance

A teammate can follow the runbook end-to-end in under 10 minutes
on a fresh demo box.

---

## Cross-cutting test inventory (beyond per-slice)

- **Eval cost.** Bench-style test (`go test -bench`) over 100
  policies × 200 posts with cached programs — assert < 50 ms
  total. Catches a regression where the program cache breaks.
- **Cache invalidation.** Save policy → next fetch sees new
  expression; delete policy → next fetch ignores it; rename a
  property field referenced by a policy → policy still compiles
  but never matches (existing field-rename invalidator already
  fires for membership policies; verify it fires for `post_filter`
  too).
- **Property field deletion.** A policy referencing a deleted
  field: should remain saveable, never match a post → all
  unfiltered. Verify no panic.
- **Order/`NextPostId`/`PrevPostId`.** Three policies firing on
  alternate posts in a 10-post list — `PostList.Order` length
  preserved, navigation IDs still consistent (blanking does not
  remove from order).
- **WS path NOT filtered.** Explicit test that a freshly posted
  message broadcast over WS arrives unblanked to a denied
  recipient — this *fails* the policy intent but documents the
  MVP gap and prevents accidental "fix" via the REST path. Keep
  as a `t.Skip("MVP: WS filtering deferred — see plan §3")`
  scaffold so it's discoverable.

---

## Phase progress

| Phase | Description                                                                                | Status      |
|-------|--------------------------------------------------------------------------------------------|-------------|
| 0     | Research and spec                                                                          | Complete    |
| 1     | Plan (`plan.md`)                                                                           | Complete    |
| 2     | Slice 1 — model constant, validator branch, feature flag                                   | Complete    |
| 3     | Slice 2 — enterprise CEL env extension, `EvaluatePostPolicies`, attribute extractor variant | Complete    |
| 4     | Slice 3 — `PostWithValues`, hydration, `filterPostsByPostPolicy`, blanking                 | Not started |
| 5     | Slice 4 — wire filter into all 15+ user-facing fetch sites                                  | Not started |
| 6     | Slice 5 — frontend "Hidden by policy" placeholder                                          | Not started |
| 7     | Slice 6 — Channel Settings post-policies tab + simple builder + table-editor extensions    | Not started |
| 8     | Slice 7 — advanced raw CEL editor toggle                                                   | Not started |
| 9     | Slice 8 — demo runbook + MVP gap notes                                                     | Not started |

## Checkpoints

- **After Slice 1** — model/API agreed, no behavior yet. Cheap
  review (≤ 30 lines diff).
- **After Slice 2** — enterprise extension reviewed in isolation
  before any core wiring. Largest semantic risk lives here
  (env extension, fail-closed, cache).
- **After Slice 3** — unit-tested filter helper exists. Last point
  to revisit the data shape (`PostWithValues`) before the
  callsite fan-out.
- **After Slice 4** — backend MVP complete. Demoable with curl.
- **After Slice 5** — visually demoable end-to-end (admin authors
  via curl, viewer sees the placeholder).
- **After Slice 7** — full UX path demoable from admin to viewer
  with no API tooling.

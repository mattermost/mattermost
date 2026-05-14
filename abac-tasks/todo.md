# Post Policy — Todo

Tracking checklist for the implementation slices defined in
[`plan.md`](plan.md). Tick items as they merge. Keep slice
boundaries — a slice ships when all its boxes are checked.

## Slice 1 — Model + feature flag
- [x] Add `AccessControlPolicyActionPostFilter` constant in `model/access_policy.go`
- [x] Add to `validActions` map (`allowedActionsV0_3`)
- [x] v0.3 validator: existing per-rule action check now accepts `post_filter`
- [x] Add `PostPropsHiddenByPolicy` sentinel constant in `model/post.go`
- [x] Add `FeatureFlags.PostPolicy` (defaults false)
- [x] Client surface: auto-propagated via `FeatureFlags.ToMap()` — no `config/client.go` change needed
- [x] Unit tests: valid channel-scoped post_filter policy, PostPolicy default false
- [x] Acceptance: model tests pass; `go build ./...` clean

## Slice 2 — Enterprise CEL extension
- [ ] Add `post` variable to env in `service.Init`
- [ ] Add per-channel compiled-program cache (`postPolicyPrograms`)
- [ ] Add `ExtractAttributesByRoot` in `cel_utils/attributes.go`
- [ ] Implement `Service.EvaluatePostPolicies`
- [ ] Add method to `einterfaces.AccessControlServiceInterface`
- [ ] Regenerate `AccessControlServiceInterface` mock
- [ ] Create `model/post_with_values.go`
- [ ] Unit tests: allow/deny, skip-when-unreferenced, deny-wins, fail-closed, cache invalidation

## Slice 3 — Hydration + filter helper
- [ ] Add `App.hydratePostValues` (single batched store call)
- [ ] Add `App.filterPostsByPostPolicy`
- [ ] Add `App.filterSinglePostByPostPolicy`
- [ ] Add `blankPostInPlace` helper
- [ ] Add `// TODO(post-policy): per-recipient WS hook` at `post.go:985`
- [ ] Unit tests: blanking semantics, order preservation, flag-off no-op, AccessControl=nil no-op, batched-call counter
- [ ] Acceptance: synthetic `PostList` → expected blanking via unit test

## Slice 4 — Fan-out to all fetch sites
- [ ] Wire `filterPostsByPostPolicy` into all `revealBurnOnReadPostsForUser` sites in `post.go` (15+)
- [ ] Wire `filterSinglePostByPostPolicy` into single-post sites
- [ ] Wire into search paths (`post.go:2009`, `post.go:2182`)
- [ ] Consider `applyPostReadFilters` wrapper (optional)
- [ ] API integration tests for: channel posts, thread, search, single post, permalink
- [ ] Acceptance: demo box, two users, observed filtering on real channel

## Slice 5 — Frontend placeholder
- [ ] Add `HiddenByPolicyProp` constant in `utils/constants.tsx`
- [ ] Branch in post body component to render placeholder
- [ ] New `<HiddenByPolicyPlaceholder/>` component (.tsx/.scss/test)
- [ ] Tests: snapshot, message text never in DOM, timeline fields rendered
- [ ] Acceptance: visually verify placeholder in channel/thread/search/permalink

## Slice 6 — Channel Settings: list + simple builder
- [ ] Clone `channel_settings_post_policies_tab.tsx` from access-rules tab
- [ ] Filter loaded policies by `Actions.includes('post_filter')`
- [ ] Render multiple policy cards + "Add policy" + per-card delete
- [ ] Extend `TableEditor` with `selectorPrefix` and `showScopeColumn` props
- [ ] Replace hardcoded `user.attributes.` (line 29) and magic 16 (line 116)
- [ ] Per-row Scope select (Post / User)
- [ ] Extend `attribute_selector_menu` to source post-property fields when scope is post
- [ ] Register the new tab in `channel_settings_modal.tsx` below Access Rules
- [ ] Add `getPostPolicies` / `savePostPolicy` / `deletePostPolicy` actions
- [ ] Tests: empty state, add/cancel, save, delete, mixed-scope serialize, prefix round-trip
- [ ] Acceptance: build/save a policy in the UI; reload channel; verify filter applies

## Slice 7 — Advanced raw editor toggle
- [ ] Add Simple/Advanced toggle per card (reuse Access Rules pattern)
- [ ] Render `<CelEditor/>` in advanced mode
- [ ] Simple → Advanced: serialize rows to CEL
- [ ] Advanced → Simple: parse via `getVisualAST`; on failure, surface existing inline banner and lock to advanced
- [ ] Tests: non-table-able expr locks to advanced; round-trip preserves rows
- [ ] Acceptance: author `startsWith` expression, save, reload, toggle correct

## Slice 8 — Demo runbook + gaps
- [ ] Create `abac-tasks/demo-runbook.md` with the full walkthrough
- [ ] Document known MVP gaps (WS leak, no self-lockout guard, edit history)
- [ ] Acceptance: teammate runs end-to-end in <10 minutes on fresh dev env

## Cross-cutting tests
- [ ] Eval cost benchmark (`go test -bench`) — 100 policies × 200 posts < 50ms
- [ ] Cache invalidation on policy save/delete
- [ ] Behavior when a referenced property field is deleted
- [ ] `PostList.Order` / `NextPostId` / `PrevPostId` preserved through blanking
- [ ] Skipped WS leak test scaffold with explicit `t.Skip` and pointer to plan §3

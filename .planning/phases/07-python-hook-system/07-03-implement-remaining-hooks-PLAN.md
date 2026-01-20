# Phase 7 — Python Hook System
## Plan 07-03: Implement remaining hooks (excluding streaming hooks deferred to Phase 8)

<objective>
Implement the rest of the Python gRPC hook servicer methods to reach functional parity with Go plugins for all **non-streaming** hooks in `server/public/plugin/hooks.go`.

This plan covers:
- Command hook: `ExecuteCommand`
- User/team/channel hooks
- Reactions, notifications, preferences
- Cluster, websocket, data retention, telemetry, limits
- Shared channels hooks
- Support packet + SAML login hooks

And explicitly defers streaming-oriented hooks to Phase 8:
- `ServeHTTP` / `ServeMetrics` (HTTP request/response streaming)
- `FileWillBeUploaded` (file body streaming / large payload handling)
</objective>

<execution_context>
- Repo root: `mattermost-python-in-plugins/`
- Phase: 7 (Python Hook System)
- Plan: 07-03
- Depends on:
  - Phase 07-01 output: plugin registry + bootstrap exist
  - Phase 07-02 output: hook servicer framework + lifecycle/message hooks exist
  - Phase 3 output: `hooks.proto` defines these remaining hooks
  - Phase 6 output: wrapper/converter layer exists for common model types (or raw pb usage is standardized)
- Primary references:
  - `server/public/plugin/hooks.go` (authoritative hook list + semantics)
  - `.planning/phases/07-python-hook-system/07-RESEARCH.md` (timeouts, error patterns, pitfalls)
</execution_context>

<context>
- **Canonical hook list** (remaining in this plan): everything in `server/public/plugin/hooks.go` *except*:
  - `ServeHTTP`, `ServeMetrics` (Phase 8)
  - `FileWillBeUploaded` (defer if `hooks.proto` uses streaming; if unary bytes-based, you may choose to implement now but document size limits)
- **Error behavior target:** match Go plugin behavior as closely as possible:
  - hook invocation failures should be surfaced as gRPC errors so the Go side can log and apply safe defaults (typically fail-open).
  - “expected rejections” should be expressed as response fields (e.g., `UserWillLogIn` returns a rejection string).
</context>

<tasks>
### Mandatory discovery (Level 0 → 2)
- [ ] **Enumerate remaining hook RPCs from generated code**:
  - Extract method list from `hooks_pb2_grpc` servicer base.
  - Cross-check with `server/public/plugin/hooks.go` to ensure coverage.
- [ ] **Identify streaming hooks and confirm deferral**:
  - Inspect `hooks.proto` for `ServeHTTP`, `ServeMetrics`, `FileWillBeUploaded` method signatures.
  - If any are streaming (`stream`), do not implement here; leave to Phase 8.
- [ ] **Confirm required protobuf model types exist**:
  - Many hooks reference types like `CommandArgs`, `CommandResponse`, `AppError`, `WebSocketRequest`, shared channel types, SAML assertion info, etc.
  - If any type is missing in protos, stop and fix the protobuf definitions (Phase 2/3) before proceeding.

### Build an implementation matrix (prevents drift)
- [ ] **Create a hook implementation matrix** (keep it in code comments near the servicer):
  - For each hook:
    - Canonical hook name (Go)
    - Python handler name (snake_case) and signature expected by plugin authors
    - Request type + response type (protobuf)
    - Return semantics (allow/reject/modify/error)
    - Default behavior when hook not implemented
  - This matrix drives consistent conversion + testing.

### Implement hooks by category (systematic + test-first)

#### Commands + configuration
- [ ] **ExecuteCommand**
  - Map request args → Python handler args.
  - Return `CommandResponse` on success, or propagate `AppError` semantics per proto.
  - Add tests for success + error path.
- [ ] **ConfigurationWillBeSaved**
  - Handler can return a modified config or error.
  - Add tests: unchanged, modified, rejected.

#### User/team/channel membership + lifecycle-adjacent events
- [ ] Implement:
  - `UserHasBeenCreated`
  - `UserWillLogIn` (returns rejection string)
  - `UserHasLoggedIn`
  - `UserHasBeenDeactivated`
  - `ChannelHasBeenCreated`
  - `UserHasJoinedChannel` / `UserHasLeftChannel`
  - `UserHasJoinedTeam` / `UserHasLeftTeam`
- [ ] Add tests that at least validate:
  - correct argument conversion into handler
  - correct “reject reason” plumbing for `UserWillLogIn`

#### Reactions + preferences
- [ ] Implement:
  - `ReactionHasBeenAdded`
  - `ReactionHasBeenRemoved`
  - `PreferencesHaveChanged`
- [ ] Add tests for one representative unary “void” hook and `PreferencesHaveChanged` list conversion.

#### Notifications
- [ ] Implement:
  - `NotificationWillBePushed` (modify/reject/allow)
  - `EmailNotificationWillBeSent` (modify/reject/allow)
- [ ] Add tests covering:
  - allow (nil modification)
  - modify (returns replacement)
  - reject (returns reason)

#### Cluster, websocket, telemetry, limits, retention
- [ ] Implement:
  - `OnPluginClusterEvent`
  - `OnWebSocketConnect` / `OnWebSocketDisconnect`
  - `WebSocketMessageHasBeenPosted`
  - `OnSendDailyTelemetry`
  - `OnCloudLimitsUpdated`
  - `RunDataRetention` (returns `(deleted_count, error)`)
  - `OnInstall` (returns error)
- [ ] Add tests for:
  - boolean/primitive argument passing (`OnWebSocketConnect`)
  - return value + error path (`RunDataRetention`)

#### Shared channels + support packet + SAML
- [ ] Implement:
  - `OnSharedChannelsSyncMsg` (returns `SyncResponse`, error)
  - `OnSharedChannelsPing` (returns bool)
  - `OnSharedChannelsAttachmentSyncMsg` (error)
  - `OnSharedChannelsProfileImageSyncMsg` (error)
  - `GenerateSupportData` (returns `[]FileData`, error)
  - `OnSAMLLogin` (error)
- [ ] Add tests for:
  - bool return (`OnSharedChannelsPing`)
  - list return (`GenerateSupportData`)

### Streaming hooks (explicitly deferred)
- [ ] **Document deferral** in the servicer:
  - `ServeHTTP`, `ServeMetrics`, `FileWillBeUploaded` are implemented in Phase 8.
  - If the generated servicer requires implementing them now, return `UNIMPLEMENTED` and ensure they are *not* included in `Implemented()` unless plugin author opts in after Phase 8.

### Checkpoints
- [ ] **Checkpoint A:** all non-streaming hooks in `server/public/plugin/hooks.go` are implemented in Python servicer and reachable via gRPC.
- [ ] **Checkpoint B:** representative tests exist for each category and pass.
</tasks>

<verification>
- `cd python-sdk && python -m pip install -e '.[dev]'`
- `pytest -q python-sdk/tests -k 'hooks and not streaming'`
</verification>

<success_criteria>
- All non-streaming hooks defined in `server/public/plugin/hooks.go` are implemented in the Python hook servicer and covered by at least representative tests per category.
- Streaming hooks are clearly deferred to Phase 8 without breaking plugin startup/handshake.
- `Implemented()` remains accurate (only hooks actually implemented by the plugin are advertised).
</success_criteria>

<output>
- New/updated files (expected, non-exhaustive):
  - `python-sdk/src/mattermost_plugin/servicers/hooks_servicer.py` (expanded)
  - `python-sdk/tests/test_hooks_commands_config.py`
  - `python-sdk/tests/test_hooks_users_channels.py`
  - `python-sdk/tests/test_hooks_notifications.py`
  - `python-sdk/tests/test_hooks_shared_channels.py`
</output>



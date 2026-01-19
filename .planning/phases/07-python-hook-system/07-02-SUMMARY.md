# Phase 07-02 Summary: Implement Lifecycle and Message Hooks

## Status: COMPLETE

## Objective
Implement the Python gRPC hook servicer methods for lifecycle and message hooks, including correct return semantics and error behavior.

## Commits
1. `6d2974c821` - feat(07-02): implement hook servicer with lifecycle and message hooks
2. `6392b981fe` - test(07-02): add tests for lifecycle and message hook semantics
3. `ab345d7e57` - test(07-02): add gRPC integration tests for hook servicer

## Key Deliverables

### 1. Hook Servicer Implementation
**File:** `python-sdk/src/mattermost_plugin/servicers/hooks_servicer.py`

- Created `PluginHooksServicerImpl` class implementing `PluginHooksServicer` from generated code
- Implemented `Implemented` RPC returning canonical hook names from plugin registry
- Implemented lifecycle hooks: `OnActivate`, `OnDeactivate`, `OnConfigurationChange`
- Implemented message hooks:
  - `MessageWillBePosted` (allow/reject/modify/dismiss semantics)
  - `MessageWillBeUpdated` (with old/new post handling)
  - `MessageHasBeenPosted` (notification)
  - `MessageHasBeenUpdated` (notification)
  - `MessageHasBeenDeleted` (notification)
  - `MessagesWillBeConsumed` (list filtering/modification)

### 2. Server Integration
**File:** `python-sdk/src/mattermost_plugin/server.py`

- Registered hook servicer in `PluginServer.start()`
- Hook servicer created with plugin instance and timeout configuration

### 3. Async Handler Support
**File:** `python-sdk/src/mattermost_plugin/hooks.py`

- Fixed `@hook` decorator to preserve async nature of handlers
- Separate async/sync wrappers ensure proper coroutine detection

### 4. Test Coverage
**Files:**
- `python-sdk/tests/test_hooks_lifecycle.py` (16 tests)
- `python-sdk/tests/test_hooks_messages.py` (22 tests)
- `python-sdk/tests/test_hooks_grpc_integration.py` (11 tests)

Total: 49 new tests covering:
- Implemented RPC hook list generation
- OnActivate success/failure propagation
- OnDeactivate best-effort semantics
- OnConfigurationChange error handling
- MessageWillBePosted allow/reject/modify/dismiss paths
- MessageWillBeUpdated with old/new post handling
- Notification hook fire-and-forget behavior
- MessagesWillBeConsumed list processing
- Async handler support
- gRPC integration tests with real server

## Error Handling Convention
Documented in servicer module docstring:

1. **Plugin bugs** (exceptions in handlers): Encoded via response fields for lifecycle hooks, gRPC INTERNAL for notification hooks
2. **Business rejections** (e.g., post rejected): Encoded via response fields (`rejection_reason`), NOT gRPC errors
3. **OnActivate errors**: Encoded via `response.error` field (AppError) - allows Go side to distinguish activation failure from transport failure

## Key Constants
- `DISMISS_POST_ERROR = "plugin.message_will_be_posted.dismiss_post"` - matches Go constant for silent post dismissal

## Type Strategy
For this initial implementation, hook handlers receive raw protobuf messages. Future versions may add Python wrapper types for better ergonomics.

## Verification
```bash
cd python-sdk && source .venv/bin/activate
python -m pytest tests/test_hooks_lifecycle.py tests/test_hooks_messages.py tests/test_hooks_grpc_integration.py -v
# Result: 49 passed
```

## Deviations from Plan
None - all planned tasks completed as specified.

## Files Modified
- `python-sdk/src/mattermost_plugin/hooks.py` (async handler fix)
- `python-sdk/src/mattermost_plugin/server.py` (servicer registration)
- `python-sdk/src/mattermost_plugin/servicers/__init__.py` (new)
- `python-sdk/src/mattermost_plugin/servicers/hooks_servicer.py` (new)
- `python-sdk/tests/test_hooks_lifecycle.py` (new)
- `python-sdk/tests/test_hooks_messages.py` (new)
- `python-sdk/tests/test_hooks_grpc_integration.py` (new)

## Next Steps
- Phase 07-03: Implement remaining hooks (user/channel, command, WebSocket, cluster hooks)

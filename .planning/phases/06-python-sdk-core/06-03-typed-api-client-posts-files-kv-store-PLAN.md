# Phase 6 — Python SDK Core
## Plan 06-03: Typed API client for Post/File/KV Store methods

<objective>
Extend the Python SDK to cover the Plugin API methods in the **Post**, **File**, and **KV Store** domains:
- Add Python wrapper types for Post and file-related objects (as needed by the protos)
- Implement all in-scope RPC client methods with consistent error handling and conversions
- Expand coverage tooling/tests to enforce no missing RPCs in this scope
</objective>

<execution_context>
- Repo root: `mattermost-python-in-plugins/`
- Phase: 6 (Python SDK Core)
- Plan: 06-03
- Requires: 06-01 and 06-02 completed (`python-sdk/` scaffold + coverage tooling exists)
- Inputs:
  - Generated proto stubs for Plugin API service (`api.proto`) include Post/File/KV RPCs (Phase 2)
  - Go gRPC server implements those RPCs (Phase 4)
- Notes:
  - File payload size may be large; rely on the channel message-size limits configured in 06-01.
</execution_context>

<context>
- **Post domain**: create/update/delete posts, reactions, threads, searches, pin/unpin, etc.
- **File domain**: metadata, file retrieval, uploads (as represented in protobuf).
- **KV store domain**: plugin-scoped key/value operations; should be strongly typed for keys and bytes/strings based on proto definitions.
- Some file flows may later require streaming (Phase 8); for this plan, implement unary RPCs as defined by Phase 2 protos.
</context>

<tasks>
### Mandatory discovery + scope sizing (Level 0 → 1)
- [ ] **List RPCs in this plan’s scope** from the generated service descriptor.
  - Recommended include patterns: `(Post|Reaction|File|KV|KeyValue)`
  - Recommended exclude patterns: `(User|Team|Channel)` (already covered)
- [ ] **If scope is too large (> ~80 RPCs), split**:
  - Example: `06-03a` Posts+Reactions, `06-03b` Files+KV

### Wrapper types + converters
- [ ] **Add/extend wrapper dataclasses**:
  - `Post` (core)
  - `Reaction` (if present in proto surface)
  - File-related wrappers as needed by the protos:
    - e.g., `FileInfo`, `FileUpload`, `FileMetadata` (names depend on proto definitions)
- [ ] **Converters**:
  - Add `from_proto`/`to_proto` conversions for new wrappers
  - Add helpers for bytes handling (file content, previews, thumbnails) as needed

### Client methods + error handling
- [ ] **Implement sync client methods for all Post/File/KV RPCs in scope**:
  - Build request message
  - Call stub
  - Convert response to wrappers/primitives
  - Map `grpc.RpcError` → SDK exceptions
- [ ] **Async parity decision**
  - If the project standard is “sync is primary”, keep async client minimal.
  - If the standard is “sync+async parity”, implement the same methods on `AsyncPluginAPIClient`.
  - Decide and record the decision in code comments and this plan’s checklist before proceeding.

### Coverage enforcement + tests
- [ ] **Run/update audit script**:
  - Ensure audit can enforce this scope independently:
    - `--include '(Post|Reaction|File|KV|KeyValue)' --exclude '(User|Team|Channel)'`
- [ ] **Unit tests (mocked stub)**:
  - Add representative tests for each domain:
    - Posts: at least one create + one update + one error mapping case
    - Files: at least one metadata + one content retrieval + one error mapping case
    - KV: set/get/delete/list behaviors depending on proto
- [ ] **Integration-style test (optional)**:
  - In-process gRPC server for 1 post RPC + 1 file/KV RPC to validate real gRPC roundtrip.
</tasks>

<verification>
- `cd python-sdk && python scripts/generate_protos.py`
- `python scripts/audit_client_coverage.py --include '(Post|Reaction|File|KV|KeyValue)' --exclude '(User|Team|Channel)'`
- `pytest -q`
- `mypy src/mattermost_plugin`
</verification>

<success_criteria>
- Wrapper types exist (Post + file/KV-related types as needed) and are used by the public client surface.
- All in-scope Post/File/KV RPCs have Python client methods (enforced by the audit script).
- Error handling is consistent and does not leak gRPC exceptions.
- Tests cover success + failure paths across Posts, Files, and KV operations.
</success_criteria>

<output>
- Modified:
  - `python-sdk/src/mattermost_plugin/client.py` (and optional mixins/modules)
  - `python-sdk/src/mattermost_plugin/async_client.py` (if async parity chosen)
  - `python-sdk/src/mattermost_plugin/_internal/wrappers.py` (or split wrappers)
  - `python-sdk/src/mattermost_plugin/exceptions.py` (extend mappings)
- Added/modified:
  - `python-sdk/tests/test_posts_files_kv.py` (name flexible)
</output>



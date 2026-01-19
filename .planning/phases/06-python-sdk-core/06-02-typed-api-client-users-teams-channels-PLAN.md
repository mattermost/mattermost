# Phase 6 — Python SDK Core
## Plan 06-02: Typed API client for User/Team/Channel methods

<objective>
Implement a typed, Pythonic client surface for the Plugin API methods in the **User**, **Team**, and **Channel** domains:
- Add first-class Python wrapper types (dataclass-style) for core objects (User, Team, Channel, memberships as needed)
- Add corresponding client methods that translate Python inputs → protobuf requests and protobuf responses → Python outputs
- Ensure consistent error handling (map `grpc.StatusCode` to SDK exceptions)
- Add coverage tooling/tests so we can prove we’re not missing RPCs in this scope
</objective>

<execution_context>
- Repo root: `mattermost-python-in-plugins/`
- Phase: 6 (Python SDK Core)
- Plan: 06-02
- Requires: 06-01 completed (`python-sdk/` exists; protos generate; base client + exceptions exist)
- Inputs (expected from Phase 1/2/4):
  - Protos exist and generate Python stubs:
    - `server/public/pluginapi/grpc/proto/plugin.proto`
    - `server/public/pluginapi/grpc/proto/api.proto`
  - Go-side gRPC server implements Plugin API service with these RPCs (Phase 4)
- Key upstream truth for scope:
  - `server/public/plugin/api.go` (authoritative API surface)
</execution_context>

<context>
- This plan focuses on the API methods that conceptually operate on:
  - Users (create, get, update, roles, status, preferences, sessions, etc.)
  - Teams (create, get, members, roles, invites, etc.)
  - Channels (create, get, members, moderation, invites, etc.)
- Design constraints from Phase 6 research:
  - Prefer Pythonic signatures and wrapper types; keep generated protobuf modules internal.
  - Don’t leak `grpc.RpcError`; convert to SDK exceptions.
  - Keep code maintainable: avoid a single 5k-line `client.py` if possible.
</context>

<tasks>
### Mandatory discovery + scope sizing (Level 0 → 1)
- [ ] **Generate the RPC inventory for this scope**:
  - Add (or reuse) a script that prints RPC names from the generated service descriptor, e.g.:
    - `python -c "from mattermost_plugin.grpc import api_pb2; print([m.name for m in api_pb2.DESCRIPTOR.services_by_name['PluginAPI'].methods])"`
  - Derive the User/Team/Channel subset. Recommended heuristic:
    - Include RPCs where the RPC name contains `User` or `Team` or `Channel`
    - Exclude obvious non-scope domains (e.g., contains `Post`, `File`, `KV`)
  - **If the count is too large (> ~80 RPCs), split into 2 plans**:
    - `06-02a` Users+Teams, `06-02b` Channels (or similar).

### Wrapper types (Pythonic surface)
- [ ] **Add/extend wrapper dataclasses** (module recommendation: `mattermost_plugin/_internal/wrappers.py` or split by domain):
  - `User`, `Team`, `Channel`
  - Add membership wrappers as needed by chosen RPCs:
    - e.g., `TeamMember`, `ChannelMember`, `ChannelModeration`, etc.
- [ ] **Add conversion utilities**:
  - Centralize `from_proto`/`to_proto` conversions and common transforms (timestamps, bytes, maps).
  - Avoid converting every message immediately if performance becomes a concern; start with core types and benchmark later (see Phase 6 research open questions).

### Client methods (sync-first, with a clear naming convention)
- [ ] **Decide mapping rule: RPC → Python method name**
  - Recommendation: `GetUser` → `get_user`, `ListChannelsForTeam` → `list_channels_for_team`
  - Document any special cases in code comments (not in README).
- [ ] **Implement client methods for all RPCs in this scope**
  - For each RPC:
    - Build the protobuf request message from Python inputs
    - Call the stub method
    - Convert the response into wrapper types / primitives
    - Wrap `grpc.RpcError` via `convert_grpc_error()`
  - Maintain consistent docstrings:
    - `Args`, `Returns`, `Raises` at minimum
- [ ] **(Optional but recommended) Avoid a monolithic file**
  - If `client.py` starts to bloat, introduce mixins or per-domain modules:
    - e.g., `mattermost_plugin/_internal/mixins/users.py`, `teams.py`, `channels.py`
    - `PluginAPIClient` composes these mixins to keep a clean public entry point.

### Tests + coverage tooling
- [ ] **Add a coverage audit script** (recommended: `python-sdk/scripts/audit_client_coverage.py`)
  - Inputs: RPC names from `api_pb2.DESCRIPTOR.services_by_name['PluginAPI']`
  - Rule: ensure for each in-scope RPC there exists a corresponding Python method on `PluginAPIClient`
  - Support `--include` and `--exclude` regex patterns so future plans can reuse this tool
- [ ] **Unit tests for conversions + request construction**
  - Use mocking (patch the stub) for fast tests:
    - Assert the correct request message is constructed
    - Assert the wrapper conversion behavior
    - Assert `grpc.StatusCode.NOT_FOUND` (and at least one more) maps to an SDK exception
- [ ] **One integration-style test** (optional if too heavy)
  - Spin up an in-process gRPC server implementing 1–2 representative RPCs (one user, one channel) to ensure “real” gRPC roundtrips work.
</tasks>

<verification>
- **Generate protos (if not committed)**
  - `cd python-sdk && python scripts/generate_protos.py`
- **Run audit for this plan’s scope**
  - `python scripts/audit_client_coverage.py --include '(User|Team|Channel)' --exclude '(Post|File|KV)'`
- **Run tests**
  - `pytest -q`
- **Type-check SDK**
  - `mypy src/mattermost_plugin`
</verification>

<success_criteria>
- Wrapper types exist for User/Team/Channel (and memberships as needed) and are used in the public client surface.
- All in-scope RPCs have corresponding Python client methods (enforced by the audit script).
- Client methods:
  - Build correct protobuf requests
  - Convert responses to Pythonic outputs
  - Never leak `grpc.RpcError`
- Tests cover:
  - At least one success path and one error path per domain (Users/Teams/Channels)
- `pytest` passes and the audit script reports no missing methods for this scope.
</success_criteria>

<output>
- Modified:
  - `python-sdk/src/mattermost_plugin/client.py` (and possibly new mixin modules)
  - `python-sdk/src/mattermost_plugin/_internal/wrappers.py` (or split wrappers)
  - `python-sdk/src/mattermost_plugin/exceptions.py` (extend mapping as needed)
- Added:
  - `python-sdk/scripts/audit_client_coverage.py`
  - `python-sdk/tests/test_users_teams_channels.py` (name flexible)
</output>



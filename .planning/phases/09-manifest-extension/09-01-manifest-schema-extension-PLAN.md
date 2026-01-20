# Phase 9 — Manifest Extension
## Plan 09-01: Manifest schema extension for Python plugins

<objective>
Extend the plugin manifest format (JSON/YAML) to support **Python server-side plugins** in a backward-compatible way:
- Add explicit manifest fields to declare the server runtime as Python
- Allow declaring a Python entry point (script/module) and runtime requirements (python_version, dependency/venv strategy)
- Update all schema/type surfaces in this repo (Go model, OpenAPI, Webapp TS types)
- Add/adjust unit tests proving the new fields parse correctly (JSON + YAML)
</objective>

<execution_context>
- Repo root: `mattermost-python-in-plugins/`
- Phase: 9 (Manifest Extension)
- Plan: 09-01
- Depends on:
  - Phase 5 design intent: `.planning/phases/05-python-supervisor/05-RESEARCH.md` (calls out Phase 9 fields: runtime + python_version + dependency approach)
- Primary code touchpoints for this plan:
  - Go manifest model: `server/public/model/manifest.go`, `server/public/model/manifest_test.go`
  - REST/OpenAPI schema: `api/v4/source/definitions.yaml` (`PluginManifest`)
  - Webapp types: `webapp/platform/types/src/plugins.ts` (and any other TS types that embed `PluginManifest`)
</execution_context>

<context>
- **Current manifest reality**:
  - The manifest model is in `server/public/model/manifest.go` and is parsed from `plugin.json` / `plugin.yaml` via `model.FindManifest`.
  - Server-side plugin startup currently assumes `manifest.server.executable(s)` points to a Go binary; Phase 5 introduces Python supervisor behavior and needs Phase 9 fields to make runtime explicit.
- **Backward compatibility constraint**:
  - Existing Go plugins must continue to load unchanged.
  - Existing API consumers should not break; new fields must be optional and additive.
- **Where the manifest is exposed**:
  - The REST API returns plugin manifests (see `server/public/model/plugins_response.go`, OpenAPI `PluginManifest` schema, and Webapp TS types).
- **Design goal**:
  - Make it unambiguous which runtime a plugin expects (Go vs Python), and provide enough metadata for Phase 5+ supervisor decisions without inventing new out-of-band conventions.
</context>

<tasks>
### Mandatory discovery (Level 0 → 2)
- [ ] **Confirm current schema surfaces** and note required updates:
  - Go: `server/public/model/manifest.go` (`Manifest`, `ManifestServer`)
  - OpenAPI: `api/v4/source/definitions.yaml` → `PluginManifest.server`
  - Webapp TS: `webapp/platform/types/src/plugins.ts` → `PluginManifestServer`
- [ ] **Confirm Phase 5 expectations** for what needs to be in the manifest (runtime signal, python_version, dependency strategy):
  - Read: `.planning/phases/05-python-supervisor/05-RESEARCH.md` (Open Questions + recommendations)
- [ ] **Confirm entry-point representation** used by the supervisor implementation:
  - Verify whether Phase 5 uses `server.executable(s)` as the entry point for Python scripts, or introduces a separate field.

### Schema design (make the decision explicit)
- [ ] **Choose the schema shape** (recommendation below) and document the final decision in this plan before implementing:
  - **Recommendation (minimal + compatible)**: extend `server` block with new optional fields:
    - `runtime`: string enum, default `"go"`; new value `"python"`
    - `python_version`: optional string (e.g. `"3.11"` or `">=3.10"`, treated as informational/validation input)
    - `python`: optional object for dependency strategy, e.g.:
      - `dependency_mode`: `"system" | "venv" | "bundled"` (or similar)
      - `venv_path`: relative path to venv directory (if `dependency_mode=venv`)
      - `requirements_path`: optional relative path to requirements file (if used)
    - `args`: optional string array (arguments passed to plugin entry point)
    - `env`: optional string map (environment variables for the plugin process)
  - **Entry point**:
    - Keep using existing `server.executable` / `server.executables` as the entry point path within the bundle (Go binary today; Python script/module tomorrow).
    - Add validation rules later (Plan 09-02) based on `runtime`.
- [ ] **Write examples** (for later copy-paste into docs/tests) for:
  - Go plugin (unchanged)
  - Python plugin (new fields), both JSON and YAML

### Implement schema across repo surfaces
- [ ] **Go model**: extend `server/public/model/manifest.go`
  - Add new fields to `ManifestServer` with JSON+YAML tags.
  - Keep all new fields optional to preserve older manifests.
  - Update the comment example in `manifest.go` to include a Python variant.
- [ ] **OpenAPI**: extend `api/v4/source/definitions.yaml` → `PluginManifest.server`
  - Add `runtime`, `python_version`, and the `python` object fields (and their sub-fields).
  - Ensure descriptions clarify Python-only semantics and backward compatibility.
  - If `backend` remains documented as deprecated, decide whether to also mirror new fields there (recommendation: do not extend deprecated `backend`).
- [ ] **Webapp TS types**:
  - Update `webapp/platform/types/src/plugins.ts`:
    - Add `runtime?: 'go' | 'python'` (or string union consistent with Go enum)
    - Add `python_version?: string`
    - Add `python?: {dependency_mode?: ...; venv_path?: string; requirements_path?: string}`
    - Consider relaxing `executable` to optional if `executables` is present (current OpenAPI allows both patterns).
  - Update any other TS types that embed/duplicate manifest shape (search for `PluginManifestServer` usage).

### Tests (schema-only)
- [ ] **Manifest unmarshal tests**: update/extend `server/public/model/manifest_test.go`
  - Add JSON + YAML cases that include the new fields and assert they round-trip into the expected Go struct.
  - Add one negative/edge case for unknown `runtime` value if you choose to validate at unmarshal-time (recommendation: defer runtime validation to Plan 09-02).
</tasks>

<verification>
- **Go unit tests (manifest parsing)**
  - `go test ./server/public/model -run 'TestManifestUnmarshal|TestFindManifest'`
- **API schema build (if available in repo)**
  - Validate OpenAPI generation/validation step used by this repo (see `api/README.md` + `api/package.json`).
- **Webapp TS typecheck (if needed)**
  - Ensure `webapp/platform/types` compiles after type updates (exact command depends on webapp workspace tooling).
</verification>

<success_criteria>
- Go `ManifestServer` includes Python-related fields (optional/additive) and parses from both JSON and YAML.
- OpenAPI `PluginManifest.server` includes the new fields with clear descriptions.
- Webapp TypeScript types include the new fields without breaking compilation.
- Existing Go-plugin manifests remain valid and unaffected.
</success_criteria>

<output>
- Updated files (expected):
  - `server/public/model/manifest.go`
  - `server/public/model/manifest_test.go`
  - `api/v4/source/definitions.yaml`
  - `webapp/platform/types/src/plugins.ts`
- New/updated manifest examples (in-code comments/tests; no new standalone docs).
</output>



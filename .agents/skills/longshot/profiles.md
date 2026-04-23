# Longshot Profiles

Project profiles define build commands, plan templates, and agent routing for `/longshot`. Cross-cutting behavior lives elsewhere:

- Top-level build commands, git safety, commit format → [rules.md](rules.md)
- PR template handling (follow `PULL_REQUEST_TEMPLATE.md` if present, else use the default body) → [phase-7-ship.md § Step 7.5](phase-7-ship.md)
- Security handling (language, branch, test code, PR sanitization) → [rules.md §3](rules.md#3-security-handling)

## Profile Detection Order

1. `--profile <name>` flag → force profile (`mm`, `mm-mobile`, `mm-plugin`, `mm-playbooks`, `generic`)
2. Auto-detect (see each profile's Detection section)
3. Fallback → Generic profile

---

## Profile: Mattermost

### Detection
- `server/channels/` AND `webapp/channels/` directories exist
- OR project CLAUDE.md mentions "Mattermost"

### Plan Template
MM Layer Template (Model → Store → App → API → Webapp). Base structure from conductor's `templates/track-plan.md`, with phases organized by MM layers.

### Layers
| Layer | Directory | Language |
|-------|-----------|----------|
| Model | `server/public/model/` | Go |
| Store | `server/channels/store/` | Go |
| App | `server/channels/app/` | Go |
| API | `server/channels/api4/` | Go |
| Webapp | `webapp/channels/src/` | TypeScript/React |

### Build Commands
| Step | Command | When |
|------|---------|------|
| Server lint | `cd server && make check-style` | Phase 5 |
| Webapp lint | `cd webapp && make check-style` | Phase 5 |
| Type check | `cd webapp && make check-types` | Phase 5 |
| Format Go | `cd server && make fmt` | Phase 5 auto-fix |
| Fix JS | `cd webapp && make fix-style` | Phase 5 auto-fix |
| i18n extract (server) | `cd server && make i18n-extract` | Phase 5 (if server strings changed) |
| i18n extract (webapp) | `cd webapp && make i18n-extract` | Phase 5 (if webapp strings changed) |
| Server test | `cd server && make test-server` | Phase 4 |
| Single Go test | `cd server && go test ./channels/app -run TestName -v` | Phase 4 targeted |
| Webapp test | `cd webapp && make test` | Phase 4 |

> **Note**: Targeted `go test -run` for single tests is acceptable when no make target exists.
| Deploy local | `cd server && make run` | Manual verification |

### Documentation References
Product and developer docs are often cloned as sibling repos. Check for these relative to the project root's parent directory:
- **Product docs**: `../docs/` (from https://github.com/mattermost/docs) — user-facing documentation, feature guides
- **Developer docs**: `../mattermost-developer-documentation/` (from https://github.com/mattermost/mattermost-developer-documentation) — API docs, plugin development, contribution guides, architecture
- **Handbook**: `../mattermost-handbook/` (from https://github.com/mattermost/mattermost-handbook) — team processes, conventions, decision-making norms
- **Plugin starter template**: `../mattermost-plugin-starter-template/` (from https://github.com/mattermost/mattermost-plugin-starter-template) — reference patterns for plugin structure (relevant for playbooks profile)
- **Mobile app**: `../mattermost-mobile/` (from https://github.com/mattermost/mattermost-mobile) — React Native mobile client
- If found: reference during Phase 1 (requirements) and Phase 2 (planning) for existing documentation on the feature area
- If the feature changes user-facing behavior: flag that product docs may need updating in Phase 7 (docs check)
- **Mobile consideration**: During Phase 1, always ask: "Does this feature need mobile app changes?" If yes, flag as a cross-repo dependency and note in the plan
- **AI Engineering Principles**: https://mattermost.atlassian.net/wiki/x/AwDhAQE — accountability, review standards, design-first approach

### Style Guides
Load and follow project style guides during implementation and review:
- **Webapp**: `webapp/STYLE_GUIDE.md` (if exists) — React/TS conventions, component patterns, naming, imports
- These are MANDATORY reading before Phase 3 (Implement) and Phase 6 (Review)
- Domain agents should be prompted with relevant style guide excerpts

### Agent Routing
Three-level agent discovery (check in order, higher levels override lower). Paths below are the Claude Code convention; other platforms use equivalent locations.
- Level 1: Global agent directory (e.g., `~/.claude/agents/`, including a `mattermost/` subdirectory)
- Level 2: Parent repo agent directory (e.g., `.claude/agents/` in a parent of the project) if it exists
- Level 3: Project-level agent directory (e.g., `.claude/agents/` in the project root) — highest priority

Domain routing for plan consultation:
| Feature touches | Agents |
|----------------|--------|
| Database/migrations | `database-architecture-reviewer`, `db-migration` |
| Permissions/auth | `permission-design-auditor`, `permission-auditor` |
| API design | `api-contract-reviewer`, `api-reviewer` |
| Frontend/React | `react-frontend`, `redux-expert`, `component-reviewer` |
| System design | `system-design-reviewer` |
| Caching | `caching-strategist` |
| TipTap/editor | `tiptap-reviewer` (if exists) |

### Pre-Ship Checks
Run all of these before committing (Phase 7, Step 7.0). Order: auto-fix first, then verify.
| Step | Command |
|------|---------|
| Go format | `cd server && make fmt` |
| Go lint | `cd server && make check-style` |
| Go tests | `cd server && make test-server` |
| JS/TS fix | `cd webapp && make fix-style` |
| Webapp lint | `cd webapp && make check-style` |
| Type check | `cd webapp && make check-types` |
| Webapp tests | `cd webapp && make test` |
| i18n (server) | `cd server && make i18n-extract` (if server strings changed) |
| i18n (webapp) | `cd webapp && make i18n-extract` (if webapp strings changed) |

---

## Profile: Generic

### Detection
Fallback when no specific profile matches.

### Plan Template
Generic Template. Base structure from conductor's `templates/track-plan.md`, with phases organized by component/module.

### Build Commands (Auto-Detected)
Scan these files in order to discover commands:
1. `Makefile` → targets: `test`, `lint`, `check`, `build`
2. `package.json` → scripts: `test`, `lint`, `check`, `build`, `typecheck`
3. `pyproject.toml` → `[tool.pytest]`, `[tool.ruff]`, `[tool.mypy]`
4. `Cargo.toml` → `cargo test`, `cargo clippy`
5. `go.mod` → `make test`, `make check-style` (fallback: `go test ./...` if no Makefile)

### Agent Routing
Global agents only (e.g., `~/.claude/agents/` on Claude Code, or the equivalent location on other platforms). No project-specific agents.

### Pre-Ship Checks
Run all detected lint, typecheck, and unit test commands from the auto-detected build commands above.

---

## Profile: mattermost-mobile

### Detection
- `android/` AND `ios/` AND `app/` directories exist
- AND `package.json` mentions `@mattermost/react-native` or repo name is `mattermost-mobile`

### Plan Template
Mobile Feature Template — focus on screens, navigation, data layer, and platform-specific behavior.

### Layers
| Layer | Directory | Language |
|-------|-----------|----------|
| Screens | `app/screens/` | TypeScript/React Native |
| Components | `app/components/` | TypeScript/React Native |
| Actions/Reducers | `app/actions/`, `app/reducers/` | TypeScript |
| Client | `app/client/` | TypeScript |
| Native modules | `android/`, `ios/` | Kotlin/Java, Swift/ObjC |
| Assets | `assets/` | Images, fonts |

### Build Commands
| Step | Command | When |
|------|---------|------|
| Install deps | `npm install` | Phase 0 |
| Lint | `npm run lint` | Phase 5 |
| Type check | `npm run check-types` | Phase 5 |
| Fix lint | `npm run lint -- --fix` | Phase 5 auto-fix |
| Unit tests | `npm test` | Phase 4 |
| iOS build | `npx react-native run-ios` | Manual verification |
| Android build | `npx react-native run-android` | Manual verification |

### Style Guides
- Check for `STYLE_GUIDE.md` or `CONTRIBUTING.md` in repo root
- Follow React Native conventions: functional components, hooks, StyleSheet over inline styles

### Documentation References
- Sibling repo `../mattermost/` — server/webapp source (for API contracts and shared types)
- Sibling repo `../mattermost-developer-documentation/` — mobile dev guides

### Agent Routing
| Domain | Agents |
|--------|--------|
| React Native | `mobile-developer`, `react-frontend` |
| Navigation | `mobile-developer` |
| Native modules | `mobile-developer`, `ios-developer`, `android-developer` (if available) |
| State management | `redux-expert` |
| Accessibility | `accessibility-guardian` |

### Cross-Repo Awareness
Features that touch the mobile app often require corresponding server/webapp changes:
- **API changes**: verify the endpoint exists in the server repo; if not, flag as a dependency
- **WebSocket events**: verify event types match between server and mobile client
- **Shared types**: check `@mattermost/types` package for type consistency
- **Push notifications**: changes may require server-side notification handler updates
- During Phase 1 (Requirements), always ask: "Does this feature also need server or webapp changes?"

### Pre-Ship Checks
| Step | Command |
|------|---------|
| Auto-fix | `npm run lint -- --fix` |
| Lint | `npm run lint` |
| Type check | `npm run check-types` |
| Unit tests | `npm test` |

---

## Profile: mattermost-plugin (Generic)

Base profile for any Mattermost plugin. Specific plugins (e.g., playbooks) extend this with overrides.

### Detection
- `server/` AND `webapp/` directories exist
- AND `plugin.json` exists in root
- AND `go.mod` mentions `github.com/mattermost/mattermost/server`
- NOT matched by a more specific plugin profile (e.g., playbooks)

### Plan Template
Plugin Feature Template — scoped to plugin server + webapp layers.

### Layers
| Layer | Directory | Language |
|-------|-----------|----------|
| Plugin server | `server/` | Go |
| Plugin webapp | `webapp/` or `webapp/src/` | TypeScript/React |
| Plugin API | `server/api.go` or `server/plugin.go` | Go |
| Configuration | `plugin.json`, `server/configuration.go` | JSON/Go |

### Build Commands
| Step | Command | When |
|------|---------|------|
| Install deps | `cd webapp && npm install` | Phase 0 |
| Build plugin | `make dist` | Manual verification |
| Deploy local | `make deploy` | Local testing |
| Go lint | `make check-style` | Phase 5 |
| Go format | `cd server && make fmt` | Phase 5 auto-fix |
| Go test | `make test-server` | Phase 4 |
| Webapp lint | `cd webapp && npm run lint` | Phase 5 |
| Webapp fix | `cd webapp && npm run fix` or `npm run lint -- --fix` | Phase 5 auto-fix |
| Webapp typecheck | `cd webapp && npm run check-types` | Phase 5 |
| Webapp test | `cd webapp && npm test` | Phase 4 |

### Documentation References
- **Plugin starter template**: `../mattermost-plugin-starter-template/` — canonical plugin structure reference
- **Developer docs**: `../mattermost-developer-documentation/` — plugin API reference, hooks, settings
- **Main server**: `../mattermost/` — for server API contracts and shared model types

### Style Guides
- Check for `STYLE_GUIDE.md` or `CONTRIBUTING.md` in repo root
- Follow Mattermost plugin conventions: `plugin.go` as entry point, `configuration.go` for settings, `api.go` for HTTP handlers

### Agent Routing
| Domain | Agents |
|--------|--------|
| Go backend | `go-backend`, `pattern-reviewer`, `error-handling-reviewer` |
| React/TS | `react-frontend`, `component-reviewer` |
| Plugin API | `api-reviewer` |
| Testing | `test-coverage-reviewer`, `test-unit-expert` |

### Plugin-Specific Considerations
- **Plugin manifest** (`plugin.json`): verify `min_server_version` is set correctly for any new server API usage
- **Hooks**: if adding new plugin hooks, verify they exist in the server's plugin API for the target server version
- **Settings**: new settings must be added to both `plugin.json` (schema) and `server/configuration.go` (Go struct)
- **Webapp registration**: new components must be registered via `registry.registerComponent()` in the plugin's `index.ts`
- **Bundle size**: plugins ship as a single binary; be mindful of large dependencies in webapp

### Pre-Ship Checks
| Step | Command |
|------|---------|
| Go format | `cd server && make fmt` |
| Lint/typecheck | `make check-style` |
| Go tests | `make test-server` |
| Webapp fix | `cd webapp && npm run fix` (if available) |
| Webapp lint | `cd webapp && npm run lint` |
| Webapp typecheck | `cd webapp && npm run check-types` (if available) |
| Webapp tests | `cd webapp && npm test` |

---

## Profile: mattermost-plugin-playbooks

Extends the `mattermost-plugin` profile with playbooks-specific overrides.

### Detection
- `server/` AND `webapp/` exist
- AND `go.mod` mentions `mattermost-plugin-playbooks`

### Overrides from mattermost-plugin

#### Additional Build Commands
| Step | Command | When |
|------|---------|------|
| i18n extract | `make i18n-extract` | Phase 5 (both server + webapp) |
| Deploy | `make deploy` | Fetches deps, auto-generates GraphQL and other types |

#### Layers (extended)
| Layer | Directory | Language |
|-------|-----------|----------|
| GraphQL | `server/api/` | Go (auto-generated types) |
| Playbook models | `server/app/` | Go |
| Client | `client/` | Go (API client) |

#### Playbooks-Specific Considerations
- **GraphQL codegen**: after modifying `.graphql` schema files, run `make generate` to regenerate Go types
- **Auto-generation**: `make deploy` triggers auto-generation for GraphQL and other types — always run before committing
- **Telemetry**: new features should include telemetry tracking calls
- **Permissions**: playbook-level permissions are managed separately from Mattermost channel permissions

#### Pre-Ship Checks
| Step | Command |
|------|---------|
| Full style check | `make check-style` |
| i18n | `make i18n-extract` |
| Deploy (generates types) | `make deploy` |

#### End-of-Cycle Checklist
1. Ensure tests are written or updated and adequately cover changes
2. Run lint and type checks (`make check-style`)
3. Extract i18n to ensure en.json changes are up to date (`make i18n-extract`)
4. Deploy changes locally (`make deploy`)
5. Stage relevant changes and propose commit message (ask user to confirm)

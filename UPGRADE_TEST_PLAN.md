# Upgrade-path test coverage + Testcontainers structure

## Context

There is currently no test anywhere in the repo that boots an older Mattermost server version
against a real database, upgrades it in place to a newer version, and verifies the upgrade
succeeded (migrations complete, data survives, functionality still works). Research turned up:

- **No prior art for a live version-swap test.** `e2e-tests/cypress/.../plugins/upgrade_spec.js`
  only upgrades a *plugin* on a fixed server version. `server/scripts/psql-migration-test.sh`
  diffs `pg_dump --schema-only` output between a migrated-old-dump DB and a fresh-install DB — a
  useful schema-equivalence idea, but CLI-driven against a static SQL dump, not a live server.
- **`docs/.../labels.md`** documents a `Setup Upgrade Test Server` PR label that "triggers the
  creation of a test server and performs an upgrade" — implying an external/internal CI system
  handles this today, with nothing checked into this repo.
- **A local branch `testcontainers-rolling-upgrades` already exists** (empty, same commit as
  HEAD) — a placeholder bookmark suggesting this exact feature was already anticipated.
- **The Testcontainers harness in `e2e-tests/playwright/lib/src/containers/` is a clean fit**,
  confirmed by direct code reading:
  - `mattermost_container.ts:79` builds the server container from `testConfig.serverImage`, read
    fresh from the mutable `testConfig` singleton on every call — not cached at first boot.
  - `stack.ts`'s `restartMattermostContainer(env)` (`stack.ts:257-286`) already does exactly the
    "stop this one container, start a new one on the same network" dance used by
    `ensureFeatureFlag`/`ensureLocalFile`/etc. — it only `docker rm -f`s the Mattermost container
    (`stack.ts:271`); Postgres is never touched, so its data (in the container's writable layer,
    no volume — `postgres_container.ts`) survives across the swap untouched.
  - So "upgrade" is structurally just "restart with a different image" — no new container
    lifecycle code is needed, only a thin helper that swaps `testConfig.serverImage` before
    delegating to the existing restart path.

This plan has four parts: (1) what test coverage an upgrade scenario needs, (2) the concrete
Playwright + Testcontainers structure to implement it — the helper, the env vars, the folder/tag
convention, and the project dependency graph, (3) two local-dev npm scripts, and (4) CI integration
inline with the existing per-worker job. **This is a planning/design deliverable only** — no code
is written in this pass; treat it as the basis for a follow-up implementation task once reviewed.

## Part 1 — Test coverage for the upgrade path: end-to-end, through the actual UI

**Course correction from the earlier draft of this plan**: verifying "data survives" by re-fetching
a row via the admin API client proves the *database* survived, not that a real user or admin would
ever notice anything was fine — this is end-to-end testing, so the pass/fail signal has to be
"what does a person using the product actually see," through `pw.testBrowser`/page objects, not
`adminClient.getPost(id)`. API/DB-level checks (Part 1's earlier §3/3b content) still have a role —
as a *defensive* secondary signal when a UI check fails, to help tell "the data is gone" apart from
"the data is fine but the UI broke rendering it" — but they are no longer the primary coverage.

**Persistent actors, established once in the from-phase, reused unchanged in the to-phase:**
- **A regular user** — created via `pw.initSetup()` during `upgrade-from`; the exact same
  credentials log back in during `upgrade-to`. Nothing about this user is recreated between phases.
- **The admin** — `testConfig.adminUsername`/`adminPassword`, already fixed for the whole run
  (not per-user-created), so no extra setup needed for it to persist as an actor.

### User journey

| # | Action (from-phase, via UI) | Re-check (to-phase, via UI) | Page object |
|---|---|---|---|
| U1 | Post a message in a **public channel** | Message still visible in that channel | `ChannelsPage.postMessage()` — exists |
| U2 | Post a message in a **private channel** (`newChannel(name, 'private')`) | Same | `ChannelsPage` — exists |
| U3 | Post a message in a **DM** (`openDirectChannelsModal().selectUser(other).goToChannel()`) | Same, thread/channel intact | `DirectChannelsModal` — exists |
| U4 | Post a message in a **GM** (`selectUser()` called multiple times) | Same, all members still present | `DirectChannelsModal` — exists |
| U5 | Upload a **profile photo** | Avatar still renders correctly wherever shown (post header, thread footer, profile popover) | **Does not exist** — no upload or verify-photo helper anywhere in `lib/src/ui/`; needs building |
| U6 | Post a message **with a file attachment** (`postMessage(msg, [file])`, existing `waitUntilFilePreviewContains` confirms the compose-time preview) | The *sent* post's attachment still renders a thumbnail/link and downloads correctly | Upload-time preview exists (`PostCreate`); **post-send render/download verification does not exist** — needs building. This is exactly where Part 2E's local-storage bind-mount fix earns its keep — without it, this is the step that silently fails for the default backend |
| U7 | **Search** for the message/attachment content (`SearchBox.search()`) | Same search still finds the same result in `SearchResultsPanel` | `SearchBox`/`SearchResultsPanel` — exist |
| U8 | Open the **About modal**, capture the shown version string | Same modal now shows the to-version — the one truly indispensable "did the swap take effect, as a *person* would check it" signal | **Does not exist** — `Footer.aboutLink` locator exists but is unused by any spec; no page object exposes the modal's version/build text. Needs building |

### Admin journey

| # | Action (from-phase, via UI) | Re-check (to-phase, via UI) | Page object |
|---|---|---|---|
| A1 | Open the **About modal** in Channels, and **System Console's About/"Edition and License"** area | Both now show the to-version | Channels: same gap as U8. System Console: `EditionAndLicense` exists but only checks a heading is visible — **needs extending to actually expose/assert a version string** |
| A2 | Upload a **plugin** via System Console → Plugins | Plugin still listed and enabled | `PluginManagement` exists for `pluginRow()`/`removePlugin()` (verify-absence only) — **needs a new upload/enable method**, since only removal exists today |
| A3 | All of U1–U7, from the admin's own perspective/session | Same | Reuses the user journey's page objects |
| A4 | *(to-phase only, no from-phase equivalent — nothing has restarted yet)* Confirm the migration completed via whatever an admin would actually check | See "Known gaps" below — **this one genuinely doesn't have a clean UI answer today** | — |
| A5 | *(to-phase only)* Confirm the DB schema is sound post-upgrade | See "Known gaps" below | — |

### Known gaps — no UI surface exists for these; being explicit rather than faking it

- **A4, migration confirmation "as an admin would see it."** System Console → Reporting → Server
  Logs exists only as a sidebar nav link (`SystemConsoleSidebar.reporting.serverLogs`) — no page
  object reads its content, and it's genuinely unconfirmed whether that viewer even shows
  *historical* log lines (including the startup-time "All migrations are complete." line) or only
  tails logs live from whenever it's opened — if the latter, an admin who opens it *after* the
  server already finished restarting would see nothing useful there, making this check
  unbuildable as a real UI journey no matter how much page-object work goes into it. Needs
  confirming against actual product behavior before committing to build this. Fallback: keep the
  existing container-log-based check (`Wait.forLogMessage`/`collectLogs`) as what actually verifies
  migrations completed — real, just not "through the UI."
- **A5, migration schema.** No UI surface for database/schema health exists in the product at all
  (confirmed — no page object, no System Console section). The closest *admin-facing tool* (not
  UI, but also not a raw API call) is `mmctl`, already wired into this harness via `runMmctl()`
  (`mmctl_container.ts`) — e.g. `mmctl version`, or confirming ordinary `mmctl` data commands still
  work post-upgrade. Presented honestly as the closest available admin-facing check, not a
  substitute for a UI journey that doesn't exist.

### What this replaces from the earlier draft

- The old item 3 ("re-fetch via admin API client") becomes the *defensive fallback* for U1-U4,
  not the primary check.
- The old item 3b (Postgres/local/Minio/Azurite backend checks) is now **what U6 exercises through
  the UI** — the backend-integrity requirement is unchanged, only how it's verified changed. Part
  2E's local-storage bind-mount fix is still exactly as necessary as before; it's just U6 that
  depends on it now; not a standalone API-level spec.
- The old item 4 ("core functional smoke") is now U1-U4/U7 specifically, not a vague placeholder.
- **Config compatibility**, **search index compatibility** (Elasticsearch/OpenSearch), and **no
  downgrade path** remain unchanged from the earlier draft — genuinely separate concerns from the
  actor-journey reframing above.
- **Plugin compatibility** is promoted out of "stretch" into A2 — the user explicitly asked for it
  alongside the other admin checks, not as a deferred nice-to-have.

## Part 2 — Structure in Playwright using Testcontainers

**A. One new helper, reusing existing machinery almost entirely.**

New file `e2e-tests/playwright/lib/src/server/version.ts`:
```ts
export async function upgradeServerImage(image: string, extraEnv: Record<string, string> = {}): Promise<void> {
    if (!testConfig.useTestContainers) {
        throw new Error('upgradeServerImage requires PW_USE_TESTCONTAINERS=true.');
    }
    testConfig.serverImage = image;
    await restartMattermostContainer(extraEnv);
}
```
This is deliberately thin: `restartMattermostContainer` (`stack.ts:257`) already handles the
`docker rm -f` + fresh start on the same network/Postgres, the `.env.testcontainers` history
append (so `logs/testcontainers_env_history.log` shows the version transition alongside every
other restart, no extra bookkeeping needed), the timeout extension, and the client-cache clear.
Wire it through the same path as `ensureFeatureFlag`/`ensureLocalFile`
(`lib/src/server/feature_flags.ts`, `filestore.ts`) into `server/index.ts` → `index.ts` →
`test_fixture.ts` (`ExtendedFixtures` type + constructor assignment), so specs call it as
`pw.upgradeServerImage(...)`, matching every other `pw.ensure*()` helper's calling convention.

**B. Two image references, reusing the existing env var for the default (to) side.**

- **To-image**: the existing `SERVER_IMAGE` env var (`test_config.ts:159`) — already the default
  every other project (`chrome`/`firefox`/`ipad`) boots the initial stack against, via
  `global_setup.ts` → `startStack()`. Reusing it for "to" means the upgrade test always upgrades
  *to* whatever version the rest of the run is already testing (e.g. the PR build or `master`).
  Zero new config needed for this side.
- **From-image**: one new env var, `PW_UPGRADE_FROM_SERVER_IMAGE`, read directly by the spec (not
  centralized into `testConfig`, since it's only meaningful to the upgrade spec — same convention
  as `ELASTICSEARCH_VERSION` being read directly via `process.env` in `elasticsearch_container.ts`
  rather than added to the global config surface).

**C. Folder + tag convention — folders for ownership, tags for selection.**

- **Dedicated** upgrade-only specs live in two new folders:
  - `e2e-tests/playwright/specs/upgrade/from/**` — only meaningful against the older version
    (e.g. asserting a known pre-upgrade behavior that's the very thing being upgraded away from).
  - `e2e-tests/playwright/specs/upgrade/to/**` — only meaningful against the newer version.
- **Common** coverage — existing functional specs elsewhere in `specs/` that are cheap, high-value
  smoke checks worth running in *both* phases (login, post, basic search) — stay exactly where
  they already live; they're shared with the regular functional suite too, so they can't be moved.
- **Selection is entirely tag-driven, not folder-driven** — every spec that should run during
  upgrade coverage carries a tag, using the same `{tag: [...]}` convention already used throughout
  `specs/` (e.g. `specs/functional/system_console/permissions/team_access.spec.ts:11`'s
  `{tag: ['@smoke', '@system_console']}`):
  - `@upgrade-from` — dedicated from-phase specs (`specs/upgrade/from/**`).
  - `@upgrade-to` — dedicated to-phase specs (`specs/upgrade/to/**`).
  - `@upgrade` — common specs, run in *both* phases.

  This is a deliberate, non-obvious constraint: Playwright's `grep` only filters *titles* of
  whatever `testDir`/`testMatch` already discovered — it can't reach outside that file set to pull
  in specs from other folders. To let one project's selection span both a dedicated folder *and*
  arbitrary common specs elsewhere, `testDir` has to stay the full `specs/` tree for every upgrade
  project, with tags as the *only* selection mechanism. The practical consequence: files physically
  placed under `specs/upgrade/from/` or `specs/upgrade/to/` still need their own tag — folder
  placement alone does not select them. Folder = ownership/discoverability for humans; tag = what
  Playwright actually runs.

**D. Two swap steps + two run projects — ordered by invocation, not by Playwright `dependencies`.**

Each phase is two projects: a tiny "swap" project (one test, same shape as the existing `setup`
project's spec files) that performs the version change, followed by a "run" project that executes
that phase's tests. Add to `playwright.config.ts:53`'s `projects` array:

```ts
{name: 'upgrade-swap-from', testMatch: /upgrade_swap_from\.ts/, dependencies: ['setup']},
{
    name: 'upgrade-from',
    testDir: 'specs',
    grep: /@upgrade-from\b|@upgrade\b/,
    dependencies: ['upgrade-swap-from'],
    fullyParallel: false,
    workers: 1,
},
{name: 'upgrade-swap-to', testMatch: /upgrade_swap_to\.ts/, dependencies: ['setup']},
{
    name: 'upgrade-to',
    testDir: 'specs',
    grep: /@upgrade-to\b|@upgrade\b/,
    dependencies: ['upgrade-swap-to'],
    fullyParallel: false,
    workers: 1,
},
```

New files (mirroring `specs/test_setup.ts`'s own shape exactly):
- `e2e-tests/playwright/specs/upgrade/upgrade_swap_from.ts`:
  `setup('swap to from-image', async ({pw}) => { await pw.upgradeServerImage(process.env.PW_UPGRADE_FROM_SERVER_IMAGE); });`
- `e2e-tests/playwright/specs/upgrade/upgrade_swap_to.ts`:
  `setup('swap to to-image', async ({pw}) => { await pw.upgradeServerImage(testConfig.serverImage); });`

**Both `upgrade-swap-from` and `upgrade-swap-to` depend only on `setup` — deliberately not on each
other or on `upgrade-from`.** This is the key correction from an earlier draft of this plan (which
had one project depend on the other to force ordering): Playwright's `dependencies` means "also run
this project's tests first," so chaining `upgrade-swap-to` → `upgrade-from` would make *every*
invocation of `--project=upgrade-to` transitively re-run the entire from-phase again in the same
process — exactly what Part 3's "two separate npm scripts, each running only its own subset" and
Part 4's "separate CI step per phase" both require *not* to happen. Ordering between phases is
enforced purely by **invocation order** (run `--project=upgrade-from` to completion, then
`--project=upgrade-to`, as two separate commands — local or CI), never by Playwright's own
dependency graph.

This also fixes a subtler bug: `upgrade-swap-to`'s test reads `testConfig.serverImage` directly,
re-derived fresh from `SERVER_IMAGE` in whatever process runs it — it does **not** rely on a value
captured earlier by `upgrade-swap-from` or `upgrade-from`, since those may have run in a completely
different OS process (see Part 3). Because mutating `testConfig.serverImage` only changes that
one process's in-memory value, never the env var itself, `testConfig.serverImage` in the fresh
`upgrade-to` process invocation is still just `SERVER_IMAGE`'s original value — exactly the to-image
— with zero extra plumbing needed to "pass" it across the phase boundary.

**E. Local file storage needs a bind mount to survive the swap at all — a real infra fix, not
just a test.** Unlike Postgres (never restarted, so its data is simply untouched) and Minio/Azurite
(separate containers, also never restarted), the Mattermost container *is* the thing recreated on
every swap — and local disk storage lives inside that same container's own writable layer, backed
only by the anonymous volume Docker creates for the Dockerfile's declared
`VOLUME ["/mattermost/data", ...]` (`server/build/Dockerfile:88`). An anonymous volume isn't
reattached to whatever container starts next; `docker rm -f` (`stack.ts:271`) discards it along
with the old container. Today, a file uploaded to local storage before an upgrade is simply gone
after — not a real upgrade bug, but an artifact of the test harness not modeling what a real
deployment looks like (a real customer's data directory is on a persistent disk they'd never wipe
mid-upgrade).

Fix: bind-mount a host directory to `/mattermost/data`. **Put it in the repo, at a fixed path** —
`e2e-tests/playwright/local_storage`, resolved via `path.resolve(process.cwd(), 'local_storage')`
— the exact same pattern `stack.ts` already uses for `ENV_FILE_PATH`/`LOG_DIR`, rather than an
OS temp directory:
- **A fixed, well-known path removes an entire category of plumbing** the earlier
  `os.tmpdir()`/`mkdtempSync` draft needed: since every process resolves the *same* path
  independently, there's no new value to persist through `.env.testcontainers` for a separate
  process (the `test:upgrade:to` npm script; a later CI step) to agree on — it already does, for
  free. It's also far more debuggable: a developer can just `ls e2e-tests/playwright/local_storage`
  after a run instead of hunting through `/tmp`.
- `chmod 0777` immediately after creating it — required, not defensive, independent of *where* the
  directory lives: the image runs as `USER mattermost` (`server/build/Dockerfile:75`), and a bind
  mount keeps the *host* directory's ownership, so a directory owned by whoever ran the CI job or
  `npm run` locally would otherwise make the server's own writes fail outright.
- `mattermost_container.ts`'s builder adds
  `.withBindMounts([{source: LOCAL_STORAGE_DIR, target: '/mattermost/data', mode: 'rw'}])`
  unconditionally — harmless (just an unused empty directory) when a different `FileSettings`
  backend is active.
- **Must be cleared on a genuinely fresh boot, but left alone on adoption.** A fixed path persists
  across completely unrelated runs (yesterday's `npm run test:full`, today's upgrade test), unlike
  a fresh container's own storage, which always starts empty. `stack.ts`'s `startStack()` already
  has exactly the right branch point for this: right where it resets `testConfig.bootEnvOverrides
  = defaultBootEnv()` after `adoptExistingStack()` returns `false` (a real fresh boot, not another
  process's stack), also `fs.rmSync(LOCAL_STORAGE_DIR, {recursive: true, force: true});
  fs.mkdirSync(LOCAL_STORAGE_DIR); fs.chmodSync(LOCAL_STORAGE_DIR, 0o777)`. On adoption, this
  branch never runs — exactly the data we need to keep.
- **No explicit teardown needed** (a simplification from the earlier draft): unlike
  `.env.testcontainers`, leaving `local_storage/` populated after a run is actively useful for
  postmortem (same reasoning `logs/` is already deliberately left behind by `collectLogs`) — a
  developer can inspect exactly what a failed run's local storage looked like. It gets cleared
  automatically at the *next* fresh boot regardless. Needs adding to `.gitignore` (root-level
  "disable files/folders generated by Playwright" section, alongside `storage_state`/`results`)
  and to `package.json`'s `clean` script's `rm -rf` list, matching those same directories.

## Part 3 — Local development: two npm scripts

New scripts in `e2e-tests/playwright/package.json`, mirroring the existing `test:smoke`-style
`--grep`/`--project` pattern already there (`"test:smoke": "... playwright test --grep @smoke
--project=chrome --retries=1"`):

```json
"test:upgrade:from": "npm run build && cross-env PW_USE_TESTCONTAINERS=true PW_TESTCONTAINERS_REUSE=true playwright test --project=upgrade-from",
"test:upgrade:to": "npm run build && cross-env PW_USE_TESTCONTAINERS=true PW_TESTCONTAINERS_REUSE=true playwright test --project=upgrade-to",
```

- **`npm run test:upgrade:from`** — first invocation, fresh process: `setup` has nothing to adopt
  yet, so it boots a brand-new stack on `SERVER_IMAGE` (the to-image, unchanged default);
  `upgrade-swap-from` immediately swaps it down to `PW_UPGRADE_FROM_SERVER_IMAGE`; `upgrade-from`
  runs. `PW_TESTCONTAINERS_REUSE=true` means the process exits without tearing anything down — "keep
  the instances up and running," as required.
- **`npm run test:upgrade:to`** — second invocation, a *separate* fresh process: `setup`'s
  `startStack()` calls `adoptExistingStack()` (`stack.ts:152-170`), finds the still-running
  from-image container via `.env.testcontainers`, and adopts it instead of creating a new one — no
  extra plumbing needed here either, this adoption path already exists for exactly this
  cross-process-reuse scenario. `upgrade-swap-to` then swaps the adopted container up to the
  to-image; `upgrade-to` runs.
- **Both env vars (`SERVER_IMAGE`, `PW_UPGRADE_FROM_SERVER_IMAGE`) only need to be set once**, in a
  local `.env` file — `test_config.ts`'s very first `dotenv.config({quiet: true})` call (before the
  `.env.testcontainers` override load) already loads a plain `.env` unconditionally, so both script
  invocations pick up the same values automatically without repeating flags on the command line.
- **Explicit teardown remains the existing `npm run testcontainers:down`** (`script/testcontainers_down.mjs`)
  — no new teardown script is needed; it already does exactly "find every container carrying the
  Testcontainers label and remove it," independent of which process created them.

**Not in scope for these two scripts**: the full last-3-plus-ESR matrix (Part 4a) is a CI/coverage
concern, not a local inner-loop one — a developer testing locally picks one `PW_UPGRADE_FROM_SERVER_IMAGE`
value at a time via `.env`. Reproducing the full CI matrix locally (e.g. a `test:upgrade:from` that
loops over every resolved version) is a reasonable follow-up if that need comes up, not built here.

## Part 4 — CI integration: inline, next to the existing `setup` step

This **supersedes** an earlier draft of this plan, which proposed a fully separate
`e2e-tests-playwright-upgrade.yml` workflow to avoid running upgrade coverage redundantly across
`playwright-full`'s parallel worker matrix. The current design instead adds steps directly to
the existing per-worker job in `e2e-tests-playwright-template.yml`, immediately after
`ci/prepare-playwright` (`--project=setup`) and before `ci/dispatch-run` — so the same job that
just finished the last swap-up to the to-image immediately continues into the full suite against
that now-upgraded server, with no extra boot/teardown cost.

**4a. The rolling-upgrade requirement is "run against the last 3 versions, plus any still-supported
Extended Support Release (ESR)"** — not a single fixed from-version. Worked example (today
2026-07-27, current version 11.10 per `server/public/model/version.go`'s `versions[0]`): last 3 =
11.9, 11.8, 11.7; of the ESR releases in the [releases table](https://raw.githubusercontent.com/mattermost/mattermost/refs/heads/master/docs/main/product-overview/mattermost-server-releases.mdx)
(currently v11.7, v10.11, v10.5), only v11.7 and v10.11 still have a future "Support ends" date
(v10.5's ended 2025-11-15, already past) — so the resolved matrix is **11.9, 11.8, 11.7, 10.11**
(11.7 satisfies both criteria, counted once).

Two different sources, read two different ways, matching how the user specified each:
- **Current version + last 3**: read `server/public/model/version.go`'s `versions` array **locally
  from the checked-out repo** (`versions[0]` = current, `versions[1..3]` = last 3) — this must
  reflect the exact code on the branch/commit under test, not some external source.
- **Support-end dates + ESR flags**: fetched live from the `mattermost-server-releases.mdx` raw
  URL on `master`, **not** read from the local checkout — support-end dates are an external,
  time-dependent fact (they lapse as calendar time passes) that a possibly-stale feature/PR branch
  checkout shouldn't be trusted to reflect; `master`'s copy is the one kept current.

**4b. New resolver script**: `e2e-tests/playwright/script/resolve_upgrade_matrix.mjs` (same Node/ESM
style as the existing `script/testcontainers_down.mjs`). Algorithm:
1. Parse `versions` out of `../../server/public/model/version.go` (simple regex over the quoted
   string list — no Go parser needed); `current = versions[0]`, `lastThree = versions[1..3]`
   (each reduced to `major.minor`).
2. Fetch the mdx table from the raw URL above; for each row extract: the `major.minor` tag, the
   exact patch version from its `Download` link (e.g. row "v11.7" → patch `11.7.7`), the
   "Support ends" date, and whether that cell contains `[EXTENDED]` (→ ESR).
3. `active = rows.filter(r => r.supportEnds > today)`.
4. `matrix = dedupe(active.filter(r => lastThree.includes(r.minor) || r.isESR))`, each entry's
   **exact patch version** (not just the minor) — the thing that actually needs to map to a
   pullable image tag.
5. Emit the patch-version list as JSON (e.g. via `$GITHUB_OUTPUT`).

**Open detail, not yet resolved**: whether `PW_UPGRADE_FROM_SERVER_IMAGE` should be built from this
exact patch version (`mattermostdevelopment/mattermost-enterprise-edition:11.7.7`) or a floating
release alias (`...:release-11.7`, matching the style already referenced by
`e2e-tests-playwright-template.yml`'s `server_image_aliases` input description) — needs confirming
against what tags actually exist in that registry before implementation.

**4c. Loop, not a second matrix dimension.** Crossing `workers-matrix` (already 0..14) with a
second `from_version` matrix dimension would multiply job count, and — combined with the existing
`if: matrix.worker_index == 0` gating (Part 4 below) — would need every *other* worker's version
of that same job to just no-op, which GitHub Actions matrices don't do cleanly. Instead, worker 0's
job resolves the matrix once and loops over it in shell, inside the same job:

```yaml
- name: ci/prepare-playwright
  working-directory: e2e-tests/playwright
  run: npx playwright test --project=setup
- name: ci/resolve-upgrade-matrix
  id: upgrade-matrix
  if: matrix.worker_index == 0
  working-directory: e2e-tests/playwright
  run: echo "versions=$(node script/resolve_upgrade_matrix.mjs)" >> "$GITHUB_OUTPUT"
- name: ci/upgrade-tests
  if: matrix.worker_index == 0
  working-directory: e2e-tests/playwright
  run: |
    for FROM_VERSION in $(echo '${{ steps.upgrade-matrix.outputs.versions }}' | jq -r '.[]'); do
      echo "::group::Upgrade from ${FROM_VERSION}"
      PW_UPGRADE_FROM_SERVER_IMAGE="mattermostdevelopment/mattermost-enterprise-edition:${FROM_VERSION}" \
        npx playwright test --project=upgrade-from
      npx playwright test --project=upgrade-to
      echo "::endgroup::"
    done
- name: ci/dispatch-run
  # ... unchanged, now runs against the to-image server the last upgrade-to loop iteration produced
```

Each loop iteration reuses the exact same swap-from/run-from/swap-to/run-to sequence from Part 2 —
nothing about the per-version mechanics changes, only that it now runs 4 times (in the worked
example) instead of once. `upgrade-to` doesn't need `PW_UPGRADE_FROM_SERVER_IMAGE` set (its swap
reads `testConfig.serverImage`/`SERVER_IMAGE` directly — Part 2), so it's left off that invocation.

**`if: matrix.worker_index == 0`** remains a deliberate, explicitly-flagged judgment call, not
something requested verbatim: each matrix worker in `playwright-full` runs on its own isolated
runner/VM (confirmed by re-reading `e2e-tests-playwright-template.yml`'s `PW_TESTCONTAINERS_REUSE`
comment — it reuses the stack *within* one worker's own sequence of per-spec dispatch invocations,
not *across* workers), so inserting these steps unconditionally would re-run the entire upgrade
matrix (now 4× the container churn per run, not just 1×) once per worker — pure duplicated cost.
Gating to a single worker avoids that, at the cost of the *entire* rolling-upgrade matrix being
tied to whichever worker happens to be index 0 succeeding.

**New cost to flag explicitly**: worker 0's job now does up to 4× the container-restart churn this
plan originally accounted for (2 restarts per from-version × 4 from-versions = 8 restarts, plus the
initial boot) before it can even start the full dispatch suite — a real, not hypothetical, increase
to that worker's wall-clock time relative to its siblings. Whether that's acceptable, or whether
worker 0 should be excluded from also carrying a full dispatch share to compensate, is an open
question (see Technical Spec §12).

## Verification (once implemented)

- Verify Part 2E's local-storage fix *in isolation*, before anything upgrade-specific: with
  `PW_USE_TESTCONTAINERS=true`, upload a file, call `pw.ensureMinio()` (forces a restart onto a
  different backend) then `pw.ensureLocalFile()` (forces a restart back), and confirm the original
  file is still downloadable — this exercises the exact same bind-mount fix without needing any
  upgrade project/spec to exist yet.
- Run locally: `npm run test:upgrade:from` (leaves the stack up on the from-image), then
  `npm run test:upgrade:to` in a fresh terminal (adopts it, swaps up, runs to-phase tests), then
  `npm run testcontainers:down` to clean up.
- Confirm `logs/testcontainers_env_history.log` shows three boot env blocks across the two
  invocations (initial boot on the to-image, swap down to the from-image, swap back up to the
  to-image) with the expected resolved image/version at each step.
- Confirm `npm run test:upgrade:to` genuinely adopts (log line "adopting already-running server")
  rather than starting a second, independent stack.
- Confirm the tag-based selection is correct: `npx playwright test --project=upgrade-from --list`
  shows exactly the dedicated `specs/upgrade/from/**` specs plus `@upgrade`-tagged common specs,
  and none of `specs/upgrade/to/**`.
- Confirm the spec fails loudly (not silently passes) if `PW_UPGRADE_FROM_SERVER_IMAGE` is left
  equal to `SERVER_IMAGE`, to prove the assertions are actually discriminating pre/post state
  rather than trivially true.
- Run `node script/resolve_upgrade_matrix.mjs` standalone and confirm it outputs `["11.9.0",
  "11.8.4", "11.7.7", "10.11.22"]` (or whatever the current real equivalents are) matching the
  worked example, before ever wiring it into CI.
- In CI, confirm the resolve + loop steps run only on `matrix.worker_index == 0`, that the loop
  executes once per resolved version, and that the full dispatch suite that follows in the same
  job runs against the already-upgraded (to-image) server without a redundant restart.

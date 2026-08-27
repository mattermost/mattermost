# Technical Spec: Server Upgrade Testing via Playwright + Testcontainers

Status: Draft — for review. Companion to `UPGRADE_TEST_PLAN.md` (the design summary this expands).

## 1. Summary

Add a two-phase test flow that boots a Mattermost server at an older version against a real
Postgres database, runs a from-phase test subset, swaps the running server to a newer version's
image **in place, against the same database**, and runs a to-phase test subset that verifies the
upgrade succeeded — migrations completed, prior data is intact, core functionality still works.
Each phase is independently invokable — as its own local npm script (leaving the stack running in
between) or its own CI step (inline with the existing per-worker job) — rather than one monolithic
test. In CI, this runs not against one fixed older version but a **rolling-upgrade matrix**:
whichever versions the project's own support policy currently requires (the last 3 minor releases,
plus any release still within its Extended Support window), resolved at run time from
`server/public/model/version.go` and the published releases table — never hardcoded. Ships as: one
library helper, four Playwright projects (two "swap" + two "run"), a folder/tag convention for
phase-specific vs. common test selection, two npm scripts, one matrix-resolution script, and new
inline steps in the existing CI template.

## 2. Goals / Non-Goals

**Goals**
- Detect upgrade-time regressions before they reach users: failed/incomplete migrations, data
  loss, config incompatibility, functional breakage introduced by the version bump.
- Reuse the existing Testcontainers harness (`e2e-tests/playwright/lib/src/containers/`) as-is —
  no new container lifecycle primitives.
- Support both a fast local dev loop (two independent npm scripts, stack left running between
  them for inspection) and CI, from the exact same project/dependency graph — no divergent logic
  between the two invocation contexts.
- In CI, automatically track the project's own support policy (last 3 minors + active ESR) rather
  than a version pinned by hand — the matrix should stay correct as new releases ship and old ones
  lapse out of support, with no manual update to a workflow file required.

**Non-Goals (this iteration)**
- Downgrade testing (Mattermost does not support DB downgrades — one-directional only).
- Multi-hop upgrade chains (e.g. v1 → v2 → v3 in one run). Start with a single from/to hop;
  revisit chaining once single-hop is proven reliable.
- Search index re-indexing behavior across versions (flagged as a stretch item, not validated here).
- Automatic wiring to the existing `Setup Upgrade Test Server` PR label — that label's current
  handler lives outside this repo and its integration contract is unknown; out of scope until
  investigated separately.

## 3. Background

Confirmed by direct code reading (see `UPGRADE_TEST_PLAN.md` Context for full citations):

- No existing test in the repo boots two different server versions against the same live
  database. Closest prior art (`server/scripts/psql-migration-test.sh`) diffs schema dumps via the
  CLI migrator, not a running server.
- `e2e-tests/playwright/lib/src/containers/mattermost_container.ts:79` builds the server container
  from `testConfig.serverImage`, a mutable singleton field re-read on every call — not fixed at
  first boot.
- `stack.ts`'s `restartMattermostContainer(env)` (`stack.ts:257-286`) already implements "stop the
  Mattermost container, start a fresh one on the same network," used today by
  `ensureFeatureFlag`/`ensureLocalFile`/etc. Postgres is never touched by this path, so its data
  (no volume — lives in the container's writable layer, `postgres_container.ts`) persists across
  the swap.
- `mattermost_container.ts` is already wrapped in `startWithRetry('server', ...)`
  (`retry.ts`) from the earlier CI-flakiness fix — so an upgrade's new-image pull/build
  transparently gets the same bounded retry-with-backoff as every other container start. No
  additional retry logic is needed for the upgrade path itself.

## 4. Terminology

| Term | Meaning |
|---|---|
| To-image | The server image/tag under test — `SERVER_IMAGE`, already the default every other project boots the initial stack against. |
| From-image | The older server image/tag the upgrade starts from — `PW_UPGRADE_FROM_SERVER_IMAGE`, only read by the swap-from spec. |
| Swap project | A one-test Playwright project (same shape as `setup`'s own spec files) whose only job is calling `upgradeServerImage()`. Two exist: `upgrade-swap-from`, `upgrade-swap-to`. |
| Run project | A Playwright project that executes a phase's actual test subset, selected by tag. Two exist: `upgrade-from`, `upgrade-to`. |
| Common test | An existing functional spec, living in its normal folder, tagged `@upgrade` so it runs in *both* phases. |
| Dedicated test | A spec that only makes sense in one phase, physically placed under `specs/upgrade/from/` or `specs/upgrade/to/` and tagged `@upgrade-from`/`@upgrade-to` accordingly. |
| Upgrade | Stopping the from-image container and starting the to-image container on the same network, same Postgres, same data. |

`SERVER_IMAGE` deliberately stays the *to*-image, not the *from*-image: it's the one value every
other project (`chrome`/`firefox`/`ipad`) already boots against, so keeping its meaning
unchanged means the upgrade test always upgrades to whatever version the rest of the run is
already testing, with no special-casing anywhere outside the upgrade projects themselves.

## 5. Architecture

Two independent phases, each its own swap-then-run pair, invoked as **separate commands** (npm
scripts locally, separate `run:` steps in CI) — never as one combined test or one Playwright
invocation covering both phases:

```
Phase 1 — "from"                              Phase 2 — "to" (separate invocation/process)
─────────────────────────────                 ─────────────────────────────────────────────
setup                                          setup
 (startStack: fresh boot on                     (startStack → adoptExistingStack() finds the
  SERVER_IMAGE, the to-image —                   still-running container via .env.testcontainers
  nothing to adopt yet, first run)               written by Phase 1 — adopts, no new container)
  │                                               │
  ▼                                               ▼
upgrade-swap-from                              upgrade-swap-to
 (pw.upgradeServerImage(                        (pw.upgradeServerImage(testConfig.serverImage) —
   process.env.PW_UPGRADE_FROM_SERVER_IMAGE))     re-derived fresh from SERVER_IMAGE in THIS
  │  restartMattermostContainer: docker rm -f     process, since the mutation from Phase 1 was
  │  the to-image container, start a fresh         only ever in-memory in Phase 1's own process)
  │  from-image container — same network,         │  same restart mechanics, swapping the
  │  same Postgres, same data                      │  from-image container back to to-image
  ▼                                               ▼
upgrade-from                                   upgrade-to
 (testDir: specs, grep: /@upgrade-from|         (testDir: specs, grep: /@upgrade-to|@upgrade/)
  @upgrade/)                                     — asserts version changed back, pre-upgrade
 — dedicated specs/upgrade/from/** +              data intact, functional smoke passes
   @upgrade-tagged common specs, run
   against the from-image
```

Nothing new is introduced at the container-lifecycle layer — both swaps are the same restart with
a different `testConfig.serverImage` value, executed through machinery that already exists and is
already used by five other `ensure*()` helpers. What *is* new is treating the two phases as
genuinely separate invocations (not one test, not one process) so each can be run independently —
locally via its own npm script leaving the stack up in between, or in CI as two discrete steps —
relying on `adoptExistingStack()` (`stack.ts:152-170`) to bridge Phase 1 and Phase 2 across that
process boundary.

## 6. Detailed Design

### 6.1 `upgradeServerImage()` helper

New file: `e2e-tests/playwright/lib/src/server/version.ts`

```ts
import {restartMattermostContainer} from '../containers/stack';

import {testConfig} from '@/test_config';

/**
 * Swaps the running Testcontainers-managed Mattermost server to `image`, keeping the same
 * network and Postgres database — i.e. an in-place upgrade (or downgrade) test scenario.
 */
export async function upgradeServerImage(image: string, extraEnv: Record<string, string> = {}): Promise<void> {
    if (!testConfig.useTestContainers) {
        throw new Error('upgradeServerImage requires PW_USE_TESTCONTAINERS=true.');
    }
    testConfig.serverImage = image;
    await restartMattermostContainer(extraEnv);
}
```

**Contract:**
- Precondition: a stack must already be running (`testConfig.useTestContainers` and
  `restartMattermostContainer`'s own preconditions — `mattermostContainerId` and
  `testcontainersNetworkName` set, per `stack.ts:261-265`).
- Throws (does not skip) on precondition failure or on exhausting `startWithRetry`'s attempts —
  unlike `ensureFeatureFlag`'s `test.skip(...)` pattern. Rationale: for every other `ensure*()`
  helper, the version/flag/service is an incidental *precondition* for an unrelated test, so a
  skip is correct. For the upgrade spec, the upgrade **is** the thing under test — failure must
  fail the test, not silently skip it.
- Side effects inherited from `restartMattermostContainer` for free: extends the Playwright test
  timeout to ≥4 min (`extendTimeoutForRestart`), clears the cached API client
  (`clearClientCache`), and appends a labeled snapshot to `.env.testcontainers` /
  `logs/testcontainers_env_history.log` recording the transition.

**Wiring** (mirrors `ensureFeatureFlag`/`ensureLocalFile` exactly):
`server/version.ts` → exported from `lib/src/server/index.ts` → re-exported from `lib/src/index.ts`
→ imported and assigned in `lib/src/test_fixture.ts`'s `ExtendedFixtures` class, so specs call
`pw.upgradeServerImage(...)`.

### 6.2 Configuration surface

| Variable | Read by | Purpose | New? |
|---|---|---|---|
| `SERVER_IMAGE` | `test_config.ts:159` | To-image; boots the initial stack, same as every other project | No — reused as-is |
| `PW_UPGRADE_FROM_SERVER_IMAGE` | `upgrade_swap_from.ts` directly via `process.env` | From-image | Yes |

`PW_UPGRADE_FROM_SERVER_IMAGE` is deliberately **not** added to the centralized `TestConfig` class
in `test_config.ts` — it's only meaningful inside the swap-from spec, matching the existing
convention where `ELASTICSEARCH_VERSION`/`OPENSEARCH_VERSION` are read directly via `process.env`
inside their respective container files rather than added to the global config surface
(`elasticsearch_container.ts:19`).

### 6.3 Folder + tag convention

Selection is entirely **tag**-driven; folders are for ownership/discoverability only. This is a
real Playwright constraint, not a style preference: `grep` filters *titles* within whatever
`testDir`/`testMatch` already discovered — it can't reach outside that file set. To let one
project's selection span both a dedicated folder and arbitrary common specs elsewhere, `testDir`
must stay the full `specs/` tree for every upgrade project, with tags as the only filter. The
practical consequence: dedicated-folder specs still need their own tag; folder placement alone
does not select them.

| Location | Tag | Runs in |
|---|---|---|
| `specs/upgrade/from/**` (new, dedicated) | `@upgrade-from` | from-phase only |
| `specs/upgrade/to/**` (new, dedicated) | `@upgrade-to` | to-phase only |
| Existing functional specs, wherever they already live | `@upgrade` | both phases |

Tagging uses the existing `{tag: [...]}` test option convention already used throughout `specs/`
(e.g. `specs/functional/system_console/permissions/team_access.spec.ts:11`'s
`{tag: ['@smoke', '@system_console']}`) — no new tagging mechanism.

### 6.4 Swap specs

Two new one-test files, mirroring `specs/test_setup.ts`'s own shape exactly:

`e2e-tests/playwright/specs/upgrade/upgrade_swap_from.ts`:
```ts
import {test as setup} from '@mattermost/playwright-lib';

setup('swap to from-image', async ({pw}) => {
    await pw.upgradeServerImage(process.env.PW_UPGRADE_FROM_SERVER_IMAGE);
});
```

`e2e-tests/playwright/specs/upgrade/upgrade_swap_to.ts`:
```ts
import {test as setup, testConfig} from '@mattermost/playwright-lib';

setup('swap to to-image', async ({pw}) => {
    await pw.upgradeServerImage(testConfig.serverImage);
});
```

`upgrade_swap_to.ts` reads `testConfig.serverImage` **directly**, not a value captured by an
earlier spec — see §6.5's dependency-graph note for why that's required, not just simpler.

### 6.5 Playwright project config

`playwright.config.ts:53`, four new entries in the existing `projects` array:

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

**Both swap projects depend only on `setup` — never on each other or on `upgrade-from`.** An
earlier draft of this design had `upgrade-swap-to` depend on `upgrade-from`, reasoning that this
would enforce "from runs before to." That's wrong: Playwright's `dependencies` means "also run this
project's tests first," so that edge would make *every* invocation of `--project=upgrade-to`
transitively re-run all of `upgrade-from`'s tests again in the same process — directly breaking the
"two independently-invokable phases" goal (§2). Ordering between phases is enforced purely by
**invocation order** — run `--project=upgrade-from` to completion as one command, then
`--project=upgrade-to` as a separate command, whether that's two npm scripts (§6.6) or two CI steps
(§6.7) — never by Playwright's own dependency graph.

This is also why `upgrade_swap_to.ts` reads `testConfig.serverImage` directly instead of receiving
a value from `upgrade_swap_from.ts`: the two may run in genuinely different OS processes (always
true for the npm-script split; also true in CI, since each `run:` step is its own process). Mutating
`testConfig.serverImage` only changes that one process's in-memory value — never the env var — so a
fresh process's `testConfig.serverImage` is simply `SERVER_IMAGE`'s original value again, with zero
cross-process plumbing needed.

`workers: 1` + `fullyParallel: false` on both run projects is required, not optional: each mutates
the shared `testConfig.serverImage` singleton for the remainder of *its own* process, so it must
never run concurrently with, or before, other specs in that same process that assume a particular
image.

### 6.6 npm scripts (local development)

New scripts in `e2e-tests/playwright/package.json`, matching the existing `test:smoke`-style
`--grep`/`--project` pattern already there:

```json
"test:upgrade:from": "npm run build && cross-env PW_USE_TESTCONTAINERS=true PW_TESTCONTAINERS_REUSE=true playwright test --project=upgrade-from",
"test:upgrade:to": "npm run build && cross-env PW_USE_TESTCONTAINERS=true PW_TESTCONTAINERS_REUSE=true playwright test --project=upgrade-to",
```

`SERVER_IMAGE` and `PW_UPGRADE_FROM_SERVER_IMAGE` aren't baked into the scripts — `test_config.ts`'s
first `dotenv.config({quiet: true})` call (line 9, before the `.env.testcontainers` override load
at line 10) already loads a plain `.env` file unconditionally, so a developer sets both once there
and both script invocations pick them up automatically.

- `npm run test:upgrade:from`: first invocation — `setup` has nothing to adopt, boots fresh on the
  to-image; `upgrade-swap-from` swaps down; `upgrade-from` runs. `PW_TESTCONTAINERS_REUSE=true`
  means the process exits without tearing down anything — the explicit "keep the instances up and
  running" requirement.
- `npm run test:upgrade:to`: a *separate* fresh process — `setup`'s `startStack()` calls
  `adoptExistingStack()` (`stack.ts:152-170`), finds the still-running from-image container via
  `.env.testcontainers`, adopts it (no new container); `upgrade-swap-to` swaps it up; `upgrade-to`
  runs.
- Explicit cleanup remains the existing `npm run testcontainers:down` (`script/testcontainers_down.mjs`)
  — no new teardown script needed; it already removes every container by Testcontainers label,
  independent of which process created them.

### 6.7 CI integration (inline, not a separate workflow)

**Supersedes an earlier draft of this spec**, which proposed a standalone
`e2e-tests-playwright-upgrade.yml` workflow specifically to avoid duplicating upgrade coverage
across `playwright-full`'s parallel worker matrix. The current design instead adds steps directly
into the existing per-worker job in `e2e-tests-playwright-template.yml`, right after
`ci/prepare-playwright` (`--project=setup`) and before `ci/dispatch-run` — so the same job that just
finished the last swap-up to the to-image immediately continues into the full dispatch suite against
that now-upgraded server, at zero extra boot/teardown cost.

The from-side is not one fixed version — it's the **rolling-upgrade matrix** §6.8 resolves — so
this can't be two static steps; it's a resolve step followed by a shell loop over however many
versions that resolves to (4, in the worked example in §6.8):

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
  # ... unchanged — now runs against the to-image server the LAST loop iteration produced
```

A GitHub Actions matrix dimension for `from_version` (crossed with the existing `workers-matrix`)
was considered and rejected: combined with `if: matrix.worker_index == 0`, every *other* worker's
copy of that dimension would need to just no-op, which matrices don't do cleanly, and a proper
matrix job would re-pay `ci/prepare-playwright`'s full boot cost once per from-version instead of
once total. A shell loop inside worker 0's existing job avoids both.

`upgrade-to` doesn't need `PW_UPGRADE_FROM_SERVER_IMAGE` — its swap spec reads
`testConfig.serverImage`/`SERVER_IMAGE` directly (§6.4) — so it's left off that invocation
deliberately, not an oversight.

**`if: matrix.worker_index == 0` is a deliberate, explicitly-flagged judgment call**, not something
the design requires by necessity: each matrix worker runs on its own isolated runner/VM (the
existing `PW_TESTCONTAINERS_REUSE` comment in the template confirms reuse is *within* one worker's
sequence of per-spec dispatch invocations, not *across* workers), so unconditional insertion would
re-run the *entire rolling-upgrade matrix* once per worker — now 4× the container churn, not 1×,
per `playwright-full`'s `workers: 15` → up to 60× duplicated container restarts for identical
coverage if ungated. Gating to a single worker avoids that, at the cost of tying all rolling-upgrade
coverage to whichever worker happens to be index 0, and of that one worker now carrying
meaningfully more wall-clock time than its siblings (§8).

### 6.8 Rolling-upgrade matrix resolution

New file: `e2e-tests/playwright/script/resolve_upgrade_matrix.mjs` (same Node/ESM style as the
existing `script/testcontainers_down.mjs`).

**Requirement** (verified against real data on 2026-07-27): the from-version matrix is the union of
(a) the last 3 minor releases before the current version, and (b) any release still within its
Extended Support (ESR) window — each side independently filtered to releases whose support hasn't
already lapsed. Worked example: current version `11.10` (per `version.go`) → last 3 = `11.9`,
`11.8`, `11.7`; of the table's three ESR-marked rows (`v11.7`, `v10.11`, `v10.5`), only `v11.7`
(support ends 2027-05-15) and `v10.11` (2026-08-15) are still active — `v10.5` lapsed 2025-11-15.
Union, deduplicated (`11.7` satisfies both criteria): **`11.9`, `11.8`, `11.7`, `10.11`**.

**Two sources, deliberately read two different ways:**
- **`server/public/model/version.go`** — read from the **local checkout**, not fetched. This file
  is the source of truth for what version the code on this exact branch/commit *is*; a resolver
  that read it from `master` instead could disagree with the branch actually under test.
- **`docs/main/product-overview/mattermost-server-releases.mdx`** — fetched live from
  `https://raw.githubusercontent.com/mattermost/mattermost/refs/heads/master/docs/main/product-overview/mattermost-server-releases.mdx`,
  **not** read from the local checkout. Support-end dates and ESR status are external, calendar-
  time-dependent facts (a release can lapse out of support without any code change at all) — only
  `master`'s copy is guaranteed current; a stale feature/PR branch checkout of the same file could
  be wrong in either direction (missing a recent release, or not yet reflecting a lapsed one).

**Algorithm:**
1. Regex-parse the `versions = []string{...}` block in `version.go` (no Go parser needed — it's a
   flat quoted-string list, most-recent-first per its own doc comment). `current = versions[0]`;
   `lastThree = versions.slice(1, 4)`, each reduced to `major.minor`.
2. `fetch()` the mdx; for each table row, extract via regex: the `major.minor` tag (`v11.7` →
   `11.7`), the exact patch version from its `Download` link (e.g.
   `https://releases.mattermost.com/11.7.7/...` → `11.7.7`), the "Support ends" cell's date, and
   whether that cell contains `[EXTENDED]` (→ ESR).
3. `active = rows.filter(r => r.supportEnds > new Date())`.
4. `matrix = dedupeByMinor(active.filter(r => lastThree.includes(r.minor) || r.isESR))`, mapped to
   each row's **exact patch version** — an image tag needs the full version, not just `11.7`.
5. Print the patch-version list as a JSON array to stdout (consumed via `$GITHUB_OUTPUT` in §6.7).

**Open detail, not yet resolved**: whether the resulting `PW_UPGRADE_FROM_SERVER_IMAGE` should use
the exact patch tag (`...:11.7.7`) or a floating release alias (`...:release-11.7`, matching the
style `e2e-tests-playwright-template.yml`'s `server_image_aliases` input already documents) —
depends on which tags actually exist in the `mattermostdevelopment/mattermost-enterprise-edition`
registry; needs confirming before implementation, not assumed here.

**Network dependency risk**: step 2 makes CI's upgrade coverage depend on a live, unauthenticated
fetch to raw.githubusercontent.com succeeding. Unlike everything else in this design (which only
depends on infrastructure already required — Docker, the existing registry), this is a genuinely
new external dependency purely for computing *which* versions to test. If it fails or times out,
the resolver should fail loudly (non-zero exit, clear error) rather than silently falling back to
an empty or stale matrix — see §8.

### 6.9 Local file storage: a real infra fix, not just a test

Data integrity coverage (§7 items 3/3a-c) needs to hold across **three different backends**, each
persisting across the Mattermost-container swap through a fundamentally different mechanism:

| Backend | Where the data lives | Survives `restartMattermostContainer`'s `docker rm -f`? |
|---|---|---|
| Postgres | The Postgres container's own writable layer | Yes — Postgres itself is never restarted |
| Minio (S3) | The Minio container's own writable layer | Yes — separate container, never restarted |
| Azurite (Blob) | The Azurite container's own writable layer | Yes — separate container, never restarted |
| Local disk (default) | `/mattermost/data` **inside the Mattermost container itself** | **No** |

Local disk is the one backend that lives inside the exact container being recreated on every
swap. `server/build/Dockerfile:88` declares `VOLUME ["/mattermost/data", ...]`, but
`mattermost_container.ts` never bind-mounts anything to it — so Docker creates an anonymous volume
per container, which is *not* reattached to whatever container starts next; `stack.ts:271`'s
`docker rm -f` discards it along with the old container. A file uploaded to local storage before
an upgrade is, today, simply gone after. This is not a real server upgrade bug — it's the test
harness failing to model what a real deployment looks like (a customer's data directory sits on a
persistent disk they'd never wipe mid-upgrade) — but until it's fixed, §7's U6 (file attachment
survives the upgrade) is unwriteable as anything other than a test that's guaranteed to fail.

**Fix — bind-mount a host directory that outlives any single container. Put it in the repo, at a
fixed path, not an OS temp directory:**

1. `stack.ts`: a new constant `LOCAL_STORAGE_DIR = path.resolve(process.cwd(), 'local_storage')`
   — the exact same pattern already used for `ENV_FILE_PATH`/`LOG_DIR` in that file. A **fixed**,
   well-known path is a deliberate improvement over an `os.tmpdir()`/`mkdtempSync()` draft
   considered earlier: since every process resolves the identical path independently, there is
   *no new value to persist* through `.env.testcontainers` for a separate process (the
   `test:upgrade:to` npm script; a later CI loop iteration) to agree on — it already agrees, for
   free, removing an entire category of cross-process plumbing the temp-dir approach needed. It's
   also far more debuggable: `ls e2e-tests/playwright/local_storage` after a run, instead of
   hunting through `/tmp`.
2. `mattermost_container.ts`'s builder: add
   ```ts
   .withBindMounts([{source: LOCAL_STORAGE_DIR, target: '/mattermost/data', mode: 'rw'}])
   ```
   unconditionally — harmless when a different `FileSettings` backend is active (just an unused
   empty directory), and needed on *every* `startMattermostContainer()` call (initial boot **and**
   every subsequent `restartMattermostContainer()` swap) for the mount to actually persist data
   across them.
3. **Cleared on a genuinely fresh boot; left alone on adoption.** Unlike a fresh container's own
   storage (always empty), a fixed repo-relative path persists across *unrelated* runs too
   (yesterday's `npm run test:full`, today's upgrade test) unless explicitly reset. `stack.ts`'s
   `startStack()` already has the right branch for this — right where it resets
   `testConfig.bootEnvOverrides = defaultBootEnv()` immediately after `adoptExistingStack()`
   returns `false` (a genuinely fresh boot, not adopting another process's stack):
   ```ts
   fs.rmSync(LOCAL_STORAGE_DIR, {recursive: true, force: true});
   fs.mkdirSync(LOCAL_STORAGE_DIR);
   fs.chmodSync(LOCAL_STORAGE_DIR, 0o777);
   ```
   The `chmodSync` is required, not defensive, independent of *where* the directory lives: the
   image runs as `USER mattermost` (`server/build/Dockerfile:75`, uid 2000 per its
   `--chown=2000:2000` copy steps), and Docker bind mounts keep the *host* directory's ownership
   inside the container — a directory owned by whoever ran the CI job or `npm run` locally would
   otherwise make the server's own writes to `/mattermost/data` fail with a permission error,
   breaking local storage entirely rather than just failing to persist it across the swap.
   World-writable is acceptable here since this is an ephemeral, single-purpose test directory,
   not a real deployment's data volume. On adoption, this branch never runs — exactly the data the
   fix exists to keep.
4. **No explicit teardown step needed** — a simplification versus the temp-dir draft, which would
   have leaked host directories without one. Leaving `local_storage/` populated after a run is
   *useful*, not a leak: same reasoning `logs/` is already deliberately left behind by
   `collectLogs()` for postmortem — a developer can inspect exactly what a failed run's local
   storage looked like. It gets reset automatically at the next fresh boot (step 3) regardless.
   Needs adding to the root `.gitignore`'s "disable files/folders generated by Playwright" section
   (alongside `e2e-tests/playwright/storage_state`/`results`) and to `package.json`'s `clean`
   script's `rm -rf` list, matching those same directories.

**Optional, mirroring Minio/Azurite's independent-of-API verification**: with a well-known path
always available, a `listLocalStorageFiles()` helper (`fs.readdirSync(LOCAL_STORAGE_DIR, {recursive: true})`)
could give local storage the same "confirm the backend itself has the file, not just that the API
says so" check `listMinioObjectKeys()`/`listAzuriteBlobNames()` already provide — a defensive
secondary signal for §7's U6, not the primary one (§7 reframes the primary signal as UI-driven).

### 6.10 New page objects required for end-to-end coverage

**Course correction**: an end-to-end test's pass/fail signal has to be "what a real user or admin
would see," through `pw.testBrowser`/page objects — not `adminClient.getPost(id)`. A survey of
`lib/src/ui/` found several journeys §7 needs have no existing page object at all; building these
is now part of this feature's scope, not a documentation exercise:

| Gap | What exists today | What's missing |
|---|---|---|
| About modal (version/build string) | `Footer.aboutLink` locator exists, unused by any spec | No page object opens the modal or reads its version text — needs building from scratch |
| Profile photo | Nothing — `ProfileModal` only handles name/username; `profilePicture` in the admin Users table is verify-only (no upload) | Upload helper + a "does this avatar render correctly here" assertion (post header, thread footer, profile popover) |
| Post-send file attachment rendering | `PostCreate`'s `waitUntilFilePreviewContains()` verifies the *compose-time* preview only | No helper verifies the *sent* post's attachment thumbnail/link renders and downloads — this is the piece that actually exercises §6.9's bind-mount fix |
| System Console version display | `EditionAndLicense` only asserts a heading is visible | Needs extending to expose/assert an actual version string, if System Console shows one at all (unconfirmed) |
| Plugin upload/enable | `PluginManagement` has `pluginRow()`/`removePlugin()` (verify-absence and removal only) | No upload or enable method exists — needed for §7 A2 |
| Server Logs content | Only a sidebar nav link (`SystemConsoleSidebar.reporting.serverLogs`, click/isActive) | No page object reads log content — and it's unconfirmed whether this view even shows *historical* lines vs. only live-tailing from whenever it's opened (§8) |
| DB/schema health | Confirmed absent — no product UI surface for this exists at all | Not buildable as a UI page object; closest available is `mmctl` via the already-existing `runMmctl()` (`mmctl_container.ts`) |

Everything else §7 needs (posting in public/private/DM/GM, search, System Console shell
navigation) already has a working page object — `ChannelsPage`, `DirectChannelsModal`, `SearchBox`/
`SearchResultsPanel`, `SystemConsolePage` — and needs no new code, just new specs that call them
across the swap.

## 7. Test coverage matrix — end-to-end, through the actual UI

Reframed from an earlier draft that verified "data survives" via `adminClient.getPost(id)` — that
proves the database survived, not that a person using the product would notice anything was fine.
Two persistent actors, established once in the from-phase and reused unchanged in the to-phase: a
regular user (from `pw.initSetup()`) and the admin (`testConfig.adminUsername`, already fixed for
the whole run). Full detail in `UPGRADE_TEST_PLAN.md`'s Part 1; condensed here:

| # | Journey | Phase | Page object |
|---|---|---|---|
| U1-U4 | Post in public / private / DM / GM, re-check same message visible post-upgrade | MVP | `ChannelsPage`, `DirectChannelsModal` — exist |
| U5 | Upload profile photo, re-check avatar renders post-upgrade | MVP | **Needs building** (§6.10) |
| U6 | Post with file attachment, re-check it renders/downloads post-upgrade | MVP, **blocked on §6.9's bind-mount fix** | Upload exists; **post-send verification needs building** (§6.10) — this is what exercises local/Minio/Azurite storage integrity now, not a standalone API spec |
| U7 | Search for content, re-check same result found post-upgrade | MVP | `SearchBox`/`SearchResultsPanel` — exist |
| U8 | About modal version string, before vs. after | MVP | **Needs building** (§6.10) — the most direct "did the swap actually take effect" signal a person would check |
| A1 | About modal + System Console "Edition and License," before vs. after | MVP | Channels: same as U8. System Console: needs extending (§6.10) |
| A2 | Upload a plugin, re-check still listed/enabled post-upgrade | MVP (promoted from "stretch" — explicitly requested) | **Needs building** (§6.10); verify-absence already exists |
| A3 | U1-U7, admin's own session | MVP | Reuses user journey's page objects |
| A4 | Migration completion, "as an admin would check it" | MVP, **unconfirmed UI feasibility** | See §8 — Server Logs viewer's historical-vs-live behavior is unknown; container-log check (`Wait.forLogMessage`) remains the real fallback |
| A5 | Migration schema, "as an admin would check it" | MVP, **no UI surface exists** | Closest available is `mmctl` (§6.10), not a true UI journey |
| — | Config compatibility (deprecated/renamed settings still load) | Stretch | Unchanged from earlier draft |
| — | Search index compatibility (Elasticsearch/OpenSearch) | Stretch | Unchanged — index/mapping compatibility across versions, flag rather than assume |
| — | Downgrade | Explicitly out of scope | Mattermost doesn't support DB downgrades |

## 8. Failure modes & risk

- **No blue/green swap — a window with no server running, twice per run.** `restartMattermostContainer`
  (`stack.ts:271`) does `docker rm -f <old container>` **before** starting the new one. Because
  this design does two swaps (down to from-image, then back up to to-image — §5), this exposure
  happens twice, not once. If either container then fails to start (bad image, migration panic,
  exhausted retries in `startWithRetry`), the previous container is already gone — the test
  correctly fails, but there is no fallback server to inspect interactively without re-running.
  Mitigation for now: rely on `logs/testcontainers_env_history.log` (via `appendEnvFile`) and
  per-container logs (`collectLogs`) captured on teardown for postmortem; a true blue/green swap
  (start new before removing old, verify healthy, then remove old) is a larger change to
  `restartMattermostContainer` itself and is deferred — call out explicitly as a known limitation,
  not silently accepted.
- **Retry masks a slow-but-real migration failure as a timeout.** `startWithRetry`'s 3 attempts
  (`retry.ts`) apply uniformly to every container, including this one; a migration that
  legitimately takes longer than `withStartupTimeout(5 * 60_000)` looks identical to a transient
  network failure in the logs. Not a blocker, but worth a comment at the call site if this proves
  noisy in practice.
- **Version singleton leakage.** `testConfig.serverImage` is process-global; if `upgrade-from` or
  `upgrade-to` is ever run in the same Playwright invocation as other run projects without
  `workers: 1`, later specs in that same process could silently observe the wrong image. Guarded by
  §6.5's project config, but worth a regression check (see §10).
- **License compatibility across versions.** `structuralEnv()` in `mattermost_container.ts`
  passes `MM_LICENSE` straight through if set; an enterprise license valid for the to-image version
  should also be valid for the from-image version for this to work without a config change
  mid-test — not expected to be an issue for adjacent versions, but flag if testing across a major
  license-boundary version.
- **Single-worker CI gating (§6.7) means upgrade coverage can silently go dark.** `if:
  matrix.worker_index == 0` avoids N×-duplicated cost, but also means upgrade coverage runs exactly
  once per CI run, tied to one specific worker slot. If that worker fails for an unrelated
  infra reason (e.g. a runner provisioning flake) before reaching these steps, or if the matrix
  size/indexing ever changes, upgrade coverage silently doesn't run that day with no distinct
  "upgrade tests were skipped" signal separate from "worker 0 had a bad day." Worth a dedicated
  status check or alert if this coverage is meant to actually gate anything, not just inform.
- **Dedicated-folder specs missing their tag are silently excluded, not an error.** Because
  selection is tag-only (§6.3), a spec added under `specs/upgrade/from/` without the
  `@upgrade-from` tag simply never runs in the `upgrade-from` project — no failure, no warning,
  just quietly absent from coverage. Same failure mode for a common spec elsewhere missing
  `@upgrade`. Worth a lint rule or CI check (e.g. every file under `specs/upgrade/**` must contain
  its phase tag) before relying on folder placement as a proxy for "this is covered."
- **New external dependency: a live fetch to raw.githubusercontent.com (§6.8).** Every other piece
  of this design depends only on infrastructure the run already needs (Docker, the existing image
  registry). The matrix resolver adds a new one, purely to decide *which* versions to test — if
  GitHub is unreachable or the mdx's table format changes shape, the resolver must fail loudly
  (non-zero exit) rather than silently emitting an empty or stale matrix that quietly skips
  rolling-upgrade coverage for that run.
- **Worker 0's wall-clock cost is no longer a fixed, small overhead.** Earlier drafts of this design
  budgeted one swap-down + one swap-up (two container restarts) before the full dispatch suite
  starts. With the rolling-upgrade matrix, that's now 2 restarts × N resolved versions (4 in the
  worked example → 8 restarts, each a fresh Mattermost container boot with its own migration wait)
  before worker 0 even reaches `ci/dispatch-run`. Whether worker 0 should then also carry a smaller
  share of the full dispatch queue to compensate, or whether this cost is simply accepted, is open
  (§12).
- **Postgres accumulates state across every loop iteration, never reset.** Each `upgrade-from` run
  (4 times, in the worked example) calls `pw.initSetup()` again against the *same* long-lived
  Postgres container (§5) — existing `pw.initSetup()`/`getRandomId()` conventions already randomize
  team/user names, so collisions across iterations are unlikely, but the database still grows
  monotonically larger across all 4 from-versions' worth of baseline data by the time
  `ci/dispatch-run` starts. Not expected to break anything, but worth confirming it doesn't skew
  timing-sensitive assertions elsewhere in the full suite that follows in the same job.
- **Image tag scheme unconfirmed (§6.8).** The resolver assumes a per-patch-version tag
  (`...:11.7.7`) exists in the registry `SERVER_IMAGE` already pulls from; if the actual convention
  is a floating alias (`...:release-11.7`) instead, `PW_UPGRADE_FROM_SERVER_IMAGE` construction in
  §6.7 needs to change accordingly before this can work at all in CI.
- **The local-storage bind mount (§6.9) accumulates disk usage across the rolling-upgrade loop,
  never cleaned between iterations.** Every `upgrade-from` run in §6.7's loop (4 in the worked
  example) uploads at least one file to the same host-mounted directory, and nothing removes
  earlier iterations' files before the next — bounded and small for a handful of test uploads, but
  worth confirming it stays that way if §7's U6 coverage grows.
- **`chmod 0777` on the bind-mounted host directory (§6.9) is a scoped, deliberate loosening**, not
  an oversight — acceptable because the directory is single-purpose and reset every fresh boot,
  never a real deployment's data volume. Still worth a comment at the call site given it's an
  unusual enough pattern that a future reader might otherwise "fix" it.
- **§6.10's new page objects are real, non-trivial scope, not incidental glue.** About modal,
  profile-photo upload/verify, post-send attachment rendering, plugin upload, and extending
  System Console's version display are five separate pieces of new UI-automation code, each
  touching product surfaces this harness has never driven before — this is no longer "write a spec
  reusing existing helpers," it's "build the helpers, then write the spec." Budget accordingly; this
  is a materially larger effort than the container/CI machinery in §6.1-§6.8.
- **A4's feasibility is genuinely unconfirmed, not just unbuilt.** Whether System Console's Server
  Logs viewer shows historical log lines (including the startup-time migration-complete line) or
  only live-tails from whenever it's opened is unknown — if the latter, A4 as a real UI journey may
  be *impossible* to build correctly, not merely effortful, since an admin opening it after the
  restart already happened would see nothing there regardless of code quality. Confirm actual
  product behavior before committing engineering time to this one specifically.
- **A5 has no UI answer at all** — confirmed, not assumed, by the §6.10 survey. Treating `mmctl`
  output as "admin-facing enough" is a judgment call, not a discovery of a hidden UI feature; if
  that's not an acceptable substitute, A5 should be dropped from the UI-driven plan entirely rather
  than forced into a shape it doesn't fit.

## 9. Observability

- `logs/testcontainers_env_history.log` — chronological boot-env history across every restart,
  already implemented (`archiveEnvFile`/`appendEnvFile`), needs no new code; across a full
  from→to run this shows three blocks (initial to-image boot, swap to from-image, swap back to
  to-image), each timestamped with its resolved `serverImage`.
- Per-container logs (`mattermost.log`, etc.) via `collectLogs`/`testcontainers_down.mjs` — only
  whatever Mattermost container is running at the moment teardown actually runs gets its logs
  captured. In the local npm-script flow, that's whenever `npm run testcontainers:down` is
  eventually run — by then the container has already been swapped at least once (to from-image)
  and likely twice (back to to-image), so the from-image's logs (where baseline data was created)
  are gone unless captured earlier. If they're needed for postmortem, `upgrade_swap_from.ts`/the
  `upgrade-from` run project should fetch them itself before `upgrade_swap_to.ts` swaps away —
  call this out as a follow-up before relying on this flow for actual production incident
  debugging.

## 10. Testing strategy for this feature itself

Before trusting this test to gate anything:
1. Run `test:upgrade:from` then `test:upgrade:to` with `PW_UPGRADE_FROM_SERVER_IMAGE` set equal to
   `SERVER_IMAGE` — every check in §7 should still pass (a trivial "upgrade" from an image to
   itself), proving the harness itself (both restarts, both adoptions, reconnect, assertions) works
   independent of any real version difference.
2. Run it pointed at **two genuinely different, adjacent versions** and confirm it still passes —
   proving it's not accidentally too strict (e.g. asserting on a version-specific field that
   legitimately changed).
3. Deliberately break something (e.g. set `PW_UPGRADE_FROM_SERVER_IMAGE` to a nonexistent tag, or
   truncate a required table between `upgrade-from` and `upgrade-to`) and confirm the test fails
   loudly rather than hanging past its timeout or silently passing.
4. Confirm `npx playwright test --project=upgrade-from --list` and `--project=upgrade-to --list`
   show exactly the expected tagged specs (§8's tag-omission risk) — run this as a sanity check
   any time a new dedicated or common upgrade spec is added.

## 11. Rollout plan

1. **Confirm A4's feasibility first** (§8) — check whether System Console's Server Logs viewer
   actually shows historical log content before writing anything against it. This can invalidate
   part of §7 before any other work starts, so it goes first, not last.
2. Implement the §6.9 local-storage bind-mount fix, standalone — it's a prerequisite for U6 to be
   writable as anything other than a guaranteed failure, and is independently verifiable without
   any of the upgrade-specific machinery (just: restart the Mattermost container twice via the
   existing `ensureLocalFile()` path, confirm a file uploaded before the first restart is still
   downloadable after the second).
3. Build the §6.10 page-object gaps one at a time, each independently testable against a single
   running server *before* any upgrade/swap machinery touches them — About modal, profile photo,
   post-send attachment rendering, plugin upload, System Console version display. This is the
   bulk of the new engineering effort in this plan (§8) and has no dependency on §6.1-§6.8 at all.
4. Implement §6.1–§6.6 (helper, folder/tag convention, swap specs, projects, npm scripts) for
   local/manual use only first (no CI wiring yet). Validate per §10, writing the from/to-phase
   specs against the now-available page objects (§7's U1-A5).
5. Implement the resolver script (§6.8) standalone; validate its output against the worked example
   (2026-07-27 → `11.9`, `11.8`, `11.7`, `10.11`) and against at least one other date/version
   combination by mocking "today," before wiring it into CI at all.
6. Add the resolve + loop CI steps (§6.7), gated to `matrix.worker_index == 0`. Confirm the actual
   image-tag scheme (patch vs. alias — §8) against the registry before this step can pass for real.
7. Once stable over several runs, consider whether the single-worker gating and the now-larger
   per-worker-0 cost (§8) need a dedicated status check, or a compensating reduction in worker 0's
   dispatch share.
8. Investigate wiring `PW_UPGRADE_FROM_SERVER_IMAGE` resolution to the existing
   `Setup Upgrade Test Server` PR label as a later phase, once its current (external) behavior is
   understood — likely superseded by §6.8's automatic resolution anyway, since that label's job
   was presumably "figure out what to test," which the resolver now does unconditionally on every
   run.

## 12. Open questions

- **Does System Console's Server Logs viewer show historical entries, or only live-tail?** Blocks
  A4 entirely — if only live-tail, A4 needs dropping or redefining, not just building (§8, §11).
- Is `mmctl` output an acceptable stand-in for "admin-facing" for A5, given no real UI surface
  exists at all — or should A5 be dropped from the plan rather than forced (§7, §8)?
- Image tag scheme (§6.8, §8): exact patch version or floating release alias? Blocks §6.7 from
  actually working until confirmed.
- Should worker 0 carry a smaller share of `playwright-full`'s dispatch queue to offset the added
  rolling-upgrade matrix cost (§8), or is the imbalance acceptable?
- Is a blue/green (start-before-remove) swap worth building into `restartMattermostContainer` itself
  given it would also reduce the "no server running" window for the *other* `ensure*()` callers, not
  just this feature — now exercised 2×N times per run instead of 2× (§8)?
- Should the single-worker CI gating (§6.7, §8) get its own lightweight status check/alert so a
  silently-skipped run (worker 0 failing before reaching these steps) is distinguishable from
  "upgrade tests ran and passed"?
- Should a lint rule enforce that every file under `specs/upgrade/**` contains its required phase
  tag, given the silent-exclusion risk in §8?
- Is the §6.9 local-storage bind-mount fix worth applying to `mattermost_container.ts` generally
  (i.e. for every testcontainers-mode run, not just upgrade tests), so local-storage data also
  survives *any* `restartMattermostContainer()` call — e.g. `ensureFeatureFlag()` switching a flag
  mid-suite already restarts the server today, and would hit this exact same data-loss gap for any
  spec that uploaded a file first?
- Should `listLocalStorageFiles()` (§6.9, optional) actually be built now, given it's the only
  backend among the three lacking an independent-of-API verification, or is the API round-trip
  alone sufficient for U6?
- Should the resolver's live fetch to raw.githubusercontent.com (§6.8, §8) have a retry/fallback
  (e.g. a cached last-known-good matrix) rather than failing the whole rolling-upgrade run on a
  transient GitHub outage?
- Once the five §6.10 page objects exist, should they also backfill the *existing*
  `local_file_storage.spec.ts`/etc. specs (e.g. adding a real post-send attachment render check
  there too), or stay scoped to the upgrade plan only?

## Appendix: file change list

| File | Change |
|---|---|
| `e2e-tests/playwright/lib/src/server/version.ts` | New — `upgradeServerImage()` |
| `e2e-tests/playwright/lib/src/server/index.ts` | Export `upgradeServerImage` |
| `e2e-tests/playwright/lib/src/index.ts` | Re-export |
| `e2e-tests/playwright/lib/src/test_fixture.ts` | Wire into `ExtendedFixtures` |
| `e2e-tests/playwright/specs/upgrade/upgrade_swap_from.ts` | New swap spec |
| `e2e-tests/playwright/specs/upgrade/upgrade_swap_to.ts` | New swap spec |
| `e2e-tests/playwright/specs/upgrade/from/**` | New — dedicated from-phase specs (`@upgrade-from`) |
| `e2e-tests/playwright/specs/upgrade/to/**` | New — dedicated to-phase specs (`@upgrade-to`) |
| Existing common specs across `specs/**` | Add `@upgrade` tag where appropriate |
| `e2e-tests/playwright/playwright.config.ts` | Four new projects: `upgrade-swap-from`, `upgrade-from`, `upgrade-swap-to`, `upgrade-to` |
| `e2e-tests/playwright/package.json` | Two new scripts: `test:upgrade:from`, `test:upgrade:to` |
| `e2e-tests/playwright/script/resolve_upgrade_matrix.mjs` | New — rolling-upgrade matrix resolver |
| `.github/workflows/e2e-tests-playwright-template.yml` | New resolve + loop steps + one new env var, no new file |
| `e2e-tests/playwright/lib/src/containers/stack.ts` | New `LOCAL_STORAGE_DIR` constant; reset-on-fresh-boot logic (§6.9) — no new `testConfig` field or env var needed |
| `e2e-tests/playwright/lib/src/containers/mattermost_container.ts` | Add the `/mattermost/data` bind mount (§6.9) |
| `e2e-tests/playwright/lib/src/server/filestore.ts` (or a new file) | Optional — `listLocalStorageFiles()` helper (§6.9) |
| `e2e-tests/playwright/specs/upgrade/{from,to}/**` or common, tagged `@upgrade` | New specs for §7's U6 (local/Minio/Azurite file-storage integrity, verified through the UI) |
| `.gitignore` (repo root) | Add `e2e-tests/playwright/local_storage` to the Playwright-generated-files section |
| `e2e-tests/playwright/package.json` | Add `local_storage` to the `clean` script's `rm -rf` list |
| `e2e-tests/playwright/lib/src/ui/components/*/about_modal.ts` (new) | New page object — About modal, version/build string (§6.10, U8/A1) |
| `e2e-tests/playwright/lib/src/ui/components/channels/profile_modal.ts` | Extend — profile photo upload; new avatar-render assertion helper (§6.10, U5) |
| `e2e-tests/playwright/lib/src/ui/components/channels/post_create.ts` / new post-view helper | Extend/new — verify a *sent* post's attachment renders/downloads, not just the compose-time preview (§6.10, U6) |
| `e2e-tests/playwright/lib/src/ui/components/system_console/sections/about/edition_and_license.ts` | Extend — expose/assert an actual version string, if System Console shows one (§6.10, A1) |
| `e2e-tests/playwright/lib/src/ui/components/system_console/sections/plugins/plugin_management.ts` | Extend — add upload/enable methods (only removal/verify-absence exist today) (§6.10, A2) |

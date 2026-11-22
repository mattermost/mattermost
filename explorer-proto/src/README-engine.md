# Explorer engine

Run from the repository root after `explorer-proto/infra/scripts/up.sh`. Node 24 runs the CLI directly (type stripping); Playwright, the browser and the TypeScript loader come from `e2e-tests/playwright/node_modules` through the git-ignored symlink `explorer-proto/node_modules -> ../e2e-tests/playwright/node_modules` (create it once with `ln -s ../e2e-tests/playwright/node_modules explorer-proto/node_modules`).

```bash
node explorer-proto/src/cli.ts explore      [--out=<dir>]   # bounded BFS -> <dir>/trace.json, trace.md
node explorer-proto/src/cli.ts emit         [--out=<dir>]   # trace.json + scenarios.json -> <dir>/*.spec.ts, trace.md
node explorer-proto/src/cli.ts replay       [--out=<dir>]   # runs the already-generated specs only (no explore/emit)
node explorer-proto/src/cli.ts guard-check  [--out=<dir>]   # network guard proof on a loopback fixture (no stack) -> <dir>/guard-report.md
node explorer-proto/src/cli.ts guard-race   [--out=<dir>]   # teardown race regression (local servers, no stack) -> <dir>/guard-race-report.md
node explorer-proto/src/cli.ts probe-absence [--out=<dir>]  # absence-locator non-vacuity -> <dir>/absence-probe-<variant>.md
```

- `<dir>` defaults to `explorer-proto/generated`. Arguments after `--` go to `playwright test` (e.g. `-- --grep PILOT-02`).
- `PW_BASE_URL` is optional; default is `base_url` from `infra/.run/seed-manifest.json`. It must be `http://127.0.0.1:<port>`.
- `PW_USE_TESTCONTAINERS` must be unset. The CLI drops `MM_LICENSE` from the Playwright process env.
- Exit codes: Playwright's for explore/replay/guard-check/guard-race; `guard-journey` exits 1 if any mechanism, control or thin-config run fails; emit exits 1 if any scenario was stopped.
- Reports: `generated/reports/<mode>.json` (Playwright JSON) and `generated/test-results/<mode>/`, both git-ignored. Screenshots, video and traces are off.

## How it works

- `playwright.config.ts` spreads `e2e-tests/playwright/playwright.config.ts`, keeps only the `chrome` project, skips the repo globalSetup, and selects the test dir by `EXPLORER_MODE` (`explore` and the guard checks run `src/*.pw.ts`; `replay` runs `<dir>/*.spec.ts`). Modes that run the application-level guard (`explore`, `replay`, `explore-journey`, `guard-check`, `guard-race`, `probe-absence`) add the browser launch arg `--disable-features=LocalNetworkAccessChecksWebSockets` (see "WebSocket under the guard"); `EXPLORER_WS_LNA_WORKAROUND=0` removes it.
- `session.ts` `openGuardedSession(pw)` calls the framework's `TestBrowser.login(seeded user)` on a Browser wrapper (`guard.ts` `guardedBrowser`). The wrapper creates the context with `serviceWorkers: 'block'` and installs the guard before returning it, so the guard exists before `login()` opens its page; `login()` never navigates.
- `guard.ts` allows exactly the manifest origin: `context.route('**/*')` aborts other origins, resolves 3xx responses itself (`route.fetch({maxRedirects: 0})`, every later hop checked) because Playwright does not route redirect hops, `context.routeWebSocket` closes WebSockets to any other origin, and a response/redirect-chain listener records escapes as violations that fail the session.
- Handler lifecycle: every route handler promise is tracked. Closing a session marks the ledger `closing`, refuses new fulfils (abort, counted as `teardown_aborted`), waits for in-flight handlers (bounded 2 s), closes, then lets late handlers settle. A handler error is benign only while closing and only for `Fetch response has been disposed`, `Request context disposed`, `Target page, context or browser has been closed` or `Route is already handled`; any other handler error is a violation that fails `closeGuardedSession(s)`.
- `explore.pw.ts`: roots and allowlist come from `scenarios.json`; every candidate action runs in a fresh guarded context that replays the path from the root. State key = pathname + normalized aria snapshot (`snapshot.ts`).
- `absence_probe.pw.ts`: on the `no-archive` seed every declared absence locator must find its element (Unarchive needs `manage_team`, which qa-user lacks, so the probe reports it as not shown present; its exact name is exercised by the coordinator's verify control with qa-user as team admin); on an archived seed each must find nothing.
- `emit.ts`: actions and locators come from the trace; assertions come only from `scenarios.json` `expected_outcome`, checked against the observed snapshots (a disagreement stops the scenario). Matrix rows marked COVERED in `coverage.md` are skipped.

## Charter sessions

```bash
explorer-proto/infra/scripts/up.sh --session=bookmarks
node explorer-proto/src/cli.ts explore --session=bookmarks [--out=<dir>]   # charter BFS -> <dir>/trace.json, trace.md
node explorer-proto/src/cli.ts emit    --session=bookmarks [--out=<dir>]   # trace + charter predicates -> <dir>/<dedupe key>.spec.ts
node explorer-proto/src/cli.ts replay  --session=bookmarks [--out=<dir>]   # runs that dir's spec only; PASS needs >=1 passed, 0 failed/skipped/flaky
```

- `<dir>` defaults to `sessions/<name>/generated`, outside `generated/`, so the pilot replay never picks the session spec up. `--session` sets `PILOT_SESSION` for the Playwright process; the config then runs `explore_session.pw.ts` for `explore`, uses the session dir as the replay `testDir`, and writes reports to the git-ignored `sessions/<name>/generated/{reports,test-results}`. Without `--session` (the CLI also drops an inherited `PILOT_SESSION`) every command and path is unchanged.
- **Inputs, all from `sessions/<name>/charter.json`:** `start.start_path` (single root), `allowed_actions` (an unordered set: exact entries only, sorted by role then name), `budget` (used as given), `expected_outcome`, `locator_scope.live_name_status` (its single-quoted substrings select the names to report) and `dedupe.key`. `src/` holds no route, click order, link name or expected string.
- **Exploration** reuses the pilot BFS (`bfs.ts`, shared with `explore.pw.ts`): fresh guarded context per candidate with path replay, state key = pathname + normalized snapshot, dedupe, volatile-text scrub, posts dropped. Session extras: the run's origin is replaced by `<origin>` before normalization; a marker set on `window` after the start navigation records whether each click kept the same document (no reload); every state records the live names of nodes whose role is a declared role expectation and whose name contains a reported substring. `trace.md` holds the sanitized action log (considered, skipped with reasons, taken, resulting path, state, diff, live names). Writing refuses output that contains a loopback host, the origin, the port, a seeded id or the seeded password.
- **Predicate evaluation** (`charter.ts`): a state is in a predicate's scope when its pathname equals the predicate's `url_path` (which must equal the `URL path equals …` path in `applies_to`), its path uses allowed actions only from the start state, and, if `applies_to` says `no page reload`, every click kept the document. It qualifies when, in addition, every snapshot-observable expectation holds: `url_path` by pathname; `role` by counting snapshot nodes page-wide (exact name for presence, substring for absence). `testid` expectations have no snapshot node (a bare div without a role) and are recorded as "not snapshot-observable; asserted by the replay locator". Observation never writes an expectation.
- **Path selection:** predicates whose `applies_to` starts with "The start state" are asserted at the start state, which must qualify. Exactly one other predicate is the target. Among its qualifying states the emitter picks the discovered path with the **fewest actions, then the lexicographically smallest action sequence** (per step: accessible name, then role; code-unit order). If none qualifies, nothing is emitted and `trace.md` reports what was explored.
- **Emission** (`emit_session.ts`): one spec named after the dedupe key. Steps come from the selected state's recorded transitions (each must start at the previous state, be an allowlisted unique candidate there, and keep the document); assertions come only from the charter, positives before absence checks, all hard `expect` with a `// declared (charter <feature> <expect id>)` marker. Presence checks use exact names scoped to the predicate's test id; absence checks use the substring locator page-wide. The emitter stops on a non-exact presence name, a missing or duplicate expectation id, a live name that contains or glyph-strips to a declared title without equalling it, a stale trace (allowlist, budget or start differ from the charter), guard violations, or a step it would have to invent. A dedupe key marked COVERED in `coverage.md` emits nothing.
- **Licence:** the bookmark bar is licence-gated, but the session spec does not call `pw.skipIfNoLicense()`. For a charter whose server must be licensed, an unlicensed server is a setup failure (`up.sh --session` fails first); a skip would report it as not-failed. Without a licence the declared bar assertions fail, and the session replay judge also treats any skipped test as FAIL.

## Journey mode (`explorer-journey-charter/v1`)

A second charter schema, `explorer-journey-charter/v1`, drives a heuristic best-first discovery over **fresh
fixtures**. The existing session mode, every command, and all committed outputs are unchanged and byte-identical.

```bash
explorer-proto/infra/scripts/up.sh                                   # default seed (the journey ignores it)
node explorer-proto/src/cli.ts explore --journey=auto-follow [--out=<dir>]   # best-first search -> <dir>/trace.json, trace.md, stats.json
node explorer-proto/src/cli.ts emit    --journey=auto-follow [--out=<dir>]   # trace + charter -> ONE repo-native spec under e2e-tests/playwright/specs/
node explorer-proto/src/cli.ts replay  --journey=auto-follow                 # runs the emitted repo-native spec through the thin config with containment
node explorer-proto/src/cli.ts guard-journey --journey=auto-follow            # proves the repo-native-spec containment on a loopback fixture -> <dir>/guard-journey-report.md
node explorer-proto/src/cli.ts containment-evidence --journey=auto-follow     # composes <dir>/containment-evidence.json (the v2 containment_evidence gate input) from the last guard-check, guard-race and guard-journey runs
```

Default `<dir>` is `sessions/<name>/generated`. The journey name maps to `sessions/<name>/charter.json`.

### Fresh fixture per replay (`journey_fixture.ts`)

Every replay (including confirmation replays) builds a brand-new team, users, channels, memberships, preferences
and viewed-last state through the repo lib's admin and per-user REST clients, exactly as `charter.fixture`
declares (slug from `pw.random.id()`, fixed display names, fixed strings). `server_preconditions` is a read-only
`GET /api/v4/config` (never patched; a difference aborts as a **setup failure**, never a finding). The read-backs
(memberships, auto-follow not `on`, preferences stored, no user post, zero followed threads) and "viewed clean"
are asserted; any mismatch is a setup failure. Viewed clean is read with the UI actor's own session from
`GET /api/v4/users/{user}/channels/{channel}/unread` (`readChannelUnread`, via `journey_rest.ts` `restRequest`):
`msg_count`, `msg_count_root`, `mention_count` and `mention_count_root` must all be 0, and the member's
`notify_props.mark_unread` must not be `mention`, because the server reports 0 unread msgs in that mode. The member
record's `msg_count`/`msg_count_root` are the read cursor (the channel totals at the last view), not unread counts,
so they are not used (`infra/scripts/diag_unread_readback.mjs` shows both on a live server). Bea signs in with
`TestBrowser.login` inside the guarded context.

### REST checkpoints & events (`journey_rest.ts`)

Checkpoint and event REST calls execute the charter's literal `/api/v4/...` paths (templates resolved) with the
actor's bearer token (admin, or the named actor's own session when the predicate says "own REST session"). Supported
predicate forms: `field` `equals`/`not_equals` with `absent_counts_as`; `expect` maps (including `order_length`);
`no_mention`; and the FINAL `threads[].id contains` / `thread[id=..].<field>` matchers. A clause that names an id
not yet bound (e.g. an event id before the event fired) counts as not-yet-true, never an error. An event fires at
most once, when its trigger checkpoint first holds; the runner then waits (bounded) until the result checkpoint
holds before the next action. UI checkpoints (`journey_ui.ts`) evaluate snapshot predicates
(`url_path_matches`/`equals`, role+name exact, `selected`, counts, tabpanel containment with `subtree_text_contains`,
text/`text_contains`). The aria snapshot **does** expose child text under an aria-labelled link in 1.62.1, so C3's
row text is read from the snapshot; a scoped DOM `textContent`/`getByText` fallback is used only when the snapshot
misses it, and the method used is reported. If the snapshot cannot expose the row text, the emitter stops.

### Action rules (`journey_actions.ts`)

Candidates come only from the live accessibility snapshot, filtered by `charter.action_rules`: `roles_in_play`
(others ignored), `excluded_name_patterns` (case-insensitive regex on the accessible name), the `origin_rule` (a
link whose resolved href is off-origin is skipped), uniqueness (exact role+name resolving to exactly one visible,
enabled element at click time — within the topmost dialog when a modal is open), `modal_policy` (while a dialog is
open only its controls are candidates), and `key_actions` (Escape only, offered when a menu or dialog is open).
Every skipped candidate is recorded with the rule that skipped it. A candidate whose accessible name embeds a
fixture-specific token (slug, team/channel name, username) is dropped as non-replayable.

**Region mapping (generic).** `charter.action_rules` names regions in prose; only the two *excluded* regions are
positively identified from landmarks, and everything else is in play. v12.1.0 uses role `application` for several
regions, so the map is by landmark role **and** accessible name: `dialog`/`alertdialog` → modal (in play; scoped by
`modal_policy`); a landmark whose name contains "message input"/"composer" → the message composer (EXCLUDED); role
`form` → the messaging-help form (EXCLUDED); a `banner` whose name contains "channel header" → channel header (in
play); any other `banner` → the global header (EXCLUDED); a name containing "channel sidebar"/"channel navigator" →
left sidebar (in play); role `main` → the center pane (in play). A landmark matching none of these is reported and
kept in play (conservative), and the regions seen per state are logged.

### Heuristic best-first search (`journey_search.ts`, `journey_score.ts`)

Bounded best-first over fresh-fixture replays. Each replay re-creates a fixture, signs Bea in, walks the path from
the start, firing the event and polling checkpoints after each action, and enumerates candidates only at the
terminal (new) state. The child priority is journey-independent and references only the goal terms, the parent
state's observed checkpoint progress, novelty, and depth:

```
score(child) = 100*fullCheckpoints + 50*firedEvents + 60*containerOpen + 1*partialClauses + 12*novelty + 6*lexical - 1*depth
effective(child, at selection) = score(child) - 15*(prior actuations of this exact role+name anywhere)
```

- **fullCheckpoints / firedEvents**: checkpoints fully satisfied, and events fired, through the parent state.
- **partialClauses**: individually-satisfied checkpoint clauses (tiny weight, so a structurally-true clause — e.g.
  an always-present tab or absent empty-state text — cannot create a moat around a view).
- **containerOpen**: 1 when a menu or dialog is open at the parent (`modal_policy`: drill through its controls).
- **novelty**: 1 when the parent was a new URL path or a new normalized snapshot, else 0.
- **lexical**: count of distinct `goal_terms` (the goal minus `charter.goal_terms.stopwords`, lowercased and with a
  trailing ing/ed/es/s stripped) present in the candidate's accessible name (same stemming).
- **depth**: actions from the start.
- **fatigue** (applied at selection time): subtracts per prior actuation of the same (role, name) anywhere, an
  exploration term that stops the search re-toggling one control across a modal's combinations.

Ties break by higher effective score, then (name, role) lexicographic, then shorter path. None of these terms
reference a control label, a step word, or anything from QA-NOTES / the sealed route.

**State key & dedupe.** `pathname` (with the fixture slug and other fixture tokens substituted to placeholders, so
fresh fixtures dedupe) **plus a trajectory signature** (which checkpoints/events have fired) **plus** the normalized
snapshot. The trajectory signature is essential: saving the preference (C1) or the teammate event (C2) does not
change the channel snapshot, so without it the post-change state would collapse into the pre-change one and the
journey could never be continued. The journey normalizer extends the shared `normalizeSnapshot` only for its own
state keys (it never touches the shared function or the committed pilot/session outputs): it substitutes the
origin and fixture tokens, and scrubs volatile sidebar badges (" N mention(s)", " unread") and the account-menu
presence indicator ("Status is …").

**Budget** (`charter.budget`): `max_actions` (expansion replays), `max_depth`, `max_states`, `max_replays`
(including confirmation replays), `wall_clock_seconds`. A path qualifies only when `success_criteria` hold in order,
reproduced on a fresh fixture by a confirmation replay; among confirmed paths the selection is fewest actions then
lexicographically smallest. If none qualifies within budget, nothing is emitted and `trace.md` reports where it
stopped, the best remaining frontier, and the checkpoint progress reached.

### Emission (`emit_journey.ts`)

One repo-native spec under `e2e-tests/playwright/specs/functional/channels/notifications/` (beside the existing
channel-notification specs; same modal family as `channel_mentions.spec.ts`), named from the charter `journey_id`.
It imports `{expect, test}` from `@mattermost/playwright-lib`, uses only repo fixtures/helpers (`pw.getAdminClient`,
`adminClient`/`userClient`, `pw.makeClient`, `pw.testBrowser.login`, `pw.random`, `pw.newTestPassword`), creates all
its own prerequisites exactly as `charter.fixture` declares (so it runs without the explorer and without a seeded
database), reads `server_preconditions` read-only and fails with a clear message if violated, contains the
discovered UI actions as exact role+name locators from the recorded path (no sleeps; auto-waiting expects only),
posts the teammate event over Abe's own REST client at the trigger point (with the required disclosure comment), and
asserts C1 (REST), C2 (REST), C3 (UI), C4 (UI) and FINAL (REST) with the charter literals, each labelled
`// declared (charter <id>)`. It uses hard `expect` only and no `pw.skipIfNoLicense()` (the journey is not
licence-gated). The emitter **stops** (writes nothing) when no path qualified, when the snapshot cannot expose the
C3 row text, when a declared expectation id is missing, or when it would have to invent a step; a stop is reported.

### Network containment for the repo-native spec (`containment_proxy.ts`, `journey_containment.ts`)

The emitted spec uses plain repo fixtures (`pw.testBrowser.login` -> `browser.newContext`), so the explorer's
application-level guard cannot be imported into it and `context.route` handlers cannot be installed. What does
reach the browser the lib uses is the config: `use.launchOptions` configures the browser the Playwright
`browser` fixture launches, and `pw.testBrowser` wraps exactly that fixture. `use.serviceWorkers: 'block'` also reaches contexts
the lib creates through `browser.newContext` (the Playwright runner applies `use` context options as defaults for every
context made in a test); `guard-journey` proves it: the worker script is never requested, while an explicit
`serviceWorkers: 'allow'` context from the same browser does request it. **Correction:** earlier text said `serviceWorkers`
covered fixture contexts only and not the login context; that was wrong, it reaches both. Route handlers (`context.route`) do not.

`replay --journey=<name>` therefore starts a **filtering forward proxy** (`containment_proxy.ts`) in the CLI process
before Playwright and stops it afterwards. Chromium is launched with
`--proxy-server=http://127.0.0.1:<proxy>`, `--proxy-bypass-list=<-loopback>` and, as a second layer,
`--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`.

- The proxy forwards only the exact approved `host:port` (absolute-URI HTTP, `CONNECT` tunnels; WebSockets use `CONNECT`
  in Chromium 151) and answers everything else `403` before it opens any upstream socket. It counts refusals by category
  (`same-host-other-port`, `loopback-alias`, `other-host`, never a port). CLI output prints only counts.
- `<-loopback>` is required: Chromium bypasses a proxy for `127.0.0.1` and `localhost` by default. `guard-journey` runs a
  control with `--proxy-server` alone and the second server then receives HTTP and the WebSocket upgrade.
- The proxy port exists only in the CLI process and the child environment (`EXPLORER_CONTAINMENT_PROXY_PORT`); it is never
  written to a report, trace or spec. Running `replay-journey` without the CLI is refused (the config throws), not run uncontained.
- The proxy sees the scheme only for plain HTTP; for a `CONNECT` it sees `host:port`. An `https://` or `wss://` URL to the
  approved `host:port` would be tunnelled (to a server that speaks plain HTTP, so the TLS handshake fails); no other
  destination can be reached.
- `403` is what the page sees for a refused plain-HTTP request or navigation (`x-explorer-containment: refused`); a
  refused `CONNECT` fails as a network error. The page cannot tell a proxy 403 from an app 403, so verdicts use server-side counters.
- Not covered: UDP channels (WebRTC, WebTransport/QUIC) do not pass a TCP proxy. The WebTransport/WebRTC LNA checks stay on.
- Not verified here: a full replay against the real Mattermost stack (needs Docker). The proxy is verified against loopback
  fixtures with HTTP, redirects, an echo WebSocket and a service-worker probe.

**What `guard-journey` proves (all on loopback fixtures, no stack).** Every verdict is the second server's own counters
(TCP connections accepted, HTTP requests parsed, `upgrade` events), never a client error. It runs the same traffic suite
(`containment_suite.ts`) in: the thin config with a plain test (`containment_scratch.ts` writes the git-ignored scratch spec
`infra/.run/containment_scratch.spec.ts`; the lib's own `test` is not used because its auto fixtures log in to a server) with and without
containment; and mechanism variants (plain launch, the old host-resolver-only rule, a proxy without `<-loopback>`, the
proxy, and the proxy while DNS would resolve an external name to the second server). The controls must leak or the run fails.
`localhost` by name on the approved port cannot be a separate server: the approved server's counters and `Host`
headers show it received nothing (direct), and the proxy's refusal count is the other half. The external name is direct
only where DNS can be mapped to the second server (the mechanism variant); in the thin-config run it is the proxy's refusal count plus the client error.

## Outcome mode (journey charters with `success_criteria.outcomes`)

Every addition below is switched on by a charter key. A charter without that key runs exactly the code it ran
before; the auto-follow charter declares none of them, and the selftest re-renders its committed `trace.json` and
`trace.md` byte for byte through the current writer.

```bash
node explorer-proto/src/cli.ts explore --journey=<name> [--out=<dir>] [--charter-hash]   # outcome run when the charter declares outcomes
node explorer-proto/src/cli.ts charter-check --journey=<name>    # parses the outcome rules only (no stack, no browser)
node explorer-proto/src/cli.ts charter-hash  --journey=<name>    # sha256 of sessions/<name>/charter.json (same as sha256sum)
node explorer-proto/src/cli.ts engine-hash [--list]               # deterministic hash of the engine files listed below
node explorer-proto/src/cli.ts journey-selftest                   # offline outcome-mode selftest (loopback fake app, synthetic charters)
```

| Charter key | Behaviour (generic) | Code |
| --- | --- | --- |
| `fixture.posts[]` | Each post is created after channels and memberships and before preferences and the view calls, with `POST <path>` from `request` (default `POST /api/v4/posts`), the body's `{..}` templates resolved (`{channel.<key>.id}`, `{actor.<id>.id}`, ...), by the client `as` names: a fixture actor id as its first word uses that actor's own session; `admin` or no actor uses the admin. Any status other than `expect <nnn>` in `request` (default 201) is a setup failure. Binds `{post.<key>.id}`. | `journey_fixture.ts` |
| `fixture.server_preconditions` with `source: "client_config"` or a `how` naming `GET /api/v4/config/client...` | Unauthenticated, read-only GET of that path **before** the fixture is built; each `expect` key is compared with `===` on the returned object; a difference is a setup failure. Keys named (capitalised words) in `target_release.build_identity_report` that exist in the response are recorded verbatim in the report and never asserted. Otherwise the admin `GET /config` path is unchanged. | `journey_fixture.ts` |
| REST `expect` keys | Dotted paths with array indexes and `length` (`a.b[0].c`, `a.list.length`); an object or array expectation is compared by deep equality after template resolution; primitives stay `===`. Unbound templates still mean "not yet true". Paths without brackets read exactly as before. | `journey_charter.ts` `readPath`/`deepEqual`, `journey_rest.ts` |
| REST checkpoint ids named in `fixture.read_back` | Evaluated after the read-back and again at the end of every replay; false is a setup failure. | `journey_search.ts` |
| `fixture.read_back` text | The membership-level auto-follow check runs only if it mentions auto-follow, the followed-threads check only if it mentions threads. | `journey_fixture.ts` |
| `success_criteria.outcomes` | Switches the search into outcome mode (everything below). | `journey_outcomes.ts`, `journey_search.ts` |

**Rule grammar (`journey_outcomes.ts`).** Names come only from the charter; text the grammar does not recognise
stops the run before any fixture is built (`charter-check` shows the parse).

- `per_state_classification`: every `<checkpoint-id> true|false` in a class's text is a clause; a state gets the
  first declared class whose clauses all hold. A checkpoint that was not evaluated matches no clause.
- `run_verdict` texts: `every other case` = always; `at least one reached state is <CLASS>` = observed, or
  confirmed when the text mentions confirmation; `no <CLASS> observation exists` = none; otherwise
  `precondition`/`read-back` = setup failure. Conditions in one text are ANDed.
- `precedence`: `<VERDICT>` (its run_verdict rule) or `<VERDICT> when a[n] [un]confirmed <CLASS> exists`. The first
  entry that holds is the verdict; the last entry must be an "every other case" rule.
- Confirmation order: the classes in confirmed/unconfirmed conditions, in precedence order. `failing_observations`:
  classes named in `observation_policy.preserve_failures`.
- UI checkpoint keys: `evaluated_only_when: "<id> is true|false ..."` gates a checkpoint on an earlier result in
  the same observation; `settle`: `ms`/`timeout_ms` or `up to <n> ms` in `settle.rule`; `post_scope`: `anchor`
  (a `fixed_strings` key), `same_as`, or in `rule` `same container as <id>`, else the `fixed_strings` key after
  `contains`, else the only one named.

**UI evaluation (`journey_observe.ts`).** After the existing snapshot-stability settle, each UI checkpoint is
evaluated on the raw aria snapshot. If it is false and declares a settle window, it is re-evaluated through
`expect.poll` (intervals 100/250/500 ms) on a fresh snapshot until it holds or the window ends; no fixed sleep.
Text clauses match case-sensitive substrings; a string the snapshot lacks is looked up in the DOM
(`getByText(<escaped regex>)`) and the method (`snapshot`/`dom`/`none`) is recorded per string. With `post_scope`,
the container is the smallest ancestor-or-self of each node whose own text holds the anchor whose role is one of
`listitem, article, row, gridcell, treeitem, dialog, alertdialog, complementary, region, main`; the DOM fallback
uses the smallest element of those roles whose text holds the anchor. An owner checkpoint holds when all its
clauses hold in one container; a same-container dependent must hold in every container where its owner held.
When no container is anchored, the evaluation is page-wide and the log says so (`scope`).

**Search, confirmation, verdict (`journey_search.ts`).** Every state of every replay (start, expansion,
confirmation, including intermediate steps) is evaluated and classified. `budget_reserve.confirmation_replays_reserved`
replays are never spent on expansion, and expansion also stops when the elapsed time plus the reserved replays at
the mean replay cost would pass `wall_clock_seconds`. With `observation_policy.no_early_stop` the search runs to
budget or frontier exhaustion; without it, it stops at the first classification that needs confirmation. Then
every distinct (class, action path) that needs confirmation is replayed on a fresh fixture (confirmation order,
then fewest actions, then lexicographic), drawing on the reserve and any unspent replays; it is confirmed when the
replay's state at the end of that path has the same class. Pairs first observed during confirmation are confirmed
the same way while budget remains. A setup-phase error (preconditions, fixture, read-back) ends the run as a setup
failure; any other replay error is recorded and the run continues. The spec emitter refuses outcome charters.

**Outputs (in the journey's out dir, sanitized: no origin, port, slug, id, password or token).**

- `observations.jsonl`: append-only, one JSON object per line, `seq` from 1 and `prev_sha256` = sha256 of every
  byte before the line. Kinds: `read_back`, `checkpoint` (replay id, `<slug>`, state key, URL path with fixture
  tokens replaced, action path, checkpoint id, per-clause results with string and evidence method, scope, settle
  window and outcome, the state's classification), `state`, `confirmation`, `setup_failure`, `replay_error`,
  `verdict`. The file is opened in append mode; an existing non-empty log is refused (use a fresh `--out`).
- `report.json` (`explorer-journey-outcome-report/v1`): run verdict and the precedence entry that decided it,
  setup failure, preconditions, build identity, `failing_observations` (with confirmation status), representative
  confirmed path per class (fewest actions, then lexicographic), states and observations per class, evidence method
  counts per string, confirmations, flakiness (same state key or same path with different classes), replay errors,
  reserve use.
- `trace.md`/`trace.json`: as before plus a verdict section / `outcomes` summary. `stats.json` is unchanged;
  measured settle waits (wall clock) go to `observation-stats.json` only.

**Exit status.** `explore` writes the report and exits 0 for every verdict except a setup failure, which fails the
Playwright run after the report is written.

### Offline selftest (`journey-selftest`)

`journey_selftest.pw.ts` runs with no stack: the CLI picks a loopback port, hands it to Playwright as `PW_BASE_URL`
and `EXPLORER_SELFTEST_PORT` (never printed), and the test serves `journey_selftest_app.ts` there (the REST routes
the fixture factory, read-back and lib login use, plus server-rendered pages). The charter is
`journey_selftest_charter.json` (a ribbon-tally post; its own ids, classes and verdict names) and copies of it with
budget, settle or scope changed per case. The real fixture factory, REST evaluator, guard, search, UI evaluator,
log and report run against it. Cases: rules and verdict table, fail-closed grammar, matchers, log append-only and
refusals, engine-hash list, auto-follow trace re-render, the unread read-back (the fake models the member cursor,
the unread endpoint, mentions, `mark_unread` and view: an unviewed post is rejected, accepted after the view, a
nonzero cursor with nothing unread is accepted, mentions-only is refused); then (i) all items render, (ii) one item missing in the
room view but present on a second surface, (iii) nothing renders, (iv) delayed post / delayed rows within the
window and a no-settle control that misclassifies them, (v) a missing item a fresh fixture does not reproduce and
one with no budget left to confirm it, (vi) flag mismatch, rejected post and wrong stored data, (viii) item text
present elsewhere on the page but not in the anchored container, with a page-wide control, and a DOM-only case.

### Engine hash

`engine-hash` prints `sha256(listing)`, where `listing` is the `sha256sum` output for the files below in this
order (`<hex>  <path>\n` each). From the repository root, `sha256sum $(cat <list>) | sha256sum` gives the same
value. The list rule is: every `.ts` and `.json` file under `explorer-proto/src` (recursive) plus
`explorer-proto/playwright.config.ts`, repo-relative, code-unit order. This README is not part of the hash; the
selftest fails if the list below and the rule disagree. A verifier may compare: the engine hash and this list,
the charter's sha256 (`charter-hash`), and the git tree ids the QA notes name (`HEAD:explorer-proto/src`,
`HEAD:explorer-proto/playwright.config.ts`, `HEAD:e2e-tests/playwright/lib`); the lib is not in the engine hash.

<!-- engine-hash-files:begin -->
```text
explorer-proto/playwright.config.ts
explorer-proto/src/absence_probe.pw.ts
explorer-proto/src/assertions.ts
explorer-proto/src/bfs.ts
explorer-proto/src/charter.ts
explorer-proto/src/cli.ts
explorer-proto/src/containment_proxy.ts
explorer-proto/src/containment_report.ts
explorer-proto/src/containment_scratch.ts
explorer-proto/src/containment_suite.ts
explorer-proto/src/emit.ts
explorer-proto/src/emit_journey.ts
explorer-proto/src/emit_session.ts
explorer-proto/src/engine_hash.ts
explorer-proto/src/env.ts
explorer-proto/src/explore.pw.ts
explorer-proto/src/explore_journey.pw.ts
explorer-proto/src/explore_session.pw.ts
explorer-proto/src/fixture_servers.ts
explorer-proto/src/guard.ts
explorer-proto/src/guard_check.pw.ts
explorer-proto/src/guard_journey.pw.ts
explorer-proto/src/guard_journey_run.ts
explorer-proto/src/guard_race.pw.ts
explorer-proto/src/journey_actions.ts
explorer-proto/src/journey_charter.ts
explorer-proto/src/journey_containment.ts
explorer-proto/src/journey_fixture.ts
explorer-proto/src/journey_observations.ts
explorer-proto/src/journey_observe.ts
explorer-proto/src/journey_outcomes.ts
explorer-proto/src/journey_rest.ts
explorer-proto/src/journey_score.ts
explorer-proto/src/journey_search.ts
explorer-proto/src/journey_selftest.pw.ts
explorer-proto/src/journey_selftest_app.ts
explorer-proto/src/journey_selftest_charter.json
explorer-proto/src/journey_spec_path.ts
explorer-proto/src/journey_trace.ts
explorer-proto/src/journey_ui.ts
explorer-proto/src/manifest.ts
explorer-proto/src/modes.ts
explorer-proto/src/paths.ts
explorer-proto/src/scenarios.ts
explorer-proto/src/session.ts
explorer-proto/src/session_trace.ts
explorer-proto/src/snapshot.ts
explorer-proto/src/trace.ts
explorer-proto/src/tsconfig.json
```
<!-- engine-hash-files:end -->

## WebSocket under the guard (Local Network Access)

The guard fulfils every document with `route.fulfill`, so Chromium sees no peer address for the page, treats it as a
non-local origin and fails the page's WebSocket to the loopback approved origin with
`net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`. `guard-check` reproduces this on a loopback fixture (diagnostic line
"plain launch without the workaround flag": `ws:failed`) and shows the fix: the config passes
`--disable-features=LocalNetworkAccessChecksWebSockets` in the app-guard modes, which disables only the WebSocket check
(not the navigation, WebRTC or WebTransport checks); the echo then completes under the guard and the second server still counts 0.
Not fulfilling documents would need a second, unverifiable look at redirects, so the flag was chosen. Re-check on the real app under
Docker is outstanding: the committed pilot traces were produced before this flag.

## Containment evidence

`guard-check`, `guard-race` and `guard-journey` each write a git-ignored fragment under `reports/`;
`containment-evidence --journey=auto-follow` turns them into `sessions/auto-follow/generated/containment-evidence.json`
(schema `explorer-containment-evidence/v1`, the input of `v2/gates/containment_evidence.mjs`: `exploration` and
`replay` are the application-level guard on a loopback fixture, `journey` is the thin-config run of the scratch spec,
`scope.spec` is that scratch spec, not a pilot spec). It refuses to write when a run failed or a positive control did not leak.

## Storage state

`TestBrowser.login` -> `loginByAPI` writes `<playwright root>/storage_state/<timestamp>_<user>_<password>.json` (`e2e-tests/playwright/lib/src/browser_context.ts:177,184`). The directory name is hard-coded and the root comes from walking up `process.cwd()` (`lib/src/util.ts:118-156`); there is no env var or option to relocate it, so pilot runs write to the git-ignored `e2e-tests/playwright/storage_state/` like every other spec. Cleanup is the coordinator's runner's job.

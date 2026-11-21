# Bug oracles for the v2 pilot (WP-D)

Deterministic detectors that need no agent opinion, a SYNTHETIC fault-injection layer, and a measurement of both on the pilot's Enterprise 12.1.0 stack. No LLM, no vision, no screenshots, video or traces: oracles read console text, page errors, network metadata, accessibility-snapshot text, DOM attributes (through `evaluate`) and REST responses only. All browser traffic stays on the exact loopback origin through the existing guard (`src/guard.ts`, service workers blocked); nothing in `src/` or `infra/` was changed.

| Path                                                   | Contents                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/`                                                 | Oracle library: `attach.ts` (entry point), one module per oracle, scrubber, finding sink, fixture helpers, measurement traversals and scenarios |
| `faults/`                                              | `fault-proxy.ts` (reverse proxy), `run.mjs` (CLI), `default.json` (OFF) and one JSON config per measured fault                                  |
| `checks/`                                              | Three example `check.json` files for the UI-versus-REST oracle                                                                                  |
| `fixtures/`                                            | Static HTML pages served on a loopback origin inside the self-test                                                                              |
| `allowlist.json`                                       | Known-benign suppressions. **Empty.**                                                                                                           |
| `benign-hints.json`                                    | Hints printed next to findings. They suppress nothing                                                                                           |
| `selftest.mjs`                                         | Unit tests for every oracle, the proxy and the guard (no Mattermost needed)                                                                     |
| `measure.mjs`, `measure.pw.ts`, `playwright.config.ts` | Measurement driver, its Playwright spec and config                                                                                              |
| `stack.sh`                                             | Wrapper around the infra scripts with a configurable Mattermost image ref                                                                       |
| `results/`                                             | Committed, sanitized output of the measurement run described below                                                                              |

## Run

From the repository root, with `MM_LICENSE` exported (never printed) and the git-ignored `explorer-proto/node_modules` symlink in place (see `src/README-engine.md`):

```bash
explorer-proto/v2/oracles/stack.sh up                 # same stack as infra/scripts/up.sh; prints IsLicensed PASS/FAIL only
node explorer-proto/v2/oracles/selftest.mjs           # 50 tests, ~35 s, no stack needed
node explorer-proto/v2/oracles/measure.mjs            # ~7 min; rewrites results/ (--render-only re-renders measurement.md)
explorer-proto/v2/oracles/stack.sh down               # = infra/scripts/down.sh
```

`ORACLE_MM_IMAGE=<repo:tag@sha256:...>` makes `stack.sh up` run another Mattermost image (it must already be pulled; compose uses `--pull never`). It is implemented as a generated compose override file in `.run/` that holds the image ref and nothing else, so `infra/` is untouched. Unset, the pinned 12.1.0 digest from the compose file is used. `measure.mjs` takes the image label from the same variable.

Use in code (any guarded Playwright context):

```ts
const session = await openGuardedSession(pw); // src/session.ts, unmodified
const oracles = attachOracles(session, {checks: loadChecks(), checkData: {manifest}, ids, literals});
oracles.action('click button "View Info"'); // starts action n (0 = initial load)
await page.getByRole('button', {name: 'View Info', exact: true}).click();
await oracles.checkpoint(); // state oracles: O-A11Y and O-UIREST
await oracles.drain(); // pending WebSocket-close decisions
oracles.detach(); // later events are teardown noise
oracles.sink.write('findings.jsonl');
```

Attach before the first navigation so no console message or response is missed.

## Finding records

One JSON object per line, sorted by (oracle, class, path, evidence) in code-unit order, with a fixed key order:

```json
{
    "oracle": "O-NET",
    "class": "http-5xx",
    "path": "/api/v4/users/<id>/channels/<id>/posts/unread?limit_after&limit_before",
    "evidence": "GET /api/v4/users/<id>/channels/<id>/posts/unread -> 500",
    "count": 9,
    "first_action": 0
}
```

- **De-duplication** key: oracle, class, scrubbed path, scrubbed evidence. `first_action` is the smallest action index at which it was seen.
- **`count`**: event oracles (O-CONSOLE, O-NET) count events, so an app that retries a failed call raises it. State oracles (O-A11Y, O-UIREST) count the checkpoints at which the state was seen, once per checkpoint however many elements show it.
- **Scrubbing** happens in one place, the sink. Origins become `<origin>`, loopback hosts and ports `<host>`, known seeded ids `<id>`, the seeded password `<redacted>`, tokens (`MMAUTHTOKEN=`, `Bearer`, JWT) `<token>`, 26-character Mattermost ids `<id>`, UUIDs, long hex, e-mail addresses, React-generated ids `<react-id>`, clock times, dates and digit runs of six or more. Paths keep only sorted query key names. Before any file is written, `assertClean` throws if a loopback host, a URL or a protected literal is still present.
- **Allowlist** (`allowlist.json`, empty): entries match on oracle, class, path glob, evidence regex, method and status. A suppressed finding is counted per entry and reported in each run summary (`suppressed_by_allowlist`), never dropped silently.

## Oracle catalog

| Oracle    | Class                            | Detection rule                                                                                                                                                                                                                                                                                                                                                   | Known weaknesses                                                                                                                                                                                                                                                                                                    | Needs typing / Enter                                                            |
| --------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| O-CONSOLE | `console-error`                  | A `console.error` message. Chromium's `Failed to load resource:` line is skipped because O-NET reports the same event with method, path and status                                                                                                                                                                                                               | Warnings are ignored. Apps log errors for benign reasons, so the allowlist is expected to grow. Anything logged before `attachOracles` is missed                                                                                                                                                                    | no / no                                                                         |
| O-CONSOLE | `uncaught-exception`             | A page `pageerror`                                                                                                                                                                                                                                                                                                                                               | Same as above                                                                                                                                                                                                                                                                                                       | no / no                                                                         |
| O-NET     | `http-4xx`, `http-5xx`           | A response from the app origin with status 400 or above. Redirects are not findings. Expected statuses go in the allowlist per method, path glob and status                                                                                                                                                                                                      | Retries inflate `count`. A 4xx the app handles by design is reported until allowlisted                                                                                                                                                                                                                              | no / no                                                                         |
| O-NET     | `request-failed`                 | A failed request to the app origin (not while detaching)                                                                                                                                                                                                                                                                                                         | `net::ERR_ABORTED` from a navigation would show up here; none occurred in the clean runs                                                                                                                                                                                                                            | no / no                                                                         |
| O-NET     | `ws-error`                       | A WebSocket `socketerror`                                                                                                                                                                                                                                                                                                                                        | Playwright exposes no close code                                                                                                                                                                                                                                                                                    | no / no                                                                         |
| O-NET     | `ws-close`                       | A close of an app-origin WebSocket that is not the page closing, not teardown, and not within 1.5 s of a main-frame navigation request issued after the socket was created. The app may close its socket just before or just after that request event is delivered, hence the window                                                                             | A genuine drop that coincides with a navigation is masked. A normal server close cannot be told from an abnormal one                                                                                                                                                                                                | no / no                                                                         |
| O-A11Y    | `empty-accessible-name`          | A node whose role is interactive (button, link, checkbox, combobox, menuitem, option, radio, searchbox, slider, spinbutton, switch, tab, textbox, treeitem) has no name in the aria snapshot text                                                                                                                                                                | An icon-font glyph in the name counts as a name. Only the main page is read; shadow DOM and iframes are not visited                                                                                                                                                                                                 | no / no                                                                         |
| O-A11Y    | `dangling-aria-reference`        | `aria-labelledby` or `aria-describedby` on a visible element lists an id that does not exist in the DOM. This is the MM-71785 class                                                                                                                                                                                                                              | `aria-controls` is deliberately not checked (popup ids are absent until open). Hover-driven tooltip ids can be transiently absent, so the class is timing-sensitive: the header-update control run flags `rhsCloseButton` at one checkpoint while the Info-panel traversal does not. Invisible elements are skipped | no / no                                                                         |
| O-A11Y    | `duplicate-landmark`             | Two or more landmarks (banner, complementary, contentinfo, form, main, navigation, region, search) share role and name. Unnamed `form` and `region` are not landmarks and are not counted                                                                                                                                                                        | Counts landmarks in the whole snapshot, including open panels                                                                                                                                                                                                                                                       | no / no                                                                         |
| O-A11Y    | `dialog-without-name`            | A `dialog` or `alertdialog` node has no name                                                                                                                                                                                                                                                                                                                     | None known beyond the snapshot's own name computation                                                                                                                                                                                                                                                               | no / no                                                                         |
| O-UIREST  | `ui-rest-mismatch`               | A `check.json` finds a UI value and a REST field that disagree. The disagreement must persist for `settle_ms` (default 2.5 s) before it is reported, so a UI that is about to update is not a mismatch                                                                                                                                                           | **Blind to a fault on an endpoint that both the UI and the REST read use** (F8a below). Text-based, so markdown or emoji rendering can differ from the raw field. A stale UI that converges within the window is not seen. Selectors are tied to the current DOM                                                    | no / no                                                                         |
| O-MODAL   | `enter-submits-while-disabled`   | With the confirm button disabled, Enter in the field dispatched a state-changing request (POST, PUT, PATCH, DELETE) during the probe. Requests already seen in a 400 ms baseline window, and the default background poll `POST /api/v4/users/status/ids`, are not attributed. An optional `submitPaths` list restricts the check to the declared submit endpoint | A live probe first reported the background poll as a submit, which is why the baseline and ignore list exist. Any other unrelated request in the window is still attributed unless `submitPaths` is given                                                                                                           | **Enter**; typing only when the form must be filled to reach the disabled state |
| O-MODAL   | `non-ok-submit-without-feedback` | A submit that returned non-2xx closed the dialog and showed no visible error text. Passing needs error text (`role=alert`, error classes or caller selectors) or an open dialog; an open dialog without text is reported as the weaker `dialog-open`                                                                                                             | Heuristic selectors. `forceStatus` answers the request from the harness, so it tests the client's error path, not the server's                                                                                                                                                                                      | **Typing and Enter** (the confirm button usually needs text first)              |

**Typing/Enter-dependent oracles: O-MODAL only.** Both of its checks need the explorer's future text-input and key-press capability. The Enter probe needs only the Enter key when the confirm button is disabled by default, which is why it already runs on the live Create-channel dialog without typing. The non-2xx feedback check needs typing to enable the confirm button. The cluster MM-71783/71784/71786/71787/71788 is encoded here as a reusable harness, not as a journey; none of those tickets was reproduced on 12.1.0 by this work.

### `check.json` (UI versus REST)

```json
{
    "schema": "explorer-oracle-check/v1",
    "id": "channel-display-name-vs-rest",
    "subjects": {"from": "manifest.channels", "as": "channel", "where": {"archived": false}},
    "applies_when": {
        "url_path_regex": "^/[^/]+/(channels|threads|drafts)",
        "visible": {"role": "application", "name": "channel sidebar region"}
    },
    "ui": {
        "locator": {
            "css": "a[href$=\"/channels/{channel.name}\"]",
            "within": {"role": "application", "name": "channel sidebar region"}
        },
        "read": "text",
        "normalize": ["strip-private-use", "collapse-whitespace", "trim"],
        "required": true
    },
    "rest": {"method": "GET", "path": "/api/v4/channels/{channel.id}", "field": "display_name"},
    "rule": {"op": "equals"},
    "settle_ms": 2500
}
```

- Subjects come from the seed manifest (`name` and `id` only; the UI expectation is never taken from the manifest's display values). `match_current_path` keeps only the subject whose field equals the current pathname.
- Locators: `css`, `role` + `name` + `exact`, `testid` or `text`, with optional `within` and `first`. Templates are `{subject.field}`.
- `ui.read`: `text`, `text-all`, `value` or `attr:<name>`. `normalize` ops: `trim`, `collapse-whitespace`, `strip-private-use`, `lowercase`, `strip-suffix:<s>`.
- `rest.field`: a dotted path, `[]` maps over an array, or a list of fields (each is its own subject result). The REST call is a same-origin `GET` with the session's cookies; a template that leaves the origin is rejected by `validateCheck` and at run time.
- `rule.op`: `equals`, `contains` (UI text contains the REST value) or `equals-list` (multiset equality).
- Results per subject: `pass`, `mismatch` (becomes a finding), `not-applicable`, `vacuous` (for example both bookmark lists empty, reported as such, never as a pass) or `error` (REST status not expected; not a finding).
- Shipped checks: `channel-display-name.check.json` (sidebar label versus `GET /api/v4/channels/{id}`), `channel-purpose-header.check.json` (Info panel text contains purpose and header from the same endpoint) and `bookmark-titles.check.json` (bookmark bar titles versus `GET /api/v4/channels/{id}/bookmarks`).
- `attachOracles(..., {restOrigin})` lets the REST read use another loopback origin. Fault runs point it at the unfaulted forwarder so the truth does not pass through the fault layer.

## Fault injection (SYNTHETIC)

Every fault, config, log line and result row is labelled SYNTHETIC or INJECTED. Default is OFF: `faults/default.json` has `"enabled": false`, and the proxy refuses to start unless the config says `"synthetic": true` and `"enabled": true`.

```bash
node explorer-proto/v2/oracles/faults/run.mjs --config=explorer-proto/v2/oracles/faults/f1-drop-channel-display-name.json \
    --upstream-port=<forwarder port> --log=<fault-log.jsonl> --port-file=<file>
# then point the explorer or a spec at the listening port (read from --port-file; it is never printed):
PW_BASE_URL=http://127.0.0.1:<port> node explorer-proto/src/cli.ts explore
```

| Kind                                   | Fields                                                             | Effect                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `json_drop_field`, `json_rename_field` | `match.{method,path}`, `field` (dotted; arrays element-wise), `to` | Removes or renames a field in a 2xx JSON response                                                                |
| `http_error_after`                     | `after_hits`, `times`, `status`                                    | The first `after_hits` matching requests pass; later ones get `status` (default 500) without reaching the server |
| `http_delay`                           | `delay_ms`                                                         | Holds a matching response                                                                                        |
| `ws_drop`                              | `event`, `renumber_seq` (default true)                             | Drops WebSocket messages whose JSON `event` matches and renumbers later `seq` so the client sees no gap          |
| `ws_delay`                             | `event`, `delay_ms`, `preserve_order` (default true)               | Holds a matching message; by default later messages queue behind it                                              |

`match.path` is a glob over the pathname (`*` = one segment, `**` = any). The **fault log** (`--log`, also kept in memory) has one line per activation, no timestamps, ids or ports: `{"label":"SYNTHETIC-INJECTED","seq":1,"rule":"...","kind":"...","method":"GET","path":"/api/v4/channels/<id>/bookmarks","detail":"dropped field=display_name"}`. Activation counts are copied into `measurement.json`, so every faulted result is labelled `INJECTED (SYNTHETIC)`, and a fault that never activated would be visible as such.

**Why a reverse proxy.** The proxy listens on `127.0.0.1:0` and connects only to `127.0.0.1:<forwarder port>`. The browser, the exact-origin guard and the WebSocket upgrade see one ordinary loopback origin, the proxy's, because the guard derives its allowed origin from `PW_BASE_URL`; nothing in the guard changes, and any spec or explorer run works unmodified (spec-independent). The stack stays internal-only: no container, network or port changes, no new listener beyond loopback, and the proxy exits on a non-loopback bind. A Playwright route layer was set aside because it would have to `route.fetch` and `fulfill` on its own, skipping the guard's redirect and hop checks for those requests, it exists per context and per spec, and its WebSocket hooks would compete with the guard's. Editing `forwarder.mjs` is infra's.

How it keeps the stack working: it asks the server for identity encoding so JSON can be rewritten; it strips `Sec-WebSocket-Extensions` so frames are not compressed; it rewrites `Origin`, `Referer` and `Host` to the configured SiteURL origin (default `http://127.0.0.1:8065`, `ORACLE_SITE_ORIGIN`) because Mattermost checks the WebSocket origin; it rewrites `Location` back; it opens a fresh upstream connection per request and never times out idle client connections (pooled sockets caused `socket hang up` in an early run). It parses server-to-client WebSocket frames only when a `ws_*` rule matches the path; client-to-server bytes are piped raw.

Limits: SiteURL values inside response bodies (a bookmark's `link_url`) are not rewritten, so a click on such a link leaves the proxy origin and the guard blocks it; JSON mutation applies to 2xx JSON only; the proxy cannot make the server itself wrong.

## Harness artefact found: the guard blocks the app's WebSocket

Under the unmodified guard the app's WebSocket **never connects** in Chromium 151 (the build used here): every attempt ends with `net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`, the app retries every few seconds and fails every time, and real-time updates are dead. Without a browser flag, every guarded run therefore carries findings that are artefacts of the harness. A direct comparison (unguarded context, same stack) connects and receives frames. Likely cause, not proven here: the guard answers every document with `route.fulfill`, so Chromium has no peer address for the page and classifies it as a non-local origin that may not open a loopback socket. `guard-check` still passes because it only asserts that a WebSocket attempt targets the allowed origin.

`playwright.config.ts` in this directory therefore adds `--disable-features=LocalNetworkAccessChecks` to the browser launch args (`ORACLE_LNA_WORKAROUND=0` removes it). Only that flag differs from the pilot's config; the guard is untouched and still blocks other origins (see Self-test). The measurement runs every traversal once without the flag; the extra findings appear in `results/measurement.md`. The same flag in the engine's config, or serving the document without `fulfill`, would fix the same problem for explore and replay. That decision belongs to the engine owner.

## Measurement

`measure.mjs` ran on a freshly seeded Enterprise 12.1.0 stack (image `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae2...ade0e7`, started through `stack.sh` with `ORACLE_MM_IMAGE` set to that digest, `IsLicensed === 'true'` PASS). The full output is `results/measurement.md` and `results/measurement.json`, with every findings file under `results/clean/`, `results/clean-without-browser-flag/` and `results/faults/`. The five traversals are **measurement scripts, not discovery**: fixed hand-written Playwright steps (visit the sidebar channels, open and close the Info panel, open the channel menu, open Threads, open Drafts).

### Clean-build false positives (default seed, unfaulted, each traversal run 3 times)

| Traversal           | Actions | O-CONSOLE | O-NET | O-A11Y       | O-UIREST | O-MODAL |
| ------------------- | ------- | --------- | ----- | ------------ | -------- | ------- |
| T1 sidebar channels | 6       | 0         | 0     | 7 (7 in 3/3) | 0        | not run |
| T2 Info panel       | 8       | 0         | 0     | 7 (7 in 3/3) | 0        | not run |
| T3 channel menu     | 5       | 0         | 0     | 2 (2 in 3/3) | 0        | not run |
| T4 Threads          | 2       | 0         | 0     | 2 (2 in 3/3) | 0        | not run |
| T5 Drafts           | 2       | 0         | 0     | 1 (1 in 3/3) | 0        | not run |

Every finding repeated in 3 of 3 runs; none was flaky. There were no console errors, no HTTP errors, no WebSocket errors or closes, no UI-versus-REST mismatch, and no oracle-internal error in 18 runs. The O-A11Y findings are of three kinds (each listed with its path in `measurement.md`; none is allowlisted):

1. `dangling-aria-reference`: the post-time permalink `<a id="CENTER_time_...">` has `aria-labelledby` set to a numeric id (a timestamp) that exists nowhere in the DOM. It appears on every post in every channel (this is the large majority of rows). A live probe showed that hovering adds a different `aria-describedby` and never creates the id. Same class as MM-71785; `benign-hints.json` marks it as an allowlist candidate once triaged, because it would otherwise repeat on every post.
2. `duplicate-landmark`: with the Info panel open, two `region` landmarks are both named `scrollable content` (sidebar and panel). Stable; low severity.
3. Outside the five-traversal table, an extra live probe (`X1`, 3 runs): `combobox has an empty accessible name in dialog "Create a new channel"` (the category chooser), stable. The same probe pressed Enter in the empty name field while Create channel was disabled: **no request was dispatched, so O-MODAL reported nothing on the live dialog** (3 of 3).

Checks evaluated in the clean runs: display name versus REST: 168 pass, 15 not applicable; purpose/header versus REST: 18 pass, 90 not applicable (needs Info open); bookmark titles: 60 **vacuous**, 21 not applicable (the default seed has no bookmarks). The bookmark check is non-vacuous only with the bookmarks session seed: in the F8b control run it passes 4 of 4 and under fault it mismatches 4 of 4.

Finding sets depend on the seed: how Mattermost groups the seeded system messages changes the shape of the post ids inside the `CENTER_time_` evidence, so a re-seeded stack can show one more or one fewer distinct row for the same defect. Within one stack the runs are byte-identical.

### Injected-fault detection (SYNTHETIC, all INJECTED)

Time-to-detect counts actions from the action at which the fault first becomes observable to the action of the first matching finding. "New" means not present in a control run of the same script through the same layer with zero rules.

| Fault                                                                                  | Mechanism   | Expected oracle  | Result     | First seen at action | Time-to-detect (actions) |
| -------------------------------------------------------------------------------------- | ----------- | ---------------- | ---------- | -------------------- | ------------------------ |
| F1 `display_name` dropped from the channels list response                              | proxy       | O-UIREST         | DETECTED   | 0                    | 0                        |
| F2 HTTP 500 on every posts fetch                                                       | proxy       | O-NET `http-5xx` | DETECTED   | 0                    | 0                        |
| F3 `channel_updated` WebSocket event delayed 6 s                                       | proxy       | O-UIREST         | DETECTED   | 2                    | 0                        |
| S4 `aria-labelledby` with a dangling id, injected by a DOM mutation script (self-test) | page script | O-A11Y           | DETECTED   | 0                    | 0                        |
| S5 `console.error` injected at action 2 (self-test)                                    | page script | O-CONSOLE        | DETECTED   | 2                    | 0                        |
| S6 Enter submits while confirm is disabled (local static fixture, self-test)           | fixture     | O-MODAL          | DETECTED   | 1                    | 0                        |
| F7 `channel_updated` WebSocket event dropped, no seq gap                               | proxy       | O-UIREST         | DETECTED   | 2                    | 0                        |
| F8b `display_name` dropped from the bookmarks response, REST read direct               | proxy       | O-UIREST         | DETECTED   | 0                    | 0                        |
| F8a same fault, but the oracle's REST read goes through the same fault layer           | proxy       | O-UIREST         | **MISSED** | n/a                  | n/a                      |
| F9 channels list response delayed 3 s                                                  | proxy       | none exists      | **MISSED** | n/a                  | n/a                      |

- **8 of 10 detected; both misses are blind spots by design, not bugs to hide.** F8a: when the fault corrupts the endpoint that the UI and the REST read both use, the two sides agree (passes 4 of 4). That is why fault runs read the truth from the unfaulted forwarder. A server that is consistently wrong is invisible to UI-versus-REST. F9: no oracle measures latency; the fault layer activated (2 delayed responses) and nothing in the findings changed.
- F1 also made the scripted click fail (the sidebar link name changed) and crashed the app with `TypeError ... reading 'localeCompare'`; both are reported, the second as a new O-CONSOLE finding. The oracle detected the fault at the initial load, before the script broke.
- F3 and F7 changed a channel header through the admin REST API; the stale UI exceeded the 2.5 s settle window. Their control runs (same proxy, no rules) pass the same check. The script deletes the system posts it creates, so the seed is unchanged.
- S4 and S5 are oracle self-tests on the live page, S6 on a fixture; they prove the oracles fire, not that the product has such bugs. The first S4 attempt threw in its own injection script and O-CONSOLE reported it as an uncaught exception.
- Not covered: **layout bugs** (no oracle or fault concerns geometry), anything that needs vision, and a server-side defect that is consistent across endpoints.

### Determinism

Each traversal's three repeats and each fault's two runs were compared byte for byte:

| Set                              | Strict bytes | Ignoring `count` |
| -------------------------------- | ------------ | ---------------- |
| 18 clean runs (6 traversals x 3) | identical    | identical        |
| 10 faults x 2 runs               | identical    | identical        |

One of three full measurement runs showed F2 differ between its two runs, in `count` only (8 versus 9 retried posts requests): event counts follow how often the app retries, so byte identity is guaranteed for the finding identity, `first_action` and state-oracle counts, but not for event counts when the app retries under a fault. The report therefore prints both columns. Earlier builds also showed three real causes, now fixed: React-generated ids (`_r_..._`) in evidence, counts that grew with the number of posts a data-changing script had added, and a WebSocket-close race.

### Self-test

`node explorer-proto/v2/oracles/selftest.mjs`: 50 tests, all passing (scrubber, sink, frames, each oracle with positive and negative fixtures, the proxy, and the guard). The guard tests use the pilot's own `guardedBrowser` with a second loopback origin: fetch, image and WebSocket to it fail, navigation to it is blocked (`ERR_BLOCKED_BY_CLIENT`), the second server receives zero requests and zero upgrades, no violation is recorded, and a page registering a service worker never causes its script to be requested. The proxy tests show the guard and WebSocket pass-through working through the proxy origin while the forwarder's origin stays blocked. The pilot's own `cli.ts guard-check` also passed 3 of 3 on the live stack.

## Limits

- **False-positive risk.** On a clean build the oracles produced no console, network or UI-versus-REST noise, but 19 distinct O-A11Y rows across the five traversals that are real, stable and repetitive; without triage and an allowlist an explorer would report them every time. Hover-driven tooltip ids make `dangling-aria-reference` timing-sensitive. Markdown, emoji and truncation can make O-UIREST disagree with a raw field. O-MODAL attributes any unrelated state-changing request inside its window unless `submitPaths` is set.
- **Only 12.1.0 was run.** A main-branch image will be added later; `ORACLE_MM_IMAGE` exists for that and has not been exercised with any other image.
- **No vision and no layout coverage.** There is no fault or oracle for layout, colour, overlap or truncation.
- **Typing-dependent coverage is open.** The non-2xx feedback half of O-MODAL has only been run on a fixture; the live Create-channel dialog was probed with Enter only.
- **Faults are synthetic.** Detection of an injected fault says the oracle can see that class of corruption, not that the product has it. Detection scenarios were chosen to match oracles, so 8 of 10 is not a recall estimate.
- **The REST oracle reads through the session's cookies**, so a bug that only the logged-out API shows is out of reach.
- **One browser flag differs from the pilot's config** (see the harness artefact above).
- `selftest.mjs` is 915 lines and triggers the repo's `max-lines` warning (800); no errors.

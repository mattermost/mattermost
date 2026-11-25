# Known limits (lean v2)

Honest record of what this lean design does NOT do, with evidence, so the benchmark is not read as "lean wins
everything."

## 1. observe-actions over-reports without type info

The spec rule is AST-only (no `ts.createProgram`), so it cannot always tell that a page-object helper observes an
action. Over a 247-file corpus it reported 26 findings across 15 files that Peter's type-aware rule did not
(`bench/results/observe-compare.json`). It has **no false negatives on straight-line code**; the remaining false
positives are: an observation reached only through a loop that may run zero times; an action observed by a helper the
rule cannot see as observing; and `break`/`continue` treated as ending their path.

## 2. Key-origin is heuristic, not type-proven

`key-origin` resolves local aliases, destructuring and member chains **within one file** and classifies by field name.
It does not prove the key's TypeScript type, and does not follow more than simple cross-module imports. It rejects
index/display/composite keys and accepts `id`/`*Id`/`section`; an unusual identity field needs an allow-list entry.
Peter proves origins against registered entity types. (Lean is stricter on array-index keys, which it rejects and Peter
permits.)

## 3. Plugin slots: 3 of 13 verified

`app_bar_button`, `marketplace_plugin_item` and `rhs_panel` render their `data-surface` and are verified. The other 10
slots are annotated in `plugin-slots.json` with their host render file and an explicit `reason`; verifying them means
instrumenting each plugin host render point with a keyed `data-surface`, which is follow-up webapp work. The
host-contract diff still gates breaking removals for all 13.

## 4. Spec auto-migration coverage is low

`ui-surface migrate-spec` over 443 specs: 101 reference testids (1,119 calls), of which only 81 calls across 16 specs
map to a surface part (via the 29-entry drift map); 2 specs are fully auto-mappable, 14 partially
(`bench/results/spec-migration.json`). Most spec selectors point at elements that do not yet carry `data-surface`, so a
"+20-40 specs" automatic increment is not achievable today — the honest per-spec effort is manual until more elements
are instrumented. No mass spec rewrite is committed.

## 5. Live Playwright run not executed in this sandbox

Migrated specs need a webapp built from this branch (the shared 12.x test server has no `data-surface`).
`scripts/run-migrated-spec.sh` builds the webapp and runs one spec against a Testcontainers server, but a full webapp
build + server boot was not run here. The `data-surface` + lookup path **is** verified at the unit level: the migrated
demo Jest tests pass (`share_channel_with_workspaces` 10/10, `channel_settings_configuration_tab` 71/71). No live E2E
pass is claimed.

## 6. testid-testid migration demo only

`migrate-testid` was applied only to the `share_channel_with_workspaces` demo area (component + its tests), proving the
round-trip. Legacy Jest/Cypress tests elsewhere are untouched, by constraint.

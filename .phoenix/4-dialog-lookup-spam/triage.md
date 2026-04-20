# Triage Report — Issue #4 (mattermost)

**Rev:** 1
**Generated:** 2026-04-21
**Scout mode:** full

## Summary

A dynamic select field configured with `data_source: "dynamic"` and `refresh: true` fires its server-side lookup on every keystroke in *every other field* of the same dialog (text, textarea, radio, bool). Root cause is a stale-object-identity bug in `AppsForm.renderElements()`: `createSanitizedField(originalField)` returns a fresh object on every parent re-render, which trips `AppsFormSelectField.getDerivedStateFromProps` into generating a new `refreshNonce`, which remounts the `<React.Fragment key={refreshNonce}>` wrapping the `AsyncSelect`. `AsyncSelect` with `defaultOptions={true}` eagerly calls `loadOptions('')` on mount → `performLookup` → `/lookup` HTTP request on every keystroke.

## Phase A — Code map

### A.1 Search radius
- Indexed repos: 11 total. Issue filed against `mattermost`; UI symptom lives entirely in the web client; no other indexed repo is a candidate. Group membership: not applicable (mattermost is not grouped).
- Chosen radius: `mattermost` only.

### A.2 Signals mapped to code

| Signal | Hit | Repo | File |
|---|---|---|---|
| Dialog with `refresh: true` / `data_source: "dynamic"` is routed through the Apps form | `DialogRouter` → `InteractiveDialogAdapter` (when `isAppsFormEnabled`) | mattermost | `/Users/shashank/Canonix/phoenix-test/mattermost/webapp/channels/src/components/dialog_router/dialog_router.tsx:29-31` |
| Dialog → AppField conversion copies `refresh` (only for SELECT/RADIO) | `convertElement` | mattermost | `/Users/shashank/Canonix/phoenix-test/mattermost/webapp/channels/src/utils/dialog_conversion.ts:420-440` |
| `refresh`-triggered form fetch (legit path — by design, scoped to `field.refresh`) | `AppsForm.onChange` | mattermost | `/Users/shashank/Canonix/phoenix-test/mattermost/webapp/channels/src/components/apps_form/apps_form_component.tsx:485-533` |
| **Bug site #1 — fresh object per render** | `AppsForm.renderElements` calls `createSanitizedField(originalField)` inline | mattermost | `/Users/shashank/Canonix/phoenix-test/mattermost/webapp/channels/src/components/apps_form/apps_form_component.tsx:659-662` |
| **Bug site #2 — remount trigger** | `getDerivedStateFromProps` regenerates `refreshNonce` whenever `field` prop reference changes | mattermost | `/Users/shashank/Canonix/phoenix-test/mattermost/webapp/channels/src/components/apps_form/apps_form_field/apps_form_select_field.tsx:75-84` |
| **Bug site #3 — remount consumer** | `<React.Fragment key={this.state.refreshNonce}>` wraps `AsyncSelect` with `defaultOptions={true}`, causing eager `loadOptions('')` on every mount | mattermost | `/Users/shashank/Canonix/phoenix-test/mattermost/webapp/channels/src/components/apps_form/apps_form_field/apps_form_select_field.tsx:114-135, 238-243, 90-92` |
| Lookup call pipeline (fires HTTP request) | `performLookup` → `performLookupCall` (container) → adapter `performLookupCall` → `lookupInteractiveDialog` action | mattermost | `apps_form_component.tsx:397-406`; `apps_form_container.tsx:168-192`; `dialog_router/interactive_dialog_adapter.tsx:390-511` |

### A.3 Interpreting misses
All signals mapped cleanly in the home repo. `field.refresh` is **not** being set on text/textarea/bool in the conversion step (that path is correct), and `AppsForm.onChange` correctly guards with `if (field.refresh)` — so the refresh-form submission (`/refresh`) is NOT the source of the "tons of requests". The offending call is the **lookup** (`/lookup` via `lookupInteractiveDialog`), driven by the `AsyncSelect` remount. This matches the issue title ("Lookup triggers on input…").

### A.4 Affected repos
- `mattermost` — the fix is entirely in the web client (`webapp/channels/src`). No server-side Go changes required for this specific defect.

## Phase B — Production log evidence

Not applicable. This is a browser-side React rendering bug; the observable artifact is an HTTP request storm in the browser devtools, not in server pod logs. The `kubectl` context is still `kind-canonix` but the symptom does not surface as pod-side errors or log lines (and the reporter explicitly left "Log Output" empty). I did not pull pod logs — they would not corroborate or refute a client-side remount loop. Runtime verification belongs in a Jest/RTL test asserting that `performLookup` is called once per dialog open, not per keystroke.

## Phase C — Recent commits on affected files

| SHA | Author | Date | File | Relevance |
|---|---|---|---|---|
| `5a0dee5fc2` ("Add date and datetime field support for AppsForm", PR #33288) | Scott Bishel | 2025-10-06 | `apps_form_component.tsx` | **Introduced `createSanitizedField` and wired it into `renderElements` at L659-661, creating a fresh object on every render.** This is the precipitating change that exposed the pre-existing remount logic. Confirmed via `git blame`. |
| `c943ed6859` ("Mono repo → Master") | Doug Lauder | 2023-03-22 | `apps_form_select_field.tsx` | Original `getDerivedStateFromProps`/`refreshNonce`/`<Fragment key>` pattern — harmless until paired with a parent that emits new `field` objects per render. |
| `abe8151bad` ("Add Dynamic Select for Interactive Dialog", PR #33586) | — | — | `dialog_conversion.ts` | Added `data_source: 'dynamic'` → `DYNAMIC_SELECT` conversion, enabling the `AsyncSelect` path for Interactive Dialogs. Not itself buggy. |
| `4ee339f43b` ("Update Interactive Dialog to use AppsForm", PR #31821) | — | — | `interactive_dialog_adapter.tsx` | Routes Interactive Dialogs into AppsForm, exposing them to the bug. |

The combination of commit `5a0dee5fc2` (Oct 2025) with the older `getDerivedStateFromProps` pattern is the proximate cause. Before `5a0dee5fc2`, `renderElements` passed `originalField` directly (stable reference from the form prop) and the remount logic was benign.

## Phase D — Prior incidents and fixes

- **Issue #35626** — "[Bug]: Lookup triggers on input in every field" (reporter: Deamor, closed 2026-04-09). **Same title, identical reproduction JSON, same Mattermost Server Version 11.3.0, same MacOS 15.7.2.** This is an exact prior incident.
- **PR #35640** — "Fix interactive dialog bugs: dynamic select lookups, radio values, field refresh" (author: sbishel, merged, milestone v11.7.0). Bundles five related fixes including #35626. The portion relevant to this issue:

  **Fix pattern (quoted from the merged PR):**
  1. Add a `sanitizedFieldCache: Map<AppField, AppField>` instance field on `AppsForm`.
  2. In `renderElements`, look up `originalField` in the cache first; compute and store only on miss. This preserves object identity across renders, so `getDerivedStateFromProps` in `AppsFormSelectField` no longer perceives a changed `field` prop and does not regenerate `refreshNonce`. `AsyncSelect` stays mounted, no spurious `loadOptions('')` call.
  3. Add `componentDidUpdate` that clears the cache when `prevProps.form !== this.props.form` (so multistep/refresh form transitions don't retain stale entries).

  Fix is ~20 added lines in `webapp/channels/src/components/apps_form/apps_form_component.tsx`. Patch also includes an unrelated radio-value coercion tweak in `apps_form_field.tsx` (L176-183) plus ancillary fixes for four other bugs — but only the cache change is required for this issue.

- The pinned mattermost commit for this triage is `6878d095476d3fdbbafd93ee4df99b79262af151`, which predates PR #35640 (merged after Mar 16 2026). The bug is live on the pinned tree.

## Phase E — Synthesis

### Hypothesis
`AppsForm.renderElements` creates a new `field` object per render via `createSanitizedField`. `AppsFormSelectField`'s `getDerivedStateFromProps` treats any new `field` reference as a reason to regenerate `refreshNonce`, which keys a `<React.Fragment>` around the `AsyncSelect`. Each parent re-render (every keystroke in any sibling field, because `AppsForm` owns `values` state and re-renders on `setState`) therefore remounts the `AsyncSelect`, which with `defaultOptions={true}` eagerly invokes `loadOptions('')` → `performLookup` → a network `/lookup` call. Fix: memoize sanitized fields by their original reference in an instance `Map`, invalidating on form replacement.

### Confidence: 0.95
- Prior identical incident (#35626) resolved by a merged fix (#35640) using the exact pattern above.
- Code trace on the pinned tree reproduces the defective object-identity chain end-to-end.
- No alternative hypothesis has equal explanatory power: the `refresh: true` form-level `/refresh` path is correctly gated on `field.refresh` and cannot explain lookup-endpoint calls; the lookup endpoint is only reachable via `AsyncSelect.loadOptions`, which is only auto-invoked on mount or user typing in the select's own input.

### Recommended next step
Apply the `sanitizedFieldCache` memoization in `AppsForm` exactly as in PR #35640, scoped to the object-identity fix. Do **not** bundle the radio/default-value/submission fixes from that PR (they address separate issues #35593/#35630/#35633/#35642 and are out of scope here). Add a regression test asserting `performLookupCall` is invoked zero times after typing in a sibling text field.

## Open questions
None blocking. Runtime verification (Phase B) is intentionally skipped as it would not add signal for a client-side remount loop.

---

<!--phoenix:scout-summary
affected_repos:
  - ShankHarinath/mattermost
confidence: 0.95
recommended_next_step: proceed
root_cause_file: webapp/channels/src/components/apps_form/apps_form_component.tsx
root_cause_symbol: AppsForm.renderElements
fix_strategy: memoize createSanitizedField by originalField reference in an instance Map; clear on form change
prior_fix_pr: https://github.com/mattermost/mattermost/pull/35640
prior_issue: https://github.com/mattermost/mattermost/issues/35626
-->

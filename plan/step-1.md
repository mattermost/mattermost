# Step 1 — Finalize and lock the supported-locale list

Parent: [summary.md](./summary.md) · Next: [step-2.md](./step-2.md)

## Goal

Freeze the supported locale set, make every surveyed surface agree on it,
normalize filenames, remove (or quarantine) experimental-only locales, and
land the **minimum** syntax/parity validators needed before the bulk
translation pass.

## Prerequisites

- Product/comms coordination on decision #1 (including Calls/Playbooks
  locale drops): **done** — no further signoff needed.
- Agreement on fallback behavior for users/servers pointing at dropped
  locales (`en` — decision #12).

## Locked inputs (subject to reopen)

- Core 22 codes: `bg de en en-AU es fa fr hu it ja ko nl pl pt-BR ro ru sv
  tr uk vi zh-CN zh-TW`
- Filename convention: hyphens (`en-AU.json`), matching webapp/server.
- Chinese mapping for Calls/Playbooks: `zh_Hans` → `zh-CN`, `zh_Hant` →
  `zh-TW` (verified by character-set inspection; treat as product
  compatibility, not BCP-47 purity).

## Concrete tasks

### 1.1 Inventory and freeze

- [ ] Publish a single normalized mapping table (code → display name →
  filename → Alpha/Beta label) owned in-repo.
- [ ] Diff each surface's on-disk files against the 22; include
  `ar_SA`/`ar-SA` variants and mixed hyphen/underscore names.
- [ ] Confirm `imports.ts` / generated import lists vs files on disk
  (webapp `langIDs` already omit some files — do not assume 64-on-disk
  means 64-exposed).

### 1.2 Calls reconciliation (file diffs verified)

Applies uniformly to `standalone/i18n/`, `webapp/i18n/`, `server/i18n/`:

- **Drop** (not in core 22): `ar`, `cs`, `hr`, `lt`, `nb-NO`/`nb_NO`, `uz`
- **Add** (missing from core 22): `bg`, `en-AU`, `hu`, `ro`
- Owner coordination for these drops is already complete — proceed with
  deletion; mention the change in the step-4 deprecation notice.

### 1.3 Playbooks reconciliation (diffs verified; locations disagree)

`webapp/i18n/` (23 files):

- Drop: `cs`, `hr`, `id`, `kk`, `ml`, `nb-NO`, `sl`
- Add: `bg`, `it`, `pt-BR`, `ro`, `uk`, `vi`

`assets/i18n/` (18 files):

- Drop: `cs`, `hr`, `id`, `mn`, `nb-NO`
- Add: `bg`, `en-AU`, `es`, `fr`, `it`, `pt-BR`, `ro`, `uk`, `vi`

- [ ] Resolve webapp-vs-assets disagreement in the same pass.

### 1.4 Filename / code normalization

- [ ] Rename mobile, desktop, Calls, Playbooks files to hyphen form.
- [ ] Update every import/require/generated loader (`i18n.ts`,
  `index.ts`, Makefile copy steps, asset bundlers).
- [ ] Map `zh_Hans`/`zh_Hant` → `zh-CN`/`zh-TW` with character-set spot
  check on the renamed files.

### 1.5 Experimental locales and config

- **Decided: delete immediately** — no archive/quarantine period; git
  history is the archive.
- [ ] Delete non-supported locale JSON from all surfaces in this step.
- [ ] Plan removal of `EnableExperimentalLocales` /
  `getAllLanguages(includeExperimental)` only after fallback tests exist.
- [ ] Keep `AvailableLocales` (restricts the supported set further).

### 1.6 Fallback migration tests

- [ ] Server: invalid / dropped `LocalizationSettings` → `en`
- [ ] Webapp selectors: unavailable current locale → default
- [ ] Mobile / desktop: unknown locale → `en`
- [ ] Existing user prefs and `AvailableLocales` containing dropped codes

### 1.7 Minimum validators (before step 2)

Do **not** block step 1 on a full Go CLDR-plural verifier or complete
authoring-tier metadata pipeline.

- [ ] Wire webapp's existing `i18n-verify-translations` into CI
  (`formatjs verify --source-locale en --missing-keys --structural-equality`).
  **Do not rely on `--extra-keys`** — it is not available on the pinned
  FormatJS CLIs surveyed; add a custom extra-key check if needed.
- [ ] Add `@formatjs/cli` to mobile and desktop **in the same change** as
  their verify scripts.
- [ ] Upgrade Calls/Playbooks `@formatjs/cli` if their pinned versions
  lack `verify` (Calls webapp ~5.0.7, Playbooks ~4.7.0 surveyed).
- [ ] Define canonical `mmgotool` ownership/release path **before**
  implementing plugin-dependent `i18n verify` (Calls →
  `mattermost/tools/mmgotool@latest`; Playbooks →
  `mattermost-utilities/mmgotool`).
- [ ] Optionally keep Calls `temp.json` extract artifact if step 2 will
  consume it immediately; otherwise defer.

### 1.8 Source-location tooling (deferred minimum)

- [ ] For step 2: prefer component-batched source grep + opportunistic
  `formatjs --extract-source-location`.
- [ ] Full sibling metadata files / `mmgotool` struct field extensions
  land when consumed, not as a gate on locale trim.

### 1.9 Out of scope (file separately)

- iOS `.lproj` / `InfoPlist.strings` empty + locale mismatch (`ar` vs
  `vi`) — pre-existing native wiring bug (decision #9).

## Challenges (verification pass)

| Assumption | Verdict | Evidence / rationale |
|------------|---------|----------------------|
| Force Calls/Playbooks onto core 22 | **Resolved — keep** | Was flagged as support removal needing coordination; product/comms coordination is confirmed complete, so proceed with the drops. |
| Delete experimental locales immediately | **Resolved — delete now** | Archive/hide was considered; owner decided immediate deletion (git history suffices). |
| Hyphen filenames + zh region mapping | **Keep (qualified)** | Fine as product convention; `zh-Hans`/`zh-Hant` are valid BCP-47 — document as aliasing. |
| Mobile/desktop are purely underscore | **False** | Mixed conventions today (`en_AU` alongside `pt-BR`/`zh-CN`). Normalization must inventory real names. |
| Full source-location tooling before bulk pass | **Revise** | Overbuilt for one-time pass; grep + formatjs source-location enough to start. |
| Scaffold `mmgotool verify` and plugins pick it up | **Reject as stated** | Two install sources; local platform change does not reach Playbooks' utilities pin. |
| English fallback already solid | **Keep + test** | Behavior exists across surfaces; still need explicit deleted-locale tests. |

## Risks

- Plugin-only locale users lose language support — accepted and already
  coordinated; ensure the step-4 notice mentions it so it isn't silent.
- Removing `EnableExperimentalLocales` changes admin console behavior and
  help text (coordinate with step 6).
- Filename renames without loader updates → runtime missing catalogs.
- Key parity alone still misses Playbooks-style English copy-paste
  (handled in steps 2–3).

## Acceptance criteria

- [ ] All surveyed surfaces expose exactly the agreed 22 (or an explicitly
  re-approved exception list).
- [ ] Filenames and loader maps use the hyphen convention consistently.
- [ ] Fallback tests for dropped locales pass on server + webapp at
  minimum; mobile/desktop covered or tracked.
- [ ] JS `formatjs verify` (missing-keys + structural-equality) runs in CI
  on at least webapp; other JS surfaces scheduled or landed.
- [ ] mmgotool release strategy documented before plugin verify depends on
  it.
- [ ] No bulk-translation credits spent on locales scheduled for deletion.

## Open questions

1. ~~Who signs off removing Calls/Playbooks-only locales?~~ **Resolved:
   no signoff needed — already coordinated.**
2. ~~Archive unsupported locale JSON until Weblate sunset, or delete
   now?~~ **Resolved: delete immediately.**
3. Which repo is the canonical released `mmgotool`?
4. ~~Should Chinese keep script tags internally with aliases?~~
   **Resolved: rename on disk to `zh-CN`/`zh-TW` only; no alias layer.**

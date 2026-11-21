# Channel Info panel: coverage ledger and pilot design (Phase 2)

- **Pinned SHA:** `f88f88cff6bc984076c605806621e8f5ff3717bc` (confirmed with `git rev-parse HEAD`; master, version 12.2.0 per `server/public/model/version.go:16` and `webapp/channels/package.json:6`).
- **Tested server:** `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7` with `postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5`, licensed (see section 9). The pinned checkout is unreleased 12.2.0; the server is the 12.1.0 release image.
- **Feature area:** Channel Info RHS, opened by the channel-header button `View Info` or the channel menu item `View Info`.
- **Machine-readable companion:** `explorer-proto/scenarios.json`.
- All paths are relative to the repo root. `CIR` = `webapp/channels/src/components/channel_info_rhs/`.
  `CY spec` = `e2e-tests/cypress/tests/integration/channels/channel/channel_info_rhs_spec.ts`.

## 1. Ground truth from source

### 1.1 Accessible names and roles

| Control / landmark | Role | Exact accessible name | Source |
| --- | --- | --- | --- |
| Header Info toggle (closed) | button | `View Info` | `components/channel_header/channel_info_button.tsx:50`, name = tooltip via `channel_header/components/header_icon_wrapper.tsx:65,93`; id `channel-info-btn` (:57) |
| Header Info toggle (Info, Members, Files or Pinned open) | button | `Close Info` | `channel_info_button.tsx:31-36,46-48` |
| Channel menu item | menuitem | `View Info` / `Close Info` | `components/channel_header_menu/menu_items/toggle_info.tsx:38-51` |
| RHS container | region | `Info` (aria-labelledby `rhsPanelTitle`) | `components/resizable_sidebar/resizable_rhs/index.tsx:96-99`; `#rhsPanelTitle` contains only `Info` (`CIR/header.tsx:45-52`) |
| RHS title | h2 | text `Info` + subtitle display name (no separator, so the heading name is concatenated) | `CIR/header.tsx:44-60` |
| RHS close | button | `Close Sidebar Icon` | `CIR/header.tsx:71-78` |
| Favorite / Mute | button (aria-pressed) | `Favorite` / `Mute` (constant at HEAD) | `CIR/top_buttons.tsx:103-108,131-151` |
| Add People | button | `Add People` | `CIR/top_buttons.tsx:153-171` |
| Copy Link | button | `Copy Link`, then `Copied` | `CIR/top_buttons.tsx:111-112,172-183` |
| All About-area edit affordances (rename, purpose, header, and empty placeholders) | button | `Edit` (aria-label overrides visible "Add a channel purpose" etc.) | `CIR/components/editable_area.tsx:66-74,77-85` |
| Info menu | navigation | `Channel Info Actions` | `CIR/menu.tsx:190-195` |
| Menu items | button | `Channel Settings`, `Notification Preferences`, `Members`, `Pinned messages`, `Files` (aria-label = text, so badges are NOT in the name) | `CIR/menu.tsx:93-99,196-248` |
| Archived notice | text | `This channel is archived.` (+ button `Unarchive` if permitted) | `CIR/channel_info_rhs.tsx:99-103,217-246` |
| Sidebar channel link | link | lowercased `<display name> public channel` (+ ` unread` / mention suffixes) | `components/sidebar/sidebar_channel/sidebar_channel_link/sidebar_channel_link.tsx:133-156,317-320`; `sidebar_base_channel.tsx:56-61,77-80` |
| Channel-header members button | button | `Members` (**collides** with the Info menu item) | `components/channel_header/channel_header.tsx:49,327-337` |

**"Topic":** no topic label exists in `CIR/` (grep for "topic" returns nothing). Mattermost channels have a **purpose** (`Channel Purpose`, `CIR/about_area_channel.tsx:96`) and a **header** (`Channel Header`, :108). Purpose display is already covered by CY-08, so a plain "purpose is shown" scenario is not a new gap.

### 1.2 What the panel renders per state (decision logic)

- Props come from the **current channel** (`CIR/index.ts:39`). Permissions: `manage_{public|private}_channel_members` / `_properties` (`CIR/index.ts:48-50`).
- `canEditChannelProperties = !isArchived && canManageProperties` (`CIR/channel_info_rhs.tsx:196`). `canAddPeople = !isArchived && canManageMembers` (:255); TopButtons also allows GM (`CIR/top_buttons.tsx:99`). Copy Link only for O/P (:101).
- About area dispatch by type (`CIR/about_area.tsx:52-72`). O/P: name (:133-141), purpose section if `purpose || canEdit` (:145), header section if `header || canEdit` (:169), handle (:193-199), ID (:200-206). DM: user, position or bot description, header unless bot (`CIR/about_area_dm.tsx:107-134`). GM: participants, header always editable (`CIR/about_area_gm.tsx:78-126`).
- Menu: Notification Preferences if not DM and not archived; Members if not DM; Channel Settings if O/P, not archived and `canAccessChannelSettings` (`CIR/menu.tsx:159-163`).
- Long content: `LineLimiter` maxLines=4, lineHeight=20 shows `more`/`less` (`CIR/components/linelimiter.tsx:32-45,65-72`).
- Length limits: purpose 250 runes, header 1024 runes (`server/public/model/channel.go:44-45,358-364`); UI maxLength 250 / 1024 (`edit_channel_purpose_modal.tsx:28,179`, `edit_channel_header_modal.tsx:28,173`).
- Default perms: `channel_user` has manage public/private members and properties (`server/public/model/role.go:965,974,979`); `manage_team` only in `team_admin` (:1080-1086).

### 1.3 State transitions

- Open: `showChannelInfo` sets `CHANNEL_INFO` + channelId (`webapp/channels/src/actions/views/rhs.ts:524-530`).
- Channel switch: `switchToChannel` re-targets only PIN and CHANNEL_FILES (`actions/global_actions.tsx:88,92`); SidebarRight closes only on team/product change (`components/sidebar_right/sidebar_right.tsx:240-253`); Info re-renders from current channel (:322-324).
- Reload: only `state.storage` is persisted (`reducers/storage.ts:154-161`); `rhsState` defaults to null (`reducers/views/rhs.ts:184`), `isSidebarOpen` to false (:353).
- Keyboard: Ctrl/Cmd+Alt+I (`sidebar_right.tsx:137-144`).

## 2. Merged existing-coverage ledger

Legend: **RV** = re-verified by me by reading the file at the pinned SHA. **IV** = taken from the inventory, not individually re-read. Line = `it(`/`test(` line unless noted.

### 2.1 Cypress (main)

| ID | File:line | What it asserts | Status | Verified |
| --- | --- | --- | --- | --- |
| CY-01 | CY spec:82 | admin, public; click `#channel-info-btn`; helper :536-541 checks `Info` + subtitle display name | ACTIVE | RV |
| CY-02 | CY spec:95 | tooltips Favorite/Mute/Add People/Copy Link | ACTIVE | RV |
| CY-03 | CY spec:120 | Favorite aria-pressed toggle | ACTIVE | RV |
| CY-04 | CY spec:133 | Mute aria-pressed toggle | ACTIVE | RV |
| CY-05 | CY spec:146 | Add People opens `.channel-invite` (admin) | ACTIVE | RV |
| CY-06 | CY spec:158 | regular user with manage members/properties removed from `channel_user` (:66-76): Add People absent. Does not check Edit. | ACTIVE | RV |
| CY-07 | CY spec:179 | Copy Link copies URL, shows `Copied` | ACTIVE | RV |
| CY-08 | CY spec:202 | API-patched purpose `purpose for the tests` visible in RHS | ACTIVE | RV |
| CY-09 | CY spec:215 | API-patched header visible in RHS | ACTIVE | RV |
| CY-10 | CY spec:228 | first `Edit` opens rename modal; save; pathname + header title updated | ACTIVE | RV |
| CY-11 | CY spec:263 | Notification Preferences opens modal | ACTIVE | RV |
| CY-12 | CY spec:276 | Channel Settings opens modal | ACTIVE | RV |
| CY-13 | CY spec:294 | Files sub-view + Back to Info | ACTIVE | RV |
| CY-14 | CY spec:313 | Pinned sub-view + Back | ACTIVE | RV |
| CY-15 | CY spec:340 | Members sub-view + Back | ACTIVE | RV |
| CY-16 | CY spec:365 | GM Favorite toggle | ACTIVE | RV |
| CY-17 | CY spec:378 | GM Mute toggle | ACTIVE | RV |
| CY-18 | CY spec:391 | GM Add People opens `.more-direct-channels` | ACTIVE | RV |
| CY-19 | CY spec:403 | GM Copy Link absent: `cy.uiGetRHS().get('Copy Link')` (:411) is a CSS tag selector that never matches, so it **passes vacuously** | ACTIVE, INVALID | RV |
| CY-20 | CY spec:415 | GM participant usernames | ACTIVE | RV |
| CY-21 | CY spec:426 | GM header | ACTIVE | RV |
| CY-22 | CY spec:442 | GM Notification Preferences opens modal | ACTIVE | RV |
| CY-23 | CY spec:460 | DM Favorite toggle | ACTIVE | RV |
| CY-24 | CY spec:473 | DM Mute toggle | ACTIVE | RV |
| CY-25 | CY spec:486 | DM Add People absent | ACTIVE | RV |
| CY-26 | CY spec:497 | DM Copy Link absent: same vacuous selector (:505) | ACTIVE, INVALID | RV |
| CY-27 | CY spec:509 | DM username + position | ACTIVE | RV |
| CY-28 | CY spec:519 | DM header | ACTIVE | RV |
| CY-29 | `keyboard_shortcuts/ctrl_cmd_alt_I_toggles_channel_info_rhs_spec.js:22` | Ctrl/Cmd+Alt+I opens then closes `#rhsContainer` with `Info` | ACTIVE | RV |
| CY-30 | `channel/open_rhs_coming_from_system_console_spec.ts:46` | Info title survives System Console round trip (title says KNOWN ISSUE MM-47226; still an active `it`) | ACTIVE | RV |
| CY-31 | `keyboard_shortcuts/ctrl_cmd_shift_slash/not_open_emoji_picker_spec.js:100` | regular user; menu `View Info` (:116), click `Edit` beside Channel Purpose/Header (:118), `Close Info` (:129) without asserting closure | ACTIVE | RV |
| CY-32 | `channel/channel_members_rhs_spec.ts:98` | from Members sub-view, switch to DM: RHS title `Info` (:111) | ACTIVE | RV |
| CY-33 (new) | `archived_channel/archive_channel_header_spec.ts:38` | MM-T1717: after archive, header **dropdown** hides Archive/Channel Settings/Notification Preferences. Not Info RHS. | ACTIVE, near-miss | RV |
| CY-34 (new) | `channel/channel_settings_modal_spec.ts:273,287` | MM-T7/T8: purpose >250 / header >1024 errors in Channel Settings modal. Not Info RHS. | ACTIVE, near-miss | RV |
| CY-35 (new) | `channel/leave_and_archive_channel_destructive_spec.ts:32` | channel menu lists `View Info` | ACTIVE, near-miss | RV |
| CY-36 (new) | `channel/channel_members_rhs_spec.ts:90` | `3 members` text in Members **sub-view** (not the Info badge) | ACTIVE, near-miss | RV |
| CY-37 (new) | `archived_channel/archive_channel_member_spec.ts:21` | MM-T1719: user created with `promoteNewUserAsAdmin: true` (:16), archives the channel (:32), opens header dropdown `#channelMembers` (:38), asserts `findByText('Manage')` does not exist in the RHS (:41). **Does not prove** anything about the Info panel: it is the Members view, the user is a system admin rather than a regular member, and it checks only the `Manage` text (no archived notice, Add People, Edit, menu items or Unarchive). | ACTIVE, near-miss | RV |
| CY-38 (new) | `channel/channel_members_rhs_spec.ts:116` | Members RHS opened from header `#member_rhs` (:120-121), switch to a DM (:127), asserts `#sidebar-right` does not exist (:130). **Does not prove** PILOT-01: Info is never opened, the target is a DM, and the assertion is that the RHS closes, not that Info content follows the new channel. | ACTIVE, near-miss | RV |
| — | `accessibility/accessibility_dropdowns_spec.js:33` (lists `View Info` at :60); `messaging/reactions_spec.js:124` (`Add a channel header` at :127 is the center header) | not Info RHS | — | RV |

### 2.2 Playwright (main)

| ID | File:line | What it asserts | Status | Verified |
| --- | --- | --- | --- | --- |
| PW-01 | `specs/functional/channels/channel_settings/channel_headers.spec.ts:59` (MM-T880) | header saved via intro modal; menu `View Info` (:89-91); header text in RHS (:94) | ACTIVE | RV |
| PW infra | `lib/src/ui/pages/channels.ts:364-379` `openChannelInfo()` | clicks `#channel-info-btn` unless `getByText('Info', {exact: true})` already visible in sidebarRight; asserts that text, then sidebarRight visible. **Correction:** it checks text, not a heading role. | — | RV |
| PW-02..21 | `channel_attribute_display.spec.ts` (11 tests, 8 `openChannelInfo` calls), `channel_attribute_editing.spec.ts` (10, 11 calls), `channel_attribute_display_flag_off.spec.ts` (1, 1), `channel_attribute_lifecycle.spec.ts` (6, 1), `system_console/global_attributes/channel_resource_configuration.spec.ts` (7, 3) | channel **attributes** inside Info only; grep confirms none assert purpose, header, member count or type | ACTIVE | RV (group level; per-test numbering IV) |
| PW-22 | `channel_attribute_display.spec.ts:195` | `test.fixme` thread header chips overflow | SKIPPED | RV |
| PW-23 | `channel_attribute_display.spec.ts:364` | `test.fixme` header chips overflow | SKIPPED | RV |
| PW-24 | `channel_attribute_editing.spec.ts:164` | `test.fixme` multiselect option header chips | SKIPPED | RV |
| PW-25 (new) | `channels/categories/managed_categories.spec.ts:358` | `test.fixme` favorite disabled in managed category (center header `#toggleFavorite`, not Info) | SKIPPED, near-miss | RV |
| PW-26 (new) | `channels/archived_channels/archived_channels.spec.ts:9` | MM-T1671: regular user from `pw.initSetup()` (`lib/src/server/init.ts:40-42`) archives the channel (:19), opens channel menu `Members` (:22-24), sees the admin in the list (:27), and `Manage` / `Add` buttons are not visible (:30-31; locators `sidebar_right.ts:67-68`). **Does not prove** PILOT-02: Members view, not Info; no archived notice, Add People, Edit, Notification Preferences, Channel Settings or Unarchive checks in the Info panel. | ACTIVE, near-miss | RV |
| — | `channels/messaging/group_message.spec.ts:9` | GM header in center header, not Info | — | RV |
| — | Upgrade specs | nothing about Channel Info | — | IV |

### 2.3 Peter stack (OPEN PRs by `praid3n`, not main; counted separately)

The stack is a 10-PR chain #40180 → #40181 → #40182 → #40211 → #40212 → #40213 → #40214 → #40215 → #40216 → #40217 (each based on the previous; confirmed with `gh pr list` and per-PR `git diff <parent-head> <pr-head>`). All OPEN.

| ID | PR | Change relevant to Info | Verified |
| --- | --- | --- | --- |
| PS-01 | #40212 | NEW `e2e-tests/playwright/specs/functional/channels/channel_info_rhs/channel_info_rhs.spec.ts:10-48`: regular member, public channel with random purpose; asserts header subtitle + about name = display name (:26-27), purpose (:28), handle (:29), id (:30); Mute pressed + server `mark_unread=mention` (:33-40); settings modal opens (:43-46) | RV (fetched `refs/pull/40212/head`) |
| PS-02 | #40182 | `channel_headers.spec.ts` +9/−9: page-object/helper swap; same assertions | RV |
| PS-03 | #40214 | attribute specs rewritten + new `channel_attributes/surface.ts`; no new Info assertions | RV (stat level) |
| PS-04 | #40217 | deletes hand-written page objects (`channels.ts` −551, `channel_attributes.ts` −192, `edit_channel_header_modal.ts` −44); `channel_headers.spec.ts` 14 lines | RV (stat level) |
| PS-05 | #40211 | Cypress testid rename `channel_info_rhs-menu` → `rhs.channel_info.menu` (6 places); also adds test ids in `CIR/*` and edits `channel_headers.spec.ts` (55 lines) | RV |
| PS-06 (new) | #40213 | `archive_channel_header_spec.ts` selector rename only | RV |

## 3. Scenario matrix (40 rows)

Techniques: **EP** equivalence partitioning, **BVA** boundary values, **ST** state transition, **DT** decision table.

| ID | Scenario | Tech | Status | Evidence |
| --- | --- | --- | --- | --- |
| MX-01 | Open via header `View Info`: title + subtitle | ST | COVERED | CY-01 |
| MX-02 | Open via channel menu `View Info` | ST | COVERED | PW-01 :89-94, CY-31 :116 |
| MX-03 | Toggle with Ctrl/Cmd+Alt+I | ST | COVERED | CY-29 |
| MX-04 | Close via header `Close Info` / `Close Sidebar Icon` | ST | OPEN_WITH_EVIDENCE | `channel_info_button.tsx:37-48`, `CIR/header.tsx:71-78`; CY-31/CY-12 click without asserting |
| **MX-05** | **Info open on A, sidebar switch to B: panel shows B, not A** | ST | **OPEN_WITH_EVIDENCE → proposed (PILOT-01)** | `CIR/index.ts:39`, `sidebar_right.tsx:240-253`, `global_actions.tsx:88,92`; near-misses CY-32 (title only), CY-38 (RHS closes on DM); newly verified by the pilot |
| MX-06 | Members sub-view → switch to DM → Info | ST | COVERED | CY-32 |
| MX-07 | Reload with Info open → not restored | ST | OPEN_WITH_EVIDENCE | `reducers/storage.ts:154-161`, `reducers/views/rhs.ts:184,353` |
| MX-08 | System Console round trip | ST | COVERED | CY-30 |
| MX-09 | Sub-views + Back | ST | COVERED | CY-13..15 |
| MX-10 | Switch team → RHS closes | ST | OPEN_WITH_EVIDENCE | `sidebar_right.tsx:247-253` |
| MX-11 | Purpose (normal) shown | EP | COVERED | CY-08 (admin); PS-01 (member) |
| MX-12 | Header (normal) shown | EP | COVERED | CY-09, PW-01 |
| MX-13 | About name + handle + ID | EP | COVERED_BY_OPEN_PR | PS-01 :26-30 |
| MX-14 | Empty purpose/header, editor → `Add a channel purpose/header` placeholders | EP×DT | OPEN_WITH_EVIDENCE | `CIR/about_area_channel.tsx:145,164,169,188`; `editable_area.tsx:66-74` |
| MX-15 | Empty purpose/header, non-editor → sections absent | DT | OPEN_WITH_EVIDENCE | `CIR/about_area_channel.tsx:145,169` |
| MX-16 | Markdown / special characters rendered | EP | OPEN_WITH_EVIDENCE | `CIR/about_area_channel.tsx:159,182` |
| MX-17 | Long/multiline → `more`/`less` | EP | OPEN_WITH_EVIDENCE | `linelimiter.tsx:32-45,65-72` |
| MX-18 | Purpose exactly 250 / header exactly 1024 displayed | BVA | OPEN_WITH_EVIDENCE | `channel.go:44-45` |
| MX-19 | Purpose 251 / header 1025 rejected | BVA | COVERED (outside panel) | `channel.go:358-364`; CY-34 |
| MX-20 | Private channel Info | EP | OPEN_WITH_EVIDENCE | `CIR/index.ts:48-50`; no e2e opens Info on `P` |
| **MX-21** | **Archived public, regular member: notice, read-only gating** | DT | **OPEN_WITH_EVIDENCE → proposed (PILOT-02)** | `CIR/channel_info_rhs.tsx:196,217-246,255`; `CIR/menu.tsx:159-161`; unit-only `channel_info_rhs.test.tsx:74`, `menu.test.tsx:98,291`; near-misses PW-26, CY-37 (Members view, not Info); newly verified by the pilot |
| MX-22 | Archived, team admin → `Unarchive` | DT | OPEN_WITH_EVIDENCE | `CIR/channel_info_rhs.tsx:201,225-240` |
| MX-23 | DM name/position/header; Add People absent | EP | COVERED | CY-25, CY-27, CY-28 |
| MX-24 | DM/GM Copy Link absent | EP | OPEN_WITH_EVIDENCE | CY-19/CY-26 vacuous; `top_buttons.tsx:101` |
| MX-25 | DM with bot: bot description, no header editor | EP | OPEN_WITH_EVIDENCE | `CIR/about_area_dm.tsx:107,111,116` |
| MX-26 | GM participants/header; Add People → DM modal | EP | COVERED | CY-18, CY-20, CY-21 |
| MX-27 | DM/GM menu item gating | DT | OPEN_WITH_EVIDENCE | `CIR/menu.tsx:159-161`; partial CY-22 |
| MX-28 | Favorite toggle (O/GM/DM) | ST | COVERED | CY-03, CY-16, CY-23 |
| MX-29 | Mute toggle (O/GM/DM) | ST | COVERED | CY-04, CY-17, CY-24 (+PS-01 server state) |
| MX-30 | Add People present + opens invite | DT | COVERED | CY-05 |
| MX-31 | Add People absent without members perm | DT | COVERED | CY-06 |
| MX-32 | Edit affordances absent without properties perm | DT | OPEN_WITH_EVIDENCE | `CIR/channel_info_rhs.tsx:196`; CY-06 only checks Add People |
| MX-33 | Rename / Edit purpose/header from panel | ST | COVERED | CY-10, CY-31 |
| MX-34 | Copy Link copies URL | ST | COVERED | CY-07 |
| MX-35 | Tooltips | EP | COVERED | CY-02 |
| MX-36 | Notification Preferences / Channel Settings from menu | ST | COVERED | CY-11, CY-12, CY-22 |
| MX-37 | Members badge = member count | EP | OPEN_WITH_EVIDENCE | `CIR/menu.tsx:215-226`; only sub-view count tested (CY-36) |
| MX-38 | Pinned badge = pinned count | EP | OPEN_WITH_EVIDENCE | `CIR/menu.tsx:227-236` |
| MX-39 | Favorite disabled in managed category | DT | UNVERIFIED | `top_buttons.tsx:115-124,134`; only PW-25 fixme; license + flag reachability unknown |
| MX-40 | Channel attributes block | DT | COVERED | PW-02..21 |

### 3.1 Decision table (public/private channels, plus DM/GM for contrast)

Conditions: **T** type, **A** archived, **M** manage members, **P** manage properties, **C** purpose present, **MT** manage_team (and, at HEAD, management policy allows).

| Rule | T | A | M | P | C | MT | Archived notice | Unarchive | Add People | Copy Link | Edit (any) | Purpose section | Notif. Prefs | Channel Settings | Members | Matrix / status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | O/P | N | Y | Y | Y | – | – | – | Y | Y | Y | text + Edit | Y | Y* | Y | MX-11/30/33 COVERED |
| R2 | O/P | N | Y | Y | N | – | – | – | Y | Y | Y | placeholder (name `Edit`) | Y | Y* | Y | MX-14 OPEN |
| R3 | O/P | N | N | N | Y | – | – | – | N | Y | N | text only | Y | Y* | Y | MX-31 COVERED (Add People) / MX-32 OPEN (Edit) |
| R4 | O/P | N | N | N | N | – | – | – | N | Y | N | absent | Y | Y* | Y | MX-15 OPEN |
| **R5** | O | **Y** | any | any | Y | **N** | **Y** | **N** | **N** | **Y** | **N** | **text only** | **N** | **N** | **Y** | **MX-21 PILOT-02** |
| R6 | O/P | Y | any | any | any | Y | Y | Y (not town-square) | N | Y | N | text only / absent | N | N | Y | MX-22 OPEN |
| R7 | DM | – | – | – | – | – | – | – | N | N | header `Edit` (non-bot) | n/a | N | N | N | MX-23 COVERED, MX-24/27 OPEN |
| R8 | GM | N | – | – | – | – | – | – | Y | N | header `Edit` | n/a | Y | N | Y | MX-26 COVERED |

`*` Channel Settings also requires `canAccessChannelSettings` (`CIR/menu.tsx:163`). Sources: `CIR/channel_info_rhs.tsx:196,217-255`, `CIR/top_buttons.tsx:99,101`, `CIR/about_area_channel.tsx:145,169`, `CIR/menu.tsx:159-161`, `CIR/about_area_dm.tsx:116`, `CIR/components/editable_area.tsx:60-86`.

### 3.2 State transitions

```
closed --View Info / menu View Info / Ctrl+Alt+I--> INFO(A)          [MX-01..03 COVERED]
INFO(A) --Close Info / X--> closed                                   [MX-04 OPEN]
INFO(A) --Ctrl+Alt+I--> closed                                       [MX-03 COVERED]
INFO(A) --sidebar click B (same team)--> INFO(B)                     [MX-05 PILOT-01]
MEMBERS(A, prev=Info) --go to DM--> INFO(DM)                         [MX-06 COVERED]
INFO(A) --System Console and back--> INFO(A)                         [MX-08 COVERED]
INFO(A) --reload--> closed                                           [MX-07 OPEN, incidental]
INFO(A) --switch team--> closed                                      [MX-10 OPEN]
INFO --Files/Pinned/Members--> sub-view --Back--> INFO               [MX-09 COVERED]
```

## 4. Counts

| Bucket | Count |
| --- | --- |
| Total scenarios assessed | 40 |
| COVERED (main) | 20 |
| COVERED_BY_OPEN_PR (Peter stack only) | 1 (MX-13) |
| OPEN_WITH_EVIDENCE (total) | 18 |
| … of which newly verified by the pilot | 2 (MX-05, MX-21) |
| … remaining open with evidence | 16 |
| UNVERIFIED | 1 (MX-39) |

Check: 20 + 1 + 2 + 16 + 1 = 40. Recomputed from the `matrix[]` rows in `scenarios.json` (status field, plus `pilot_id` for the two pilot rows).

The two pilot rows keep the matrix status `OPEN_WITH_EVIDENCE → proposed (PILOT-0x)` on purpose: `src/emit.ts` (`coverageStatus`, :151-159) reads that cell and skips any scenario whose status starts with `COVERED`, so marking them covered would dedupe the pilots away. "Newly verified" means the generated specs passed on the licensed 12.1.0 stack in the independent verifier run (not re-run in this ledger round); they are not yet merged tests, so they are not counted as COVERED.

## 5. Selected pilot scenarios

Full detail (allowlist, fixtures, assertions, negative controls, flake risks) is in `scenarios.json`. Summary:

### PILOT-01 (MX-05): the open Info panel follows the newly selected channel
- **Path:** go to `/qa-team/channels/qa-sandbox` → click button `View Info` → (check A) → click link `release planning public channel` → (check B).
- **Allowlist:** button `View Info`; link `release planning public channel`. Assertion-only locators: region `Info`, button `Close Info`.
- **Expected, scoped to region `Info`:** before the switch the panel contains `Sandbox purpose alpha-7f3c` and `Sandbox header alpha-7f3c`. After it, the URL is `/qa-team/channels/release-planning`, region `Info` is still visible, button `Close Info` is visible, and the panel contains `Release Planning`, `Release purpose bravo-91d2`, `Release header bravo-91d2` and `release-planning`, and does **not** contain either Sandbox string.
- **Negative control (verify gate):** `release-purpose-changed`, see 5.1. The earlier `swap-purpose-header` seed variant stays documented as an additional exploratory variant but is no longer part of the verify gate.
- **Why it is a real gap:** no spec on main opens Info, switches channel in-app and then asserts the new channel's Info content. CY-32 (`channel_members_rhs_spec.ts:98`) asserts only the fixed title `Info` (:111) after a Members-to-DM switch. CY-38 (`channel_members_rhs_spec.ts:116-130`) asserts only that the RHS closes when switching to a DM. The Playwright helper `openChannelInfo()` (`lib/src/ui/pages/channels.ts:364-379`) skips the click when the text `Info` is already visible, so it never exercises a switch with the panel open, and no Playwright spec asserts Info content after a channel switch.

### PILOT-02 (MX-21): archived public channel is read-only for a regular member
- **Path:** go to `/qa-team/channels/legacy-roadmap` (archived) → click button `View Info`.
- **Allowlist:** button `View Info` only.
- **Expected, scoped to region `Info`:** `This channel is archived.` is visible. The counts of buttons `Unarchive`, `Add People`, `Edit`, `Notification Preferences` and `Channel Settings` are all 0. The panel contains `Legacy purpose charlie-4e8a` and `Legacy header charlie-4e8a`, and buttons `Members` and `Copy Link` are visible.
- **Negative controls (verify gate):** `no-archive` and `team-admin`, see 5.1.
- **Why it is a real gap:** no spec opens the Info panel of an archived channel as a non-admin; only Jest unit tests with mocked props cover this. The nearest e2e tests check other components: CY-33 the header dropdown; PW-26 (MM-T1671, `archived_channels.spec.ts:9-31`) and CY-37 (MM-T1719, `archive_channel_member_spec.ts:41`, as a system admin) the read-only **Members** view of an archived channel, a different panel. `This channel is archived` has **0** hits under `e2e-tests/` (re-grepped: `rg -uu -i -c 'this channel is archived' e2e-tests/` and `git grep`, both empty).
- **Change 2026-11-21 (authorized by the coordinator, fix round 2):** the `Add People` absence check now matches the name by substring (`getByRole('button', {name: /Add People/})` inside region `Info`, `name_match: "contains"` in `scenarios.json`). Reason: the live 12.1.0 accessible name is `<icon glyph> Add People` (icon-font `<i>` without `aria-label`, `top_buttons.tsx:203` at `v12.1.0`), so the exact name could never detect presence and the count-0 check was vacuous. `Edit`, `Notification Preferences` and `Channel Settings` stay exact (names observed exactly in the live UI). `Unarchive` stays exact; evidence below.
- **Unarchive evidence (verified by independent verifier run; automated control added):** the source declares the `Unarchive` button inside the archived notice (`CIR/channel_info_rhs.tsx:217-256` at the pinned commit; at `v12.1.0` a plain `<button>` with no icon and no `aria-label`, `channel_info_rhs.tsx:226-237` at that tag), wrapped in `ChannelPermissionGate` for `manage_team` (:225-240 at the pinned commit), which only `team_admin` holds (`server/public/model/role.go:1086`). A regular member such as `qa-user` therefore never sees it, which is why the committed absence probe on the `no-archive` seed still reports it as not presentable (`generated/absence-probe-no-archive.md`). The independent verifier ran an extra control on the live licensed 12.1.0 stack that made `qa-user` a team admin; PILOT-02 then failed at the Unarchive count-0 assertion with `Received: 1`, so the exact locator `getByRole('button', {name: 'Unarchive', exact: true})` matches the live UI. `run-pilot.sh verify` re-runs this as the automated control `team-admin` (wired in verify, result reported in the pilot report). What this establishes: the assertion can detect the button when it is rendered. What it does not: the spec itself only asserts absence for a regular member; the Unarchive flow for a team admin (MX-22) stays open. The generated spec comment and the absence-probe text still print the emitter's own `UNCONFIRMED-BY-LIVE` label because the explorer, signed in as `qa-user`, never observes the button; that label comes from `src/assertions.ts:92-93`, not from this ledger.

### 5.1 Automated negative controls in `run-pilot.sh verify`

Each control is a **seed or role change that preserves navigation** (same URLs, same allowlisted clicks), applied before a **replay only** of the already-generated specs (no re-explore, no re-emit). The judge accepts a control only if the named scenario fails at exactly the listed assertion and the other scenario passes. Any other outcome, including an unrelated timeout, a location-less test timeout, a failing click, or a setup/seed/licence failure, counts as verification **FAILURE**, never as a pass.

| Control | Scenario | Change (admin API) | Expected result |
| --- | --- | --- | --- |
| `release-purpose-changed` | PILOT-01 | Change **only** the purpose of `release-planning` with `PUT /api/v4/channels/{id}/patch` to a string that does not contain `Release purpose bravo-91d2`; then, as `qa-user`, `POST /api/v4/channels/members/me/view` for `release-planning` and then `qa-sandbox`. Restore the seeded purpose (and re-mark viewed) afterwards. | PILOT-01 fails only at `expect.soft(info).toContainText('Release purpose bravo-91d2')`; the URL, region `Info` visible and `Close Info` assertions pass. PILOT-02 passes. |
| `no-archive` (seed variant) | PILOT-02 | Seed `legacy-roadmap` identically but skip the archive step. | PILOT-02 fails only at `expect(info.getByText('This channel is archived.', {exact: true})).toBeVisible()`. PILOT-01 passes. |
| `team-admin` | PILOT-02 | Make `qa-user` a team admin with `PUT /api/v4/teams/{team_id}/members/{user_id}/schemeRoles` (`scheme_admin: true`, `scheme_user: true`; the endpoint sets guest, user and admin together, `server/channels/api4/team.go:1381`). Restore `scheme_admin: false` afterwards (`infra/scripts/verify_seed.mjs:32` rejects a seed where `qa-user` is still a scheme admin). | PILOT-02 fails only at `expect(info.getByRole('button', {name: 'Unarchive', exact: true})).toHaveCount(0)` with `Received: 1`. PILOT-01 passes. |

- **Declared flakiness risk of `release-purpose-changed`:** a purpose patch posts a `system_purpose_change` message into the channel (`server/channels/app/channel.go:1162,2190-2208`), which makes `release-planning` unread for `qa-user`, and the sidebar link name gains ` unread` (`sidebar_channel_link.tsx:152-153`). The allowlisted click on the exact name `release planning public channel` would then time out. The control handles this by re-marking both channels viewed after the patch, in the seed's view order. If the click still times out, the control is a verification FAILURE (the unrelated-timeout rule above), not a pass.
- **Why `swap-purpose-header` left the gate:** under that seed six soft text assertions each wait the 10 s expect timeout, which together with setup exceeds the 60 s test timeout (`e2e-tests/playwright/playwright.config.ts:42,45`), so the run ends in a location-less test timeout instead of failing at named assertions. It remains documented as an additional exploratory seed variant (`infra/scripts/up.sh --variant=swap-purpose-header`).
- **Scope of these controls:** they show that the declared assertions are sensitive to **seed and role** changes. They are not product regressions, so they cannot show that a real stale-panel regression (PILOT-01) or a real permission-gating regression (PILOT-02) would be caught.
- At this branch's base commit (`bf1aca7986`), `run-pilot.sh` (`cmd_verify`, :380-417) still runs `swap-purpose-header` and `no-archive` only; `release-purpose-changed` and `team-admin` are being wired in verify by the runner owner, and their results are reported in the pilot report.

## 6. Next three candidates beyond the pilot

| # | Candidate | Setup needs | Fits pilot explorer rules? |
| --- | --- | --- | --- |
| 1 | MX-37 Members badge = seeded member count | 2 extra users in `qa-sandbox` (4 members); negative control: 3 | Partly. One control (`View Info`), but the badge is hidden from the accessibility name (`CIR/menu.tsx:96`), so the explorer cannot see it in snapshots; the assertion must read element text under region `Info` > button `Members` (the name is not unique page-wide, `channel_header.tsx:49`). |
| 2 | MX-15 + MX-32 member without manage_public_channel_properties: no Edit affordances, empty sections hidden | Patch `channel_user` role (server-wide) or a licensed channel scheme; one channel with content, one empty | No. The allowlist would fit (`View Info`, sidebar links), but the server-wide `channel_user` role change breaks the no-per-test-server-config rule and the single shared deterministic seed. |
| 3 | MX-17 long purpose: `more` / `less` | 6-line purpose (≤ 250 runes), fixed viewport | Yes: controls `View Info` and button `more` (unique if only purpose is long; no aria-label, so name = text). Layout threshold (`linelimiter.tsx:34`) makes it layout-dependent and the flakiest of the three. |

## 7. Rejected near-gaps (rationale)

- **Plain "purpose/header shown" (MX-11/12):** covered by CY-08/CY-09/PW-01 under equivalent conditions; a different runner or fixture value is not new coverage.
- **Handle and ID (MX-13):** proven by open PR #40212; would duplicate PS-01 if it merges.
- **Open via channel-name click (menu):** covered by CY-31 and PW-01 (channel menu → `View Info`).
- **Reload persistence (MX-07):** real but incidental (persistence simply excludes RHS state); no product contract to assert.
- **Switch team (MX-10):** needs a second team; pilot seed has one.
- **Empty-state placeholders (MX-14):** low risk; three buttons share the name `Edit`, so the allowlist cannot address them uniquely; the visible placeholder text is overridden in the accessible name.
- **Markdown/special characters (MX-16):** the panel just passes the string to the shared `<Markdown>` component, which has its own tests; little Info-specific risk.
- **BVA (MX-18/19):** rejection at 251/1025 is enforced by the server and the settings/edit modals (covered by CY-34); display at the limit is the same path as MX-17.
- **DM/GM Copy Link absent (MX-24):** real defect in existing tests (CY-19, CY-26 pass vacuously); the right fix is a one-line selector repair in Cypress, not a new pilot scenario.
- **Bot DM (MX-25), private channel (MX-20), pinned badge (MX-38), DM/GM menu gating (MX-27), close via button (MX-04):** genuine but lower-value or rendering-identical to covered cases; keep for later batches.
- **Archived + admin Unarchive (MX-22):** needs an admin session and, at HEAD, the management-policy hook (`CIR/channel_info_rhs.tsx:201`) that does not exist in v12.1.0, so expected behavior differs by release.
- **Managed category favorite (MX-39):** UNVERIFIED; needs license + feature flag and the only related test is a known-issue `test.fixme`.
- **Toggle-name drift:** in v12.1.0 Favorite/Mute rename to `Favorited`/`Muted` (`top_buttons.tsx:128,132` at tag `v12.1.0`), while HEAD keeps constant names with aria-pressed. Any allowlist using those buttons must be release-specific; both pilots avoid them.

## 8. Proposed file ownership map for `explorer-proto/`

| Owner | Paths | Responsibilities |
| --- | --- | --- |
| design (this phase) | `explorer-proto/coverage.md`, `explorer-proto/scenarios.json` | ledger, matrix, selected scenarios, assertions, dedupe keys |
| infra | `explorer-proto/infra/` (e.g. `docker-compose.yml`, `seed.ts` or `seed.sh`, `storage-state/qa-user.json`, `seed-manifest.json`) | Docker Compose for the pinned image + Postgres; deterministic REST seed; signed-in storageState; health wait on `/api/v4/system/ping` |
| engine | `explorer-proto/src/`, `explorer-proto/playwright.config.ts` | BFS explorer over accessibility snapshots restricted to the allowlist; spec emitter (inject declared assertions from `scenarios.json`); replay; network guard (allow only `localhost`); dedupe against `dedupe_key` |
| coordinator | `explorer-proto/README.md`, `explorer-proto/package.json` (scripts), one-command entry (e.g. `npm run pilot` → infra up, seed, explore, emit, replay) | wiring, docs, exit codes |

### 8.1 What infra must provide

- **Images (what ran):** `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7` + `postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5` (`infra/docker-compose.yml:9,26`). Licensed, no feature flags; outbound features off; details in section 9.
- **Team:** `qa-team` / "QA Team" (open).
- **Users:** `qa-admin` (system_admin, seeding only); `qa-user` (system_user, team_user) with the four onboarding preferences from `e2e-tests/playwright/lib/src/server/user.ts:71-78`.
- **Channels (all type O, members qa-admin + qa-user):**

| name | display_name | purpose | header | final state |
| --- | --- | --- | --- | --- |
| `qa-sandbox` | QA Sandbox | `Sandbox purpose alpha-7f3c` | `Sandbox header alpha-7f3c` | active, viewed by qa-user |
| `release-planning` | Release Planning | `Release purpose bravo-91d2` | `Release header bravo-91d2` | active, viewed by qa-user, no later posts |
| `legacy-roadmap` | Legacy Roadmap | `Legacy purpose charlie-4e8a` | `Legacy header charlie-4e8a` | archived (`DELETE /api/v4/channels/{id}`) after membership and patches |

- **Order:** create channels → add members → patch purpose/header → archive `legacy-roadmap` → as qa-user `POST /api/v4/channels/members/me/view` for `release-planning`, then `qa-sandbox` → write storageState. Emit a manifest with the generated ids and verify `delete_at > 0` for `legacy-roadmap`.
- **Negative controls:** seed variant `no-archive` (PILOT-02) plus the admin-API controls `release-purpose-changed` (PILOT-01) and `team-admin` (PILOT-02); see 5.1. Seed variant `swap-purpose-header` is exploratory only.

### 8.2 What engine must provide

- **Allowlist (union):** `button "View Info"` (exact), `link "release planning public channel"` (exact). Nothing else is clickable; no text inputs, so no fixed inputs are needed.
- **Assertion-only locators:** `region "Info"`, `button "Close Info"`, and inside region `Info`: `button "Add People"`, `button "Edit"`, `button "Notification Preferences"`, `button "Channel Settings"`, `button "Unarchive"`, `button "Members"`, `button "Copy Link"`.
- **Assertions:** exactly those declared in `scenarios.json` (`expected_outcome`). Every text assertion is scoped to region `Info`. Count-0 assertions run only after a positive visibility assertion has passed. Never derive expected values from an observed snapshot.
- **Uniqueness check:** fail the run if an allowlisted locator resolves to anything other than exactly 1 element (watch `Members`, which collides with the channel-header button).

## 9. Server setup and release pin (licensed Enterprise, what actually ran)

**Images:** `mattermost/mattermost-enterprise-edition:12.1.0@sha256:059c6ae272a7d54c1f38ed946fb6005aca7b02a096192800da8ee0bd79ade0e7` (linux/amd64) with `postgres:15.20@sha256:10f9e886f772e9d6484350b043bcf990ead67ae5d9988ddce265d72a299055d5` (`infra/docker-compose.yml:9,26`; same refs in `run-pilot.sh:20-21`). Both are pinned by digest and never pulled by the scripts.

**Licence:** the server is licensed through `MM_LICENSE`, passed through Compose by name only at runtime from the invoking shell (`infra/docker-compose.yml:53`). No licence value or length is recorded anywhere in this ledger. The licence check `IsLicensed === 'true'` is required: `run-pilot.sh` treats a missing pass line as a setup failure (`step_stack`, :148-153), so an unlicensed server fails the run instead of testing a different edition. `MM_SERVICEENVIRONMENT=test` is set on the pilot Mattermost container only (`infra/docker-compose.yml:37-38`), user-approved because the licence is test-signed. The pilot asserts no licensed feature: neither scenario depends on the licence, and the generated specs carry no `pw.skipIfNoLicense()` (`generated/pilot_01_mx_05.spec.ts:6`, `generated/pilot_02_mx_21.spec.ts:6`).

**Network (from `infra/README.md:30-42`):** one internal-only Docker network (`internal: true`), no published ports, and a loopback-only TCP forwarder (`infra/forwarder.mjs`, `127.0.0.1:8065` → Mattermost container). DIRECT (tested by the gate): both containers only on the internal network, no published ports, Postgres has no default route, forwarder bound only to `127.0.0.1`, boundary canary unreachable from the Postgres container, `IsLicensed === 'true'`. INFERRED: the Mattermost container's own egress boundary (the image is distroless and is not exec'd; it rests on the tested network membership).

**Release drift:** the pinned checkout is `f88f88c` (master, unreleased 12.2.0, `server/public/model/version.go:16`), while the tested server is the 12.1.0 release image (tag `v12.1.0`, commit `243e3d0135203ab9166fe8f2873b07f697b06fd4`). Between `v12.1.0` and the pinned commit, 13 related files changed (+520/−266: `CIR/` plus `sidebar_right.tsx`, `channel_info_button.tsx`, `header_icon_wrapper.tsx`; re-run with `git diff --shortstat`). The pilot commits on top of `f88f88c` touch no `webapp/`, `server/` or `e2e-tests/` file, so source line numbers cited here are the same at the branch head. Consequence: source citations without a tag are for 12.2.0 and may differ in the running 12.1.0 UI. Known differences already handled: the `Add People` accessible name carries an icon glyph at 12.1.0 (substring absence check, section 5); `Unarchive` is a plain button at 12.1.0 versus `UnarchiveButton` plus a management-policy hook at HEAD (`CIR/channel_info_rhs.tsx:201,225`); Favorite/Mute names differ (section 7, not used by the pilots). Both scenarios were re-checked against both versions: `getCurrentChannel` (`index.ts:40` at `v12.1.0`), header aria-label = tooltip, sidebar link, `resizable_rhs` and `toggle_info` unchanged; archived notice text (`channel_info_rhs.tsx:218` at `v12.1.0`), `canEditChannelProperties` (:194), `canAddPeople` (:253), menu gating (`menu.tsx:140,142`); MM-63240 "always allow viewing archived channels" (`c8d6630141`) is an ancestor of `v12.1.0`. The independent verifier re-checked both scenarios against both versions as well. Behaviour on a 12.2.0 server is not verified (see section 11).

**Why the patch tag plus digest:** the repo's upgrade tooling uses floating `release-<major>.<minor>` tags (`e2e-tests/playwright/script/resolve_upgrade_matrix.mjs:40-43`); pinning the digest keeps runs deterministic.

**Superseded:** the Phase 2 recommendation of `mattermost/mattermost-team-edition:12.1.0` with no licence was not what ran and is withdrawn.

## 10. UNVERIFIED items

- MX-39 managed-category favorite: reachability with license + `ManagedChannelCategories` unknown; the only test is a known-issue `test.fixme`.
- PW-02..21 numbering: re-verified at the file/group level (no purpose/header/member-count/type assertions), not test by test.
- PS-03 and PS-04: verified from diff stats and file lists, not line by line.
- Upgrade specs ("nothing about channel info"): taken from the inventory.
- Runtime results are taken from the independent verifier run on the licensed 12.1.0 stack, not re-run in this ledger round (no Docker by instruction). The automated controls `release-purpose-changed` and `team-admin` are wired in verify; their results are reported in the pilot report, not here.

## 11. Known limits

- Mattermost container egress isolation is INFERRED, not tested (distroless image, not exec'd; `infra/README.md:41`).
- Chromium egress is guarded at the application level only (`src/guard.ts`), with no host firewall, by instruction.
- The redirect guard is tested against a local stand-in origin and a second local server (`src/guard_check.pw.ts:41-53,195`), not against a real external host.
- The explorer's state key ignores post content (`src/snapshot.ts:160` drops posts), so states that differ only in posts are merged.
- Replay is sensitive to unread state: an unseen post renames the sidebar link (` unread` suffix), and the exact-name click then times out. The seed's final view calls and the `release-purpose-changed` re-view step guard against it.
- Behaviour on master 12.2.0 is not verified; only the 12.1.0 release image was run.
- The negative controls verify sensitivity to seed and role changes, not to product regressions.

# Bookmarks session: QA notes

These notes back up `charter.json` in this folder, which is the file the runner sees. Feature `channels.bookmarks`
(lane Browser). Behaviour under test: the channel bookmark bar belongs to one channel and follows an in-app sidebar
channel switch.

- **Server under test:** licensed `mattermost-enterprise-edition:12.1.0`. Source citations are tag `v12.1.0` (commit
  `243e3d0135`), read with `git show v12.1.0:<path>`, unless marked HEAD.
- **Checkout:** `dcea66beef` (base `f88f88c`, unreleased 12.2.0, plus `explorer-proto/**`).
- **Abbreviations:** `CB` = `webapp/channels/src/components/channel_bookmarks/`.
  `CY` = `e2e-tests/cypress/tests/integration/channels/channel/channel_bookmarks_spec.ts`.
  `PWB` = `e2e-tests/playwright/specs/functional/channels/channel_bookmarks/`.

## 1. Verdict: the recommendation is confirmed

No test switches channel in-app and asserts afterwards which channel's bookmarks the bar shows. I searched all of
`e2e-tests/cypress` and `e2e-tests/playwright`, including helpers, page objects, support, `upgrade-specs` and test
metadata. I also searched `explorer-proto/` and the open Peter stack. Gap claim: **YES**.

### Closest tests

| Test | Test line | Assertion line | Actor | Setup | Transition | Outcome asserted |
| --- | --- | --- | --- | --- | --- | --- |
| Cypress `bookmarks bar hidden when empty` | `CY:58` | `CY:67` | admin (`apiGetMe`, `CY:34`) | channel with 0 bookmarks | none | `channel-bookmarks-container` does not exist |
| Cypress `channel switch preserves overflow detection` | `CY:865` | `CY:867-868`, `CY:876-880` | admin (`apiAdminLogin`, `CY:467`) | 15 bookmarks `OvBm NN` on one channel (`CY:472-478`) | `cy.visit` to another channel (`CY:871`) and back (`CY:874`): full page loads, not in-app | only the overflow button count > 0 on the overflow channel. Nothing is asserted on the other channel, and no title is checked |
| Playwright MM-T5611 | `PWB/bookmark_display_navigation.spec.ts:38` | `:65` | regular user (`pw.initSetup`) | 2 bookmarks on one channel, created via API (`:45-51`) | in-app navigation by clicking the internal bookmark `Town Square` (`:63`) | only `page.url()` contains `/channels/town-square`. The bar is not checked after navigation |
| Playwright MM-T5609 | `:11` | `:31-32` | regular user | 1 bookmark plus announcement banner | none (`goto`, `:27`) | bar visible and `Mattermost Community` visible |

**Difference from this charter.** The actor is a regular member in a fixed seeded identity. Two channels each have
one bookmark with a different title. The transition is an in-app sidebar link click with no reload. The outcome is
asserted in both directions: B's title is present and A's title is absent, and on the start path A's title is
present and B's title is absent.

### Search record (re-run for these notes)

- `rg -l -i bookmark e2e-tests/{cypress,playwright}` finds only these: `CY`; the enterprise
  `bookmark_permissions_spec.ts` (System Console permission rows, `:47`, `:60`); the channel_moderation `helpers.ts`;
  `default_roles_permissions` (Cypress and Playwright); the Playwright components `channel_bookmarks_bar.ts`,
  `channel_bookmarks_create_modal.ts`, `channel_menu.ts`, `index.ts` and `pages/channels.ts`; and the 6 `PWB` specs
  plus `support.ts`.
- `channel-bookmarks-container` appears only in `CY` and `lib/src/ui/pages/channels.ts:128`.
- Every `CY` test enters through `cy.visit`. Every `PWB` spec enters through `channelsPage.goto` (15 calls). No
  bookmark test uses a sidebar link. `upgrade-specs/` has no bookmark reference. `explorer-proto/` had no bookmark
  reference before this session.
- **Peter stack:** I listed #40180, #40181, #40182, #40211 to #40217 with `gh pr view` / `gh pr diff --name-only`.
  All are OPEN. Only [#40216](https://github.com/mattermost/mattermost/pull/40216) touches bookmarks. It renames the
  test id `channel-bookmarks-container` to `channel_bookmarks`, adds per-item test ids, swaps page-object helpers in
  `CY` and `PWB`, and adds unit tests in `bookmarks_bar_item.test.tsx`. It adds no channel-switch assertion.
- Second choice (favorites persistence) not needed, so not re-searched.

### Corrections to the reviewer's citations

- `channel_view.tsx:227` is correct, but the bar is **not keyed** by `channelId`. It receives `channelId` as a
  prop, and at v12.1.0 it has no React key. The bar follows the channel because `useChannelBookmarks(channelId)`
  reads `byChannelId[channelId]` (`CB/utils.ts:126-133`; mattermost-redux `selectors/entities/channel_bookmarks.ts:9-17`)
  and re-fetches when `channelId` changes (`CB/utils.ts:141-145`). HEAD adds a static `key='channelBookmarks'`.
- `bookmark_item_content.tsx:304-361`: `DynamicLink` starts at `:304`. The react-router `Link` branches are
  `:343-353` (relative href) and `:356-366` (site-URL-prefixed href). The explicit `role='link'` is at `:170`.
- `api4/channel_bookmark.go:56-60` is the create handler with its license check. The public-channel permission check
  is at `:98-103`. `role.go:965-994` is correct (`channel_user` holds add/edit/delete/order bookmark permissions).
- MM-T5609: bar visible at `:31` and bookmark visible at `:32`.
- **New fact that the seed depends on:** for `type: 'link'`, `link_url` must be absolute `http(s)`
  (`server/public/model/channel_bookmark.go:163`, `IsValidHTTPURL` at `server/public/model/utils.go:795-805`). Only
  `type: 'board'` accepts a relative path (`:144`).

## 2. Doc evidence

`docs/main/end-user-guide/collaborate/manage-channel-bookmarks.mdx` (present at v12.1.0):

- `:10` "Bookmarks display directly under channel headers."
- `:10` "bookmark up to 50 links or files to the top of channels". This is the boundary; it is not exercised.
- `:31` (mobile tab) "The bookmarks bar is hidden when a channel has no bookmarks."

The doc says bookmarks belong to a channel and display under its header. It does not say that the bar changes when
you switch channel. **Per-channel switching behaviour is backed by source**, not by the doc:

- `channel_view.tsx:227` passes the current `channelId`.
- The selector reads the bookmarks of that channel id.
- The fetch runs again when the channel id changes.
- An empty channel renders no bar (`CB/channel_bookmarks.tsx:70-72`).

## 3. Technique

- **State-transition testing.** The bar content is a function of the current channel. Each state is identified by
  URL path. The transitions are in-app channel changes. The defect class is stale state across a client-side
  transition: the bar keeps the previous channel's bookmarks, or shows nothing until a reload. Every existing test
  enters through a full page load, so none of them exercises this transition.
- **Equivalence partitioning.** One channel with bookmark title A, and a different channel with a different title B.
  Different titles are what make "stale" observable. With equal titles, a stale bar would still pass.
- **Boundary.** The 50-bookmark limit (doc `:10`; `MAX_BOOKMARKS_PER_CHANNEL`, `CB/utils.ts:28`) and overflow are
  not exercised. Overflow is covered by `CY:462-903` and MM-T5612.

## 4. Fixture (for the infra owner)

Fixture details are in `charter.json` `fixture_setup`. Summary:

- **Titles:**
  - `qa-sandbox`: `Sandbox runbook delta 2c71`
  - `release-planning`: `Release brief echo 5b90`
  - Negative control: `Release memo golf 3e47`
- **Title collision checks:**
  - v12.1.0 `en.json` has 0 hits for `runbook`, `sandbox` and each token. I avoided `Release notes`: it has 4 hits,
    including an `<a>release notes</a>` link text in the System Console.
  - No title is a substring of another title, of a channel name or display name, or of the seeded purpose and header
    strings.
  - The titles use only letters, digits and spaces, because `explorer-proto/src/assertions.ts:39` accepts only
    `[\w ]+` for substring absence checks. A hyphenated token would be rejected.
- **Create the bookmarks.** As the lib default admin: `POST /api/v4/channels/{channel_id}/bookmarks` with
  `{display_name, type: "link", link_url}`, expecting 201 (`api4/channel_bookmark.go:49`, `:56-150`).
  - `link_url` is `<manifest base_url>/qa-team/channels/<same channel>`.
  - The origin comes from the manifest at seed time and must never appear in a spec.
  - When the origin equals the page origin, the bar renders an in-app `Link` (`bookmark_item_content.tsx:356-366`).
  - Each bookmark points to its own channel, so even an accidental activation cannot cause the transition under test.
- **System posts:** none. Create and update only publish WebSocket events (`app/channel_bookmark.go:34-51`, `:53-107`).
- **View last.** Mark both channels viewed after seeding: as `qa-user`, `POST /api/v4/channels/members/me/view` for
  `release-planning`, then for `qa-sandbox` (`api4/channel.go:62`; same as `infra/scripts/seed.mjs:100-101`).
- **Negative control.** `PATCH /api/v4/channels/{release-planning id}/bookmarks/{bookmark_id}` with
  `{display_name: "Release memo golf 3e47"}` (`api4/channel_bookmark.go:50`, `:152-272`; `ChannelBookmarkPatch` and
  `Patch()` at `model/channel_bookmark.go:238-273`).
  - It must be sent by the bookmark owner (the same admin). An owner patch updates the bookmark in place
    (`app/channel_bookmark.go:55-76`). A non-owner patch soft-deletes it and saves a copy with a new id (`:77-95`).
  - It emits no post, so re-viewing is not required (harmless if done).
  - Restore by patching the title back, then read back.
  - Expected result: only `follows_switch / fs-3` fails.

## 5. Accessible names

| Name | Role | Status | Basis |
| --- | --- | --- | --- |
| `qa sandbox public channel` | link | SOURCE-DERIVED. This is the current channel's link at the start. The naming rule is identical to the link below, which was observed live | `sidebar_channel_link.tsx:133-156,320`; `sidebar_base_channel.tsx:53-58` |
| `release planning public channel` | link | LIVE-OBSERVED in the earlier pilot (`explorer-proto/generated/trace.md`) | same |
| `View Info` | button | LIVE-OBSERVED in the earlier pilot | `channel_info_button.tsx` |
| `Sandbox runbook delta 2c71`, `Release brief echo 5b90` | link | SOURCE-DERIVED, **NOT live-verified** on 12.1.0. The run must REPORT live names | `bookmark_item_content.tsx:165-176`. The icon is a title-less SVG (`bookmark_icon.tsx:38,80-87`; compass-icons 0.1.63 at v12.1.0, I checked the 0.1.64 copy installed in the workspace). Exact-name precedent: `CY:77,87`; `channel_bookmarks_bar.ts` `getBookmark` used by MM-T5609 `:32` |

Bar container: `data-testid='channel-bookmarks-container'` (`CB/channel_bookmarks.tsx:74-79`). It is a plain div
with no role, so snapshot predicates match links page-wide with count 1, and the replay scopes presence checks to the
test id.

## 6. Budget arithmetic

| Depth | Candidate actions | Count |
| --- | --- | --- |
| 1, from the start state | `qa sandbox public channel` (no-op), `release planning public channel`, `View Info` | 3 |
| 2, from release-planning | `qa sandbox public channel`, `release planning public channel` (no-op), `View Info` | 3 |
| 2, from qa-sandbox with the Info panel open | the two sidebar links (`View Info` is renamed `Close Info` there) | 2 |

That is 8 actions in total, and at most 5 distinct states. So `{8, 2, 6}` is enough. If the budget runs out before
reaching a release-planning state, that is a reported failure, not a pass.

Two states satisfy `follows_switch`: release-planning reached with the Info panel closed, and release-planning
reached with it open. So the predicate does not depend on one particular route.

## 7. v12.1.0 vs HEAD (only differences that matter)

- `sidebar_base_channel.tsx`: HEAD picks `public board` for board-kind channels. For normal channels it is still
  `public channel`. No effect on the names.
- `channel_view.tsx`: HEAD adds a static React key and a plugin-component branch. The bar still gets the current
  `channelId`. No effect.
- `bookmark_item_content.tsx`: HEAD changes only CSS (dot-menu backing). No effect on role or name.
- `api4/channel_bookmark.go`: HEAD clears stored fields of deleted bookmarks in the list response and gates the
  sort-order response. No effect on create or patch.
- Unchanged between v12.1.0 and HEAD: `channel_bookmarks.tsx`, `utils.ts`, `sidebar_channel_link.tsx`, `url.tsx`,
  `model/channel_bookmark.go`, `role.go`.
- Open PR #40216 (not merged) renames the container test id. It does not apply to 12.1.0.

## 8. What this would catch and would not catch

**Would catch:**

- The bar keeping the previous channel's bookmark after an in-app switch.
- The bar not rendering for the new channel (no fetch on channel change).
- The bar showing nothing, or the wrong channel's bookmark, on the start path.

**Would not catch:**

- Overflow or reorder behaviour, or the 50-bookmark limit.
- File, board or emoji bookmarks.
- Opening or clicking a bookmark.
- Private, DM or GM channels.
- Permission gating (adding, editing).
- Real-time WebSocket updates while viewing.
- Switching by other means (channel switcher, browser back, URL).
- Any 12.2.0 behaviour.

The negative control shows that the assertions are sensitive to a seed change. It is not a product regression, so it
cannot prove that a real stale-bar regression would be caught.

**Emitter compatibility:** the current `src/emit.ts` is driven by `scenarios.json` `reachable_path` and
hard-codes the assertion scope to region `Info` (`src/assertions.ts:18`). It cannot consume this charter as-is. The
engine owner needs to add:

- route-free predicate matching over discovered states (`applies_to` by URL path);
- a test-id scope;
- the `kind`/`match`/`count` expectation fields.

The allowlist entries already match the `Control` shape (`role`, `name`, `exact`). `name_match` `contains` follows
the existing `NameMatch` semantics.

## 9. Unavailable or unverified sources

- **Feature map:** the attached feature map is not in the repo. I used `channels.bookmarks` / lane `Browser` as the
  coordinator gave them.
- **Live accessible names:** the bookmark link names on 12.1.0 were not observed live, because I ran no Docker by
  instruction. The explorer must report them.
- **Peter stack:** I read the diffs at file level, plus the bookmark hunks of #40216. I did not review the other
  hunks of #40216 or #40217 line by line.

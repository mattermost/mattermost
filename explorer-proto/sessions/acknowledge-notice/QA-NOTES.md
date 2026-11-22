# QA notes: acknowledge a teammate's notice (`messages.signals:acknowledge-teammate-notice`)

The runner never reads this file. It holds the selection rationale, coverage evidence, budget arithmetic and
limitations for the lead and the verifier. It contains no route. Checkout: branch head `f8b07c3e79` (written at `03e3bf20ac`, rebased onto the read-back fix `85ff957b1b` and its diagnostic `f8b07c3e79`; neither touches product code); product
source cited at tag `v12.1.0` (`243e3d0135`) unless marked HEAD. The directory is named `acknowledge-notice`
instead of the suggested `journey-next`, because the journey id makes that name clearer.

## 1. Selection

**Chosen:** Bea, a regular member, acknowledges a change-freeze notice that her release manager Abe posted with
an acknowledgement request; Abe must be able to see her acknowledgement. Consequence: Abe either chases Bea
although she confirmed, or Bea believes she confirmed while Abe sees nothing.

Why this one:

- It is a real signal one person sends to another, with a consequence a teammate relies on, checkable from both
  sides: Bea's UI (the notice shows the acknowledged state) and Abe's own REST view of the post.
- It is **UNCOVERED** by both suites (section 2). The earlier verdict "needs typing" applied to Abe composing the
  notice in the UI; here the notice is a fixture post made with Abe's own REST session (disclosed), so Bea's
  part is click-only.
- No hover, upload, timer or per-spec config is needed. The licence is essential, and the pilot server is
  licensed Enterprise 12.1.0.

Honest weakness: the actor's part is short (section 6). It is below the 4-step heuristic used for scanning fresh
candidates; the design rule is "as many steps as it needs", and I did not pad it. A variant where Bea is not yet a
channel member (Browse Channels, then acknowledge) would be deeper, but it mixes in a join flow that Cypress
already covers and adds a modal whose rows share the name `Join`; I rejected it.

**Runners-up (re-verified leads):**

| Candidate | Verdict | Why not chosen |
| --- | --- | --- |
| Synced draft sent from Drafts in a second session | PARTIAL | The send-from-panel transition and server-side deletion are covered (Playwright `draft_send_from_panel.spec.ts:19`, `:84`). The current fixture factory cannot create a draft: `POST /api/v4/drafts` returns a `Draft` without `id` (`model/draft.go` `type Draft struct`), and `createFixturePost` requires one (`src/journey_fixture.ts:153-156`). The row actions are labelled only by a tooltip that exists on hover (`drafts/draft_actions/action.tsx` `aria-labelledby={draft_tooltip_<id>}`), so their snapshot names would be icon glyphs, and the delete glyph is not caught by any excluded-name pattern. |
| Favorites persist after a switch and a reload | PARTIAL | Moving a channel into Favorites is covered in Cypress (three tests, section 2). The remaining gap (persistence after reload) is a personal outcome with no teammate consequence. |

**Fresh candidates scanned and rejected:** scheduled message "Send now" (COVERED, Playwright
`scheduled_messages.spec.ts:123`, `:351`, `:405`, `:525`); custom status (COVERED, 10 Cypress specs under
`channels/custom_status/`); per-channel "ignore @channel mentions" (COVERED, Playwright MM-T568
`notifications/channel_mentions.spec.ts:9`); mute (COVERED, Cypress MM-T3349_3 `sidebar_channel_menu_spec.ts:93`);
make a teammate channel admin (needs a channel-admin actor the fixture factory cannot create, and Cypress
`user_to_channel_admin_member_updates_manage_channel_members_rhs_spec.ts` exists); add a member to a channel
(user picker rows are plain `div`s with `onClick`, `multiselect/multiselect_list.tsx:143-145`, so not actuable;
typing otherwise); pin, save, remind, react (post menu renders only on hover or keyboard focus,
`post/post_component.tsx:345-346`, `post/post_options.tsx:130`; the engine moves the mouse to 0,0 before every
snapshot, `src/journey_search.ts:63`).

## 2. Coverage review (both suites, opened and read)

**Search record.** `rg -i` over `e2e-tests/cypress` and `e2e-tests/playwright` (specs, `lib`, `support`, custom
commands, utils, upgrade-specs), node_modules excluded, for: `acknowledg`, `AcknowledgementButton`, `/ack\b`,
`requested_ack`, `requestedAck`, `ackPost`, `post_priority`, `priority` (Cypress), `Acknowledge` (exact en.json
`post_priority.button.acknowledge`), `Acknowledgements` (`post_priority.acknowledgements.title`), `Request
acknowledgement`; for the runners-up `Send draft`, `draft_icon`, `sendDraft`, `upsertDraft`, `getUserDrafts`,
`FAVORITES`, `toggleFavorite`, `Favorite`, `reload()` in the favourites specs. Emitted specs and the pilot ledger
(`explorer-proto/coverage.md`, Channel Info only) contain nothing related. Open PRs searched by title
(`gh pr list --search "acknowledge in:title"`, `"acknowledgement e2e"`): none relevant.

### Chosen: acknowledgement — UNCOVERED

| Suite | Closest test (file:line) | Actors + setup | Transition | Final assertion (file:line) | Why not equivalent |
| --- | --- | --- | --- | --- | --- |
| Playwright | `specs/functional/channels/message_priority/message_priority.spec.ts:160` MM-T5140 (helper `postWithPriorityAndVerify` :21-73) | one user from `pw.initSetup()` (:23) | the same user composes and posts an Important message (:33-56) | label in post `verifyPriorityLabel` (:60, lib `ui/components/channels/message_priority.ts:123-127`) and in RHS (:69) | no acknowledgement requested, no second user, nothing acknowledged |
| Playwright | same file :79, :131, :174, :189 (MM-T5139_1/_2, MM-T5142, MM-62078) | one user | composer priority picker | labels, picker visibility, remove-label control | composer only |
| Playwright | `specs/functional/channels/post_attributes/post_attributes_composer.spec.ts:1128` | one user | posts attributes + file + priority label | attribute and label assertions | no acknowledgement |
| Playwright | `specs/functional/channels/content_flagging/deletion-report/deletion-report.spec.ts:17` | admin flow | removal report | `toContainText('Acknowledgements')` (:82) is a report row label | unrelated feature |
| Cypress | none | — | — | — | no message priority or acknowledgement test exists; `interactive_dialog/checkbox_elements_spec.js:166-167` is an interactive-dialog checkbox labelled "Acknowledgement"; `accessibility_input_fields_spec.ts:207,260` only skip the priority control |

The page object `MessagePriority` (`lib/src/ui/components/channels/message_priority.ts:21-40`) has no locator
for the acknowledgement request or the Acknowledge button. Non-e2e coverage: `server/channels/api4/post_test.go:7219`
(TestAcknowledgePost) and `:7261`; app and store tests; **no** webapp unit test for `PostAcknowledgements` at
v12.1.0 (one is added on main). **What the new journey adds:** a second actor's notice, the actor's own UI
acknowledgement through discovered navigation, and agreement between the actor's UI and the teammate's REST view.

### Runner-up: synced draft sent from Drafts — PARTIAL

| Suite | Closest test | Actors + setup | Transition | Final assertion |
| --- | --- | --- | --- | --- |
| Playwright | `channels/drafts/draft_send_from_panel.spec.ts:19` | one user, two teams | types a draft (:36), switches channel, sends it from Drafts via `draftsPage.sendDraft` (:50; lib `ui/pages/drafts.ts:75-81` hovers, clicks `#draft_icon-send-outline_send`, confirms) | badge `1` (:44), count 1 (:49), last post (:54), drafts gone (:55), server drafts 0 (:59), not restored after team switch (:68-69), post still there (:77) |
| Playwright | same file `:84` (thread draft) | one user | RHS reply draft sent from Drafts | count 1 (:106), RHS text (:111), empty (:112-114), server drafts 0 (:119) |
| Cypress | `channels/messaging/message_draft_persistance_spec.js:35` MM-T4639, `:52` MM-T4640 | one user | draft persists across reload | composer text (:49, :87) |

Beyond them, the journey would add only a draft created server-side (another device) and a teammate-side receipt.

### Runner-up: favourites persistence — PARTIAL

| Suite | Closest test | Actors + setup | Transition | Final assertion |
| --- | --- | --- | --- | --- |
| Cypress | `channels/channel_sidebar/sidebar_channel_menu_spec.ts:72` MM-T3349_2 | one user | sidebar channel menu `Favorite`, `Unfavorite` | in FAVORITES (:82), back in CHANNELS (:90) |
| Cypress | `channels/multi_team_and_dm/favorite_and_close_spec.js:40` MM-T474 | one user, GM | header `#toggleFavorite` | first in FAVORITES (:46), then closed |
| Cypress | `channels/channel_sidebar/sidebar_category_menu_spec.ts:32` MM-T3171_2 | one user | menu `Favorite` | in FAVORITES (:40), then category modal |
| Playwright | none that favourites a channel; `categories/managed_categories.spec.ts:358` is `test.fixme`, `:431` asserts a disabled menu item (:470-472); `sidebar_left/dm_gm_profiles_on_load.spec.ts` sets Favorites by API | — | — | — |

No favourites spec reloads. Beyond them: persistence across a switch and a reload, for the same user only.

### Repo index tool (data, not judgement)

`node explorer-proto/v2/index/extract.mjs` (3,492 tests, 1,053/1,125 files, 3.5 s, cache
`03e3bf20acab-9378b5ca-05238ad6`; re-run after the rebase with the same corpus hash and identical results), then `coverage-check.mjs --k=5 --include-emitted` with candidates in
`explorer-proto/infra/.run/journey-next/{ack,drafts,favorites}.json` (git-ignored), written from en.json labels.

| Candidate | Tool verdict | Top ranks (score) | My reading |
| --- | --- | --- | --- |
| Acknowledgement | `no_close_match` (top 0.283) | post_attributes_composer.spec.ts:1128 (0.283), deletion-report.spec.ts:17 (0.280), message_priority.spec.ts:189 (0.193), :160 (0.186), post_attributes_roles.spec.ts:326 (0.185) | Agree: UNCOVERED. The tool matched on "priority"/"Important"/"Acknowledgements" vocabulary; none of these tests acknowledges anything. A quiet report alone would be weak evidence (index recall is low); the text search above is the evidence. |
| Drafts | `needs_review` (0.620) | draft_send_from_panel.spec.ts:19 (0.620), :84 (0.619), burn_on_read_edge_cases.spec.ts:114, scheduled_messages.spec.ts:525, :405 | Agree on the ranking; PARTIAL, closer to covered than the score says, because :19 also asserts the server state. |
| Favourites | `needs_review` (0.618) | sidebar_category_menu_spec.ts:32, favorite_and_close_spec.js:40 (partial extraction), sidebar_channel_menu_spec.ts:72, category_sorting_1_spec.ts:32, leave_and_archive_channel_destructive_spec.ts:32 | Agree on the top three; the last two only mention FAVORITES/menus. PARTIAL. |

## 3. Doc and source evidence

`docs/main/end-user-guide/collaborate/message-priority.mdx` (present at HEAD and at v12.1.0; PlanAvailability
`all-commercial`, :6):

- :51 "request that recipients actively acknowledge the message to track that messages have been seen"
- :53 "You can mark the message as acknowledged by selecting the button"
- :53 "hover over the Acknowledged icon to review who has acknowledged the message"
- :58 "After acknowledging a message, you have up to five minutes to change your mind."

Server and webapp facts used by the charter (v12.1.0): licence gates `app/post_permission_utils.go:57-60`,
`api4/post.go:1476-1479`; root-only priority `:53-55`; archived channel refuses `app/post_acknowledgements.go:38-40`;
read metadata `app/post_metadata.go:268-281`; withdrawn acknowledgements filtered `sqlstore/post_acknowledgements_store.go:121-128`;
client flag `config/client.go:238-240` (authenticated config only, so the unauthenticated client-config
precondition cannot read it); button `post_view/acknowledgements/post_acknowledgements.tsx:56-146`; render gate
`post/post_component.tsx:940-946`; the UI updates from the server response `mattermost-redux/actions/posts.ts:1340-1359`.

## 4. Fixture and names

- Two users (Abe declared first, see the own-session note in the charter), two public channels. Bea lands in
  `Lounge`; the notice is a root post by Abe in `Release Coordination` with `priority: important` and
  `requested_ack: true`. No `name_format` preference, so the author's controls carry the slug and are dropped as
  non-replayable.
- Viewed clean = the channel unread endpoint returns zero (`api4/channel.go:108`; `TotalMsgCount - member.MsgCount`,
  `sqlstore/channel_store.go:928-936`) for `msg_count`, `msg_count_root`, `mention_count` and `mention_count_root`,
  with `mark_unread` not `mention`. Member counters are not used: `msg_count` there is the read cursor. This matches
  the factory's read-back since `85ff957b1b` (`src/journey_fixture.ts:310-345`, `:373-383`).
- Fixed strings checked for collisions: the notice text and the channel names match no en.json string; the
  deny list (`v2/bakeoff/deny_labels.json`) labels do not occur.

| Name | Role | Status |
| --- | --- | --- |
| `Acknowledge` (before) | button | SOURCE-DERIVED (`post_acknowledgements.tsx:120-125`); icon is a title-less SVG path (`@mattermost/compass-icons` `components/check-circle-outline.js`, local 0.1.64; tag lockfile pins 0.1.63) |
| `1` (after, the count) | button | SOURCE-DERIVED (`:127-129`); exact name is a risk, the run must report it |
| `Important` | text in badge, beside an icon-font glyph | SOURCE-DERIVED; matched as substring |
| `release coordination public channel`, `lounge public channel` | link | SOURCE-DERIVED (`sidebar_channel_link.tsx:133-156`) |
| post container | listitem (post list row; the post wrapper is a generic `div` with aria-label, `post_aria_label_div.tsx`) | SOURCE-DERIVED |

## 5. v12.1.0 versus main

- Main adds a channel write-access gate to acknowledge (`api4/post.go` `requireChannelWriteAccessByID`) and
  disables the button when the channel is write-denied (`acknowledgements/index.ts` `isWriteDenied`,
  `post_acknowledgements.tsx` `aria-disabled`). A default public channel is not write-denied, so the journey is
  expected to hold on main; not run there.
- Main refactors `app/post_metadata.go` (+188/-54) but still attaches acknowledgements on read (HEAD :362-374).
- Main adds `post_acknowledgements.test.tsx` and flag-gated `PostAttributesChips` in `post_component.tsx`.
  `config/client.go` differs only in `AuditLoggingActive`.

## 6. Engine feasibility, minimum depth and budget (numbers only)

- **Mode:** outcome mode. Plain journey mode would never qualify: UI checkpoints count there only after a teammate
  event (`src/journey_search.ts:612-614`, `:868-875`), and the only event type is `post_thread`
  (`src/journey_rest.ts:230-232`). The spec emitter refuses outcome charters, so no repo-native spec results.
- **Checkpoints:** every clause form used is in the grammar: REST `expect` with dotted and indexed paths
  (`journey_charter.ts` `readPath`), `all` lists, own-session resolution; UI `text_contains`, role with `name`
  or `name_contains` and `count`, `evaluated_only_when`, `settle` windows, `post_scope` anchor and same-container.
- **Minimum action depth: 2.** `max_depth` 3 leaves one action of slack.
- **Score arithmetic** (`journey_score.ts`; fatigue is 25 in code, 15 in README-engine.md): every state carries the
  two always-true REST checkpoints (+200, uniform). A plain depth-1 sibling scores 200+12-1 = 211; children of a
  novel depth-1 state score 210 before fatigue; children of an open menu or dialog score 270 at depth 2 and 269 at
  depth 3. Goal terms give the target no lexical boost (0 shared stems). Name order breaks ties, and it happens to
  favour a name beginning with "Ac", a structural advantage to disclose, not a hint.
- **Expected expansions before the outcome is first observed:** about 30 depth-1 siblings, 20 to 25 menu items, and
  50 to 70 dialog controls before fatigue (-25 per prior actuation of the same name) pushes repeated names below
  210: about 100 to 130. Confirmation: 1 to 3 replays from the reserve of 10.
- **Budget:** `max_actions` 180 (1.4 to 1.8 times the estimate), `max_replays` 200 (180 + 10 reserved + 10 spare),
  `max_states` 200, `max_depth` 3, `wall_clock_seconds` 2400. Replay cost: about 4.75 s base (auto-follow: 240
  actions in about 19 min) plus up to 1.5 s per state where the notice is absent and up to 2 s per state where it
  is pending, so 7 to 9 s; 130 replays take 15 to 20 min, 200 take 25 to 30 min. No `no_early_stop`: the search
  stops at the first classification that needs confirmation.
- **Auto-follow's budget (240 actions, depth 9, about 19 min) is not appropriate here:** depth 9 is 4.5 times the
  needed depth and lets the container bonus drill dialogs eight levels deep; the action count is the right order
  but each replay here costs more because of the settle windows.
- **Stall points:** dialogs and menus (container bonus); ambiguous names (per-row sidebar channel options buttons,
  Browse Channels `Join` rows) are skipped; glyph-prefixed badge text is matched by substring; Town Square and
  Off-Topic links may carry ` unread` (live names are used; the state key scrubs the suffix); a second actuation
  of the acknowledged control withdraws the acknowledgement within five minutes (ends PENDING, correct).
- **Read-back (resolved during this task):** at `03e3bf20ac` the read-back used the member record's counters, so the
  release channel (which holds a user post) would have failed as SETUP_FAILURE after the view call. The fix
  `85ff957b1b` reads the unread endpoint with Bea's own session; `C-VIEWED` declares the same four counters. Not
  run against a live server here.

## 7. Negative control

BLOCKED on v12.1.0 (charter `negative_controls[0]`). Checked and rejected: `PostPriority=false` (accepted by the
API and not undone by the repo fixture's `resetConfig`, but it makes the fixture post fail with 403 and hides the
button), licence removal (same), archiving the channel (needs a fixture edit and changes navigation), role changes
(`resetRoles` restores them; v12.1.0 checks only read permission). Proposed for the lead: a v12.1.0 server mutant
whose acknowledge handler answers without storing; the webapp would show the count while Abe's view lists nothing,
so only C-ACK-SEEN fails. Needs a server build and lead approval.

## 8. What it would and would not catch

Would catch (PRODUCT_FAILURE after confirmation): an acknowledgement shown to Bea but not stored where Abe can see
it; an acknowledgement stored but not reflected on Bea's notice in the same view.

Would report only as INCONCLUSIVE (open item, preserved observations): a button that never renders, a server
that refuses the acknowledgement consistently (UI and REST agree on "not acknowledged"), a budget-out.

Would not catch: persistence after a channel switch or reload (needs depth 4), the hover popover listing who
acknowledged, the five-minute withdrawal lock, persistent-notification resolution, Abe's live UI update (Abe has no
UI), urgent priority, other surfaces beyond depth 3.

## 9. Limitations

- **Goal wording:** the goal avoids the control label and the channel name. Its stems (abe, know, read, change,
  freeze, notice, post, chase, start) give the target no lexical help; `read` can lure toward "Mark as Read".
- **REST stimuli:** the notice is created with Abe's REST session before the session starts, and his view is a REST
  read with his session. Neither is Abe's UI. Every report must say so.
- **Heuristic:** discovery relies on novelty, the container bonus and fatigue; the arithmetic above is an estimate
  from source, not a measured trace.
- **REST before UI:** a server response slower than the snapshot settle (at least 600 ms) could produce an
  unconfirmed ACK_SHOWN_NOT_RECORDED, which blocks PASS.

## 10. Validation run

- `python3 -m json.tool charter.json`: parses.
- `node explorer-proto/src/cli.ts charter-check --journey=acknowledge-notice`: could not load in this workspace
  (the CLI imports `emit.ts`, which needs `prettier` through the git-ignored `explorer-proto/node_modules` symlink;
  not created, by instruction). The same functions (`readJourneyCharter`, `validateOutcomeCharter`,
  `clientConfigRequestPath`) were run from a scratch replica in `infra/.run/journey-next/`: rules parse, five
  classes, seven precedence entries, confirmation order ACK_SHOWN_NOT_RECORDED, ACK_RECORDED_NOT_SHOWN,
  ACKNOWLEDGED; preserved the two failure classes; 10 reserved replays; precondition source admin `GET /config`.
- `node explorer-proto/v2/bakeoff/leakage_check.mjs` on the charter: FAIL with two L4 unknown keys only,
  `budget_reserve` and `success_criteria.outcomes`, both required by the engine's outcome mode and absent from the
  legacy charter schema (the attachment charter gets the same two). No ordered-phrase, numbered-step or deny-label
  hit; no event, so none of the REST event `ordering`/`requests` flags auto-follow gets.

## 11. Unavailable or unverified sources

- No live server or Docker: every accessible name is SOURCE-DERIVED; nothing was observed.
- The feature map itself is not in the repo; only its ids from the brief.
- `cli.ts charter-check` (see section 10). The read-back diagnostic (`infra/scripts/diag_unread_readback.mjs`, commit `f8b07c3e79`) was read, not run.
- compass-icons at the tag (lockfile 0.1.63) versus the inspected local 0.1.64.
- Playwright 1.62.1 snapshot rendering of the post container (generic `div` with aria-label inside a listitem).
- GitHub PR search by title only.

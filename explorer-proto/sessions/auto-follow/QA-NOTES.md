# Auto-follow session: QA notes

These notes back up `charter.json` in this folder. The charter is the only file the runner sees; this file is for
the lead and the engine owner. Journey `channels.notifications:auto-follow-new-threads`, features
`discovery.notifications` + `messages.threads`, lane Browser.

- **Server under test:** licensed `mattermost-enterprise-edition:12.1.0`. Every product claim below was read at tag
  `v12.1.0` with `git show v12.1.0:<path>`, unless marked HEAD.
- **Checkout:** base `f88f88c` (unreleased 12.2.0) plus `explorer-proto/**` from earlier pilots.
- **Abbreviations:**
  - `CY` = `e2e-tests/cypress/tests/integration/channels/collapsed_reply_threads/`
  - `PW` = `e2e-tests/playwright/`
  - `NM` = `webapp/channels/src/components/channel_notifications_modal/`
  - `GT` = `webapp/channels/src/components/threading/global_threads/`
- **No route here.** These notes hold no ordered path. The lead keeps the reference route for the verifier.

## 1. Verdict: gap confirmed (YES)

No Cypress or Playwright test turns on "auto-follow threads in this channel", and none asserts that a thread
started by someone else then appears in a non-participant's followed-thread list, either in the UI or through
`GET /users/{id}/teams/{team}/threads`.

### Closest tests (each opened at the cited lines)

| Test | Test line | Final assertion | Actors and setup | Transition | Outcome asserted | Why not equivalent |
| --- | --- | --- | --- | --- | --- | --- |
| Cypress MM-T4417_1 | `CY/channel_notifications_spec.ts:54` | `:136-139` (desktop notification spy `calledWithMatch 'Reply in <channel>'`) | `cy.apiInitSetup` receiver plus `cy.apiCreateUser` sender (`:34-47`); config `ThreadAutoFollow: true`, `CollapsedThreads: 'default_on'` (`:27-32`) | Opens the same dialog through `cy.uiOpenChannelMenu('Notification Preferences')` (`:58`, `:73`, `:98`) but only toggles mute and desktop radios. The receiver writes the root herself (`cy.postMessage`, `:124`), so she follows by the author rule | A desktop notification for a reply in a thread she started. `:113-114`: no notification for a non-followed thread | Never touches the auto-follow checkbox. Following comes from authorship. No threads list, no REST list |
| Cypress MM-T4141_1 | `CY/following_spec.ts:56` | `:133` (`div.ThreadItem` length 2) | Logged-in user plus another user | The user replies, so follows by participation | Threads list count | Following comes from replying |
| Cypress MM-T4141_3 / _4 | `CY/following_spec.ts:137`, `:172` | `:165` / `:200` (RHS `.FollowButton` text `Follow` / `Following`) | Same | Manual footer `Following` / `Follow` click (`:158`, `:193`) | Button label | Manual follow toggle |
| Cypress MM-T4445 | `CY/global_threads_spec.ts:117` | `:135` (`div.ThreadItem` length 1), `:150` after reload | `user1` from `cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true})` (`:44`), so the logged-in user is a system admin. CRT preference on (`:49`) | The root is posted as `user1`, the logged-in user (`:72`). The reply comes from `user2` (`:129`) | One thread item, then deletion behavior | Following comes from the root-author rule (server `notification.go:253-258`) |
| Playwright MM-T568 | `PW/specs/functional/channels/notifications/channel_mentions.spec.ts:9` | `:40` (mention badge `'3'`) | `pw.initSetup()` plus `adminClient.createUsers`, two `createPublicChannel` | Same dialog through `channelsPage.openChannelNotificationPreferences()` (`:22`): ignore-mentions checkbox and save | Mention count | Different preference. No threads |
| Playwright threads list | `PW/specs/functional/channels/threads/threads_list.spec.ts:9` | `:48`, `:55`, `:64`, `:71`, `:78` (`getLastPost().toContainText(...)`) | One user | The same user creates every root and reply | Keyboard selection in the threads list | No second actor, no preference |
| Playwright page object | `PW/lib/src/ui/components/channels/channel_notification_preferences_modal.ts:17-21` | - | - | - | - | Only mute, ignore and save locators. No auto-follow locator |
| Server unit | `server/channels/app/notification_test.go:3244` `TestChannelAutoFollowThreads` | `:3282` (`threadMembership.Following` true); `:3304` (false after an explicit unfollow) | App-level users | `UpdateChannelMemberNotifyProps` called directly (`:3257`) | Thread membership row | No UI, no REST list, no threads view |

Helpers followed: `cy.uiOpenChannelMenu`, `cy.postMessageAs`, `postMessageWithReply` (following_spec),
`channelsPage.openChannelNotificationPreferences` (`PW/lib/src/ui/pages/channels.ts:381-387`) and
`ThreadsPage` (`PW/lib/src/ui/pages/threads.ts`: `#threads-list`, `goto('/<team>/threads')`).

### What this journey verifies beyond component checks

- The UI-saved setting persists to the channel member's `notify_props.channel_auto_follow_threads` (C1).
- The server's auto-follow branch runs on a reply by someone else in a public channel, for a member who was not
  mentioned and did not participate (C2 stimulus; C3 and FINAL effect).
- The followed-thread view lists the thread (C3), and the thread pane shows the reply (C4).
- The REST followed-thread list agrees with the UI (FINAL).
- Per-channel scoping on the preference side only: lounge stays not `on` (C1, second clause). Per-channel behavior
  (no auto-follow for lounge threads) is NOT exercised.

### Search record

- `rg -i 'autoFollow|auto_follow|auto-follow|Automatically follow|Follow all threads|channel_auto_follow'` over
  `e2e-tests/cypress` and `e2e-tests/playwright` (excluding node_modules) finds nothing for the per-channel preference.
  The only hits are:
  - the account-level "Auto-follow threads on channel-wide mentions" setting (Playwright accessibility
    `settings_dialog/notifications.spec.ts:55-57`, `:119-120`; `notifications_settings.ts:41-42`; Cypress
    `accessibility_account_settings_spec.js:37`);
  - `ThreadAutoFollow: true` in config setup blocks.
- No e2e calls `getUserThreads` or `/threads` REST. `ThreadsPage.goto` is UI only.
- Open PRs: `gh pr list --state open` searched for `autoFollowThreads`, "auto-follow", "auto follow",
  `channel_auto_follow_threads`, "threads e2e" and "follow" in the title. Only #38512 matched (a collapsed-threads
  `GetPostsSince` fix, unrelated).
- So no existing e2e asserts that a non-participant's threads view, or the REST thread list, contains a root
  created by someone else after the preference is set.

## 2. Corrections to the earlier review

- **Negative control as requested is impossible on 12.1.0 (blocking).** `PUT /api/v4/config/patch` with
  `ServiceSettings.ThreadAutoFollow=false` is rejected:
  - `patchConfig` calls `updatedCfg.IsValid()` (`api4/config.go:360`);
  - that calls `ServiceSettings.isValid` (`model/config.go:4568`);
  - which returns HTTP 400 when `CollapsedThreads != disabled && !ThreadAutoFollow` (`model/config.go:5276-5277`;
    server i18n "ThreadAutoFollow must be true to enable CollapsedThreads"). The same check exists at HEAD
    (`config.go:5350`).
  - Disabling CRT as well makes the patch valid, but it hides the threads link and the modal section
    (`preferences.ts:275-284`; `global_threads_link.tsx:66`; `NM/channel_notifications_modal.tsx:438`). Bea's
    navigation would then change, which violates the control's premise.
  - Details and a proposed replacement are in `charter.json` `negative_controls` and in §8.
- **"Followed threads" is a tab, not a heading.** It is a `role=tab` button inside a `role=tablist` labelled
  "Filter visible threads" (`GT/thread_list/thread_list.tsx:196-216`, roles from `useTabs` `:333-343`). The
  `Header` widget defaults to `level=0`, which renders a Fragment, not an `<h*>` (`widgets/header/header.tsx:19-35`).
- **Thread rows do not expose the root text in their accessible name.** A row is `role='link'` with
  `aria-label='Thread by {author}'` (`GT/thread_item/thread_item.tsx:214-218`). The root text is child content of
  the `.preview` div (`:280-297`).
  - `author` comes from `makeGetDisplayName` (`thread_item/index.ts:35`). Under the default
    `TeammateNameDisplay=username` (`model/config.go:4411-4412`), that is the slugged username.
  - The fixture therefore sets Bea's `display_settings/name_format=full_name` so the row name is the fixed
    "Thread by Abe Lindqvist".
- **The reply alone triggers auto-follow.** The block requires `post.RootId != ""` (`notification.go:251`), so the
  root post alone never makes Bea a follower. This is why the event must post a reply.
- **The block is inside `if !suppressNotifications {`** (`notification.go:187-402`). A post with
  `props.silent_notification=true` (`model/post.go:1184-1202`) would skip auto-follow. The event therefore sends no
  props.
- **Explicit-unfollow line numbers:** the check is at `notification.go:306-318`. The membership write
  is at `:320-337` (`MaintainMembership` at `:332`).
- **Doc lines:** `:15` is the anchor list entry "Auto-follow all new threads" and `:22` is the web/desktop entry.
  The mobile-only steps are `:66-70` under the heading `:62`. `:64` is the default-behavior sentence, not a step.
  `:72` says the Threads view lists followed threads.
- **Doc plan badge:** the doc carries `<PlanAvailability slug="all-commercial" />` (`:8`), but no license check
  exists in the modal section or the server block. The pilot asserts no licensed behavior.
- **MM-T4445 actor:** the logged-in user is promoted to system admin (`global_threads_spec.ts:44`), and the code
  comment "Post a message as other user" at `:71` is misleading: the sender is `user1`, the logged-in user.
- **MM-T4417_1:** the final assertion is `:136-139` as reviewed. The receiver authors the root at `:124` (not via
  `postMessageAs`), so following comes from authorship.
- **Fixture helpers that break fixed display names:**
  - `adminClient.createPublicChannel` forces `unique: true` (`PW/lib/src/server/playwright_client.ts:49-68`) and
    `createRandomChannel` then suffixes the display name (`channel.ts:30-35`).
  - `pw.random.post` appends a random id to the message (`post.ts:17`).
  - The emitter must use `adminClient.createChannel` and `client.createPost` directly (§5).

## 3. Doc evidence

`docs/main/end-user-guide/preferences/manage-your-channel-specific-notifications.mdx` (present at v12.1.0):

- `:15` "Auto-follow all new threads"
- `:22` "select **Notification Preferences** from the drop-down list."
- `:64` "you don't automatically follow new conversation threads in any channel unless you start…"
- `:66` "When using Mattermost on your mobile device, you can configure…"
- `:72` "Tap **Threads** in the channel list to access all threads you're following"

What the doc supports:

- The per-channel preference exists (`:15`), and the web route to channel notification preferences goes through
  the general entry (`:20-26`).
- Following normally needs authorship, a reply, a manual follow or a mention (`:64`).

What rests on source only:

- The doc's auto-follow steps are mobile only (`:66-70`). For web, the doc relies on the general entry at `:22`/`:26`.
  The web checkbox label, its visibility condition and its storage key come from source (`NM`).
- That a reply (not a root) triggers following, that DMs are skipped, that an explicit unfollow is respected, and
  that the REST list filters on `Following` come from `notification.go:251-337` and `thread_store.go:311`.

## 4. Product evidence at v12.1.0 (re-verified)

| Claim | Status | Evidence |
| --- | --- | --- |
| Checkbox "Automatically follow threads in this channel", test id `autoFollowThreads` | Confirmed | `NM/channel_notifications_modal.tsx:278-290`; `NM/utils.tsx:39-42`; webapp `src/i18n/en.json:20123` |
| Section shown only when `collapsedReplyThreads` is true | Confirmed | `NM/channel_notifications_modal.tsx:438-453`; `NM/index.ts:21` (`isCollapsedThreadsEnabled`). The section title is "Follow all threads in this channel" (`en.json:20119`) |
| Saved via `notify_props.channel_auto_follow_threads` | Confirmed | `:288` sets `'on'/'off'`; `handleSave` → `updateChannelNotifyProps` (`:118-129`) → `PUT /channels/{id}/members/{uid}/notify_props` (`api4/channel.go:122`) |
| Server block only when `ThreadAutoFollow` is on and the post is a reply | Confirmed | `notification.go:251` |
| Members with the preference on become participants; skipped in DMs | Confirmed | `:281-287` (`channel.Type != model.ChannelTypeDirect`). GMs are NOT skipped by this check |
| Explicit unfollow respected | Confirmed | `:306-318` |
| `ChannelAutoFollowThreads` values on/off, default off | Confirmed | `model/channel_member.go:25-27`, `:298-300`, `:302-310` |
| Defaults `ThreadAutoFollow=true`, `CollapsedThreads=always_on` | Confirmed | `model/config.go:1011-1016` |
| `GET /users/{uid}/teams/{tid}/threads` lists followed threads | Confirmed | `api4/user.go:111`, handler `:3981-4065`; `sqlstore/thread_store.go:311` |
| i18n "Followed threads" / "No followed threads yet" | Confirmed | webapp `src/i18n/en.json:23783`, `:23791`. The path is `webapp/channels/src/i18n/en.json`, not `webapp/channels/i18n/` |
| Threads view URL | Confirmed | `/:team/threads/:threadIdentifier?` (`global_threads_link.tsx:42`, link target `:83`) |
| No `MM_` override | Confirmed | `explorer-proto/infra/docker-compose.yml` has no `THREADAUTOFOLLOW` or `COLLAPSEDTHREADS` |

## 5. Fixture API the emitter should use (repo-native spec)

These names come from `PW/lib/src/server/init.ts`, `browser_context.ts`, `test_fixture.ts`, `server/user.ts`,
`server/client.ts`, `server/playwright_client.ts` and `webapp/platform/client/src/client4.ts`, modelled on
`drafts_on_deleted_message.spec.ts:9-27` and `channel_mentions.spec.ts:10-19`.

- **Setup:** `const {adminClient, team, user, userClient, townSquareUrl} = await pw.initSetup({userOptions: {prefix: 'bea'}});`
  - `user` is a regular member, `userClient` is Bea's logged-in client, and `townSquareUrl` is
    `/<team>/channels/town-square`.
  - `createNewUserProfile` still applies the onboarding preferences (its own defaults).
- **Names:** `await adminClient.patchUser({id: user.id, first_name: 'Bea', last_name: 'Okafor'});`
- **Second user:** `const abe = await pw.createNewUserProfile(adminClient, {prefix: 'abe'}); await adminClient.addToTeam(team.id, abe.id); await adminClient.patchUser({id: abe.id, first_name: 'Abe', last_name: 'Lindqvist'});`
  - `adminClient.createUsers(team.id, 1, 'abe')` works as well.
- **Slug:** `const slug = pw.random.id();`
- **Channels:** `await adminClient.createChannel({team_id: team.id, name: \`incidents-${slug}\`, display_name: 'Incidents', type: 'O'})`,
  and the same for `lounge`.
  - Do not use `createPublicChannel` or `pw.random.channel({unique: true})`: both suffix the display name.
- **Membership:** `await adminClient.addToChannel(user.id, channel.id)` and `addToChannel(abe.id, channel.id)` for
  both channels.
- **Preferences:** `await userClient.savePreferences(user.id, [...])`, with `collapsed_reply_threads=on`,
  `name_format=full_name` and the four onboarding keys.
- **Read-back:** `adminClient.getChannelMember(channelId, user.id)` and
  `userClient.getUserThreads(user.id, team.id, {})`, which must return zero threads.
- **Viewed last:** `await userClient.viewMyChannel(lounge.id); await userClient.viewMyChannel(incidents.id);`
- **Browser:** `const {page, channelsPage, threadsPage} = await pw.testBrowser.login(user); await page.goto(townSquareUrl);`
- **Event (fires inside the spec right after the C1 REST poll turns true):**
  `const {client: abeClient} = await pw.makeClient(abe);`, then
  `const root = await abeClient.createPost({channel_id: incidents.id, message: ROOT});`, then
  `await abeClient.createPost({channel_id: incidents.id, message: REPLY, root_id: root.id});`
  - Never use `pw.random.post`, which appends a random id.
- **C1:** `expect.poll(() => adminClient.getChannelMember(incidents.id, user.id).then(m => m.notify_props.channel_auto_follow_threads)).toBe('on')`,
  plus lounge not `'on'`.
- **C3/C4:** auto-waiting `expect(page.getByRole('tab', {name: 'Followed threads', exact: true})).toHaveAttribute('aria-selected', 'true')`;
  `getByRole('tabpanel')` → `getByRole('link', {name: 'Thread by Abe Lindqvist', exact: true})` `toContainText(ROOT)`;
  `expect(page).toHaveURL(new RegExp(\`/${team.name}/threads/${root.id}$\`))`; reply text visible.
- **FINAL:** `const list = await userClient.getUserThreads(user.id, team.id, {}); expect(list.threads.map(t => t.id)).toContain(root.id);`
- **No** `pw.skipIfNoLicense()`, **no** `patchConfig`, **no** `ensureFeatureFlag`. Under an external server
  (`PW_USE_TESTCONTAINERS` unset) the restart helpers are unavailable anyway (`infra/INTERFACE.md`).

## 6. Observable UI evidence

| Evidence | Role and name | Status | Basis |
| --- | --- | --- | --- |
| Followed-thread filter | `tab "Followed threads"`, `aria-selected=true` by default | SOURCE-DERIVED | `GT/thread_list/thread_list.tsx:171-216`, `useTabs` `:295`, roles `:333-343` |
| List container | `tabpanel`, id `threads-list`, test id `threads_list` | SOURCE-DERIVED | `:262-267` |
| Thread row | `link "Thread by Abe Lindqvist"` (aria-label), root text as child content | SOURCE-DERIVED; child-text rendering in the aria snapshot is NOT verified | `GT/thread_item/thread_item.tsx:214-218`, `:280-297` |
| Empty state | text "No followed threads yet" | SOURCE-DERIVED | `GT/global_threads.tsx:172-181`; `en.json:23791` |
| Thread pane | `h3` holding "Thread" plus a button with the channel display name; follow toggle "Following" | SOURCE-DERIVED | `GT/thread_pane/thread_pane.tsx:110-162`; `en.json:31659` |
| Sidebar channel links | `link "incidents public channel"`, `link "lounge public channel"`; ` unread` suffix when unread | Naming rule LIVE-OBSERVED in earlier pilots | `sidebar_channel_link.tsx:133-156` |
| Channel menu button | `button "incidents channel menu"` (lowercased `'{displayName} Channel Menu'`) | Pattern LIVE-OBSERVED (`qa sandbox channel menu`) | `channel_header_menu.tsx:73-75`, `:131` |

The run must REPORT the live structure for C3 and C4 (charter `report_live`). If the aria snapshot does not render
the row's child text under the aria-labelled link, C3's `subtree_text_contains` cannot be evaluated from snapshots.
The emitter must stop rather than weaken the check. The replay locator (`toContainText`) would still work.

## 7. Minimum depth and budget (for the lead; not in the charter)

**Minimum-depth estimate:** 7 actuations from the start path.

- Five actuations make C1 true. That includes reaching the channel, because the preference dialog belongs to the
  current channel, and committing the dialog.
- The event then fires with no action.
- C3 becomes observable at depth 6 and C4 at depth 7.
- The doc names a second entry to the same dialog (`:26`, through the channel info panel), which costs one more
  actuation.
- `max_depth = 9` gives 2 steps of slack (for example a dismissed menu, or the second entry).

**Branching** (from the live inventories in `explorer-proto/generated/trace.md`: 45-50 role/name controls per
channel view on 12.1.0):

- Channel view: about 18-20 in play. Removed by the regions rule: about 9 global-header controls (product menu,
  search, recent mentions, saved, settings, help, account menu…) and about 20 composer controls plus the textbox.
  Removed by name patterns: "Open in new window", "Copy …".
- Channel header menu: about 10-12 menu items after excluding leave, archive, new window and copy.
- Preference dialog: about 12-15 controls (mute, ignore, desktop and mobile radios, reply-thread checkboxes, sound
  checkbox, same-as-desktop checkbox, the auto-follow checkbox, reset buttons, close, cancel, commit). The sound
  select is a combobox and is excluded.
- Followed-thread view: about 15 (two tabs, mark-all-read, rows, sidebar).

**Arithmetic:**

- If the engine expands every child of every state on the solution line, that is about
  18 + 18 + 11 + 14 + 14 + 20 + 16 ≈ 111 expansions.
- `max_actions = 240` leaves room for about 6-7 extra full expansions of off-line states. The likely ones are the
  followed-thread view before C1 (strong lexical overlap), lounge, the info panel and the members panel.
- `max_replays = 260` = 240 expansions plus about 20 confirmation replays.
- `max_states = 200` is above that bound.

**Wall clock:** one replay is a fresh fixture (about 15 REST calls), a login, a page load, up to 8 prefix actions
and possibly the event. That is about 5-12 s, so 260 × ~8 s ≈ 35 min, under `wall_clock_seconds = 3600`.

**Risks that the budget is too tight:**

- Wall clock binds first if a replay averages more than about 13.8 s.
- Lexical scoring gives the dialog's entry menu item no help (its name shares no goal word). If novelty scoring is
  weak, the engine may exhaust children of many off-line states first.
- A blind breadth-first search (about 18^5 prefixes before C1) is infeasible at any small budget. These numbers
  assume a working best-first heuristic.
- A budget-out is a reported failure, not a pass.

## 8. Negative control

- **The requested control cannot run on 12.1.0** (§2): the server refuses `ThreadAutoFollow=false` while CRT is
  on. Pairing it with `CollapsedThreads=disabled` changes Bea's UI.
- **Modal visibility with the flag off:** the section depends only on `isCollapsedThreadsEnabled` (`NM/index.ts:21`,
  modal `:438`). `ThreadAutoFollow` is not read by the modal, so the checkbox would still show if the patch were
  accepted.
- **Design intent, recorded in the charter:**
  - C3 fails at the UI assertion after the whole navigation succeeds.
  - C1, E1/C2 and the navigation pass.
  - The control would show that the C3 assertion detects missing server auto-follow, not that the product regresses
    in general.
- **Other global conditions considered and rejected:**
  - `CollapsedThreads=default_off`: auto-follow still runs, so nothing changes.
  - Fault injection on the notify-props request: C1 fails, not C3.
  - An explicit unfollow before the reply: needs a spec change, because the thread does not exist before the event.
  - `silent_notification` on the reply: a stimulus change, not a global condition.
  - A plugin that marks posts silent: needs a plugin upload, and `PluginSettings.EnableUploads` cannot be set over
    the API (`api4/config.go:306-309`).
  - Editing the database or config file: outside the pilot's rules.
- **Proposed replacement (lead decision):** a server mutant built from v12.1.0 with only the channel auto-follow
  loop (`notification.go:281-287`) removed, run with the same unchanged spec.
  - It changes exactly the condition that decides the outcome.
  - It needs a build and image, which is out of scope here, and a non-enterprise build also changes the edition.

## 9. Honest limitations

- **Goal-wording bias.**
  - The goal says "follow every new thread … in the Incidents channel … show up in my threads list … open one and
    read the replies". I left out "automatically" and "auto-follow" on purpose: they are near-verbatim control text.
    "follow", "threads" and "channel" still match 3 of the 6 words of the checkbox label.
  - "threads" matches the sidebar view link, and "incidents" plus "channel" match the incidents sidebar link and
    channel menu button.
  - The checkpoint texts ("Followed threads", "Thread by Abe Lindqvist") add more overlap if the heuristic reads
    predicates lexically.
  - So discovery of the dialog step and the threads view is partly helped by wording. Discovery of the dialog
    entry is not, because the entry's name shares no goal word.
  - A pass shows that a lexically guided search can complete the journey. It does not show that a user without
    these words would.
- **The teammate stimulus is REST, not UI.**
  - Abe's root and reply are posted by Abe's own REST client when C1 first holds.
  - Why: the journey's goal and outcome belong to Bea. Typing and hover-revealed reply controls are unproven in this
    explorer (no textbox actions, no hover).
  - The server path is the same `POST /api/v4/posts` the webapp uses, but nothing about Abe's UI is verified.
  - Every report and emitted spec must disclose this.
- **The heuristic search is new.** The engine owner implements the scoring. Its ranking decides whether the budget
  suffices, and nothing here proves the ranking is good.
- **Fresh fixture per replay** makes each expansion expensive and adds REST setup as a failure source. Setup
  failures must be reported as such, never as product findings.
- **The C3 snapshot rendering is unverified** (§6).
- **Engine support does not exist yet.** The current engine accepts only `explorer-session-charter/v1`
  (`src/charter.ts:14`) with an allowlist. Journey mode needs:
  - a fixture factory;
  - REST checkpoints and event triggers;
  - `action_rules` evaluation (roles, regions, patterns, modal scope);
  - heuristic best-first search;
  - template variables (`{team.name}`, `{event.E1.root_id}`).

## 10. What the emitted spec would and would not catch

**Would catch:**

- The dialog not saving `channel_auto_follow_threads` (C1).
- The server not making the opted-in member a follower on a reply (C3, FINAL).
- The followed-thread view not listing an auto-followed thread (C3).
- The thread pane not showing the reply (C4).
- The UI and the REST list disagreeing.
- The preference leaking to another channel's membership (C1, second clause).

**Would not catch:**

- Auto-follow behavior in a second channel (lounge has no posts).
- Root-only threads; explicit-unfollow handling; DMs or GMs; private channels.
- Unread or mention counts and badges; desktop, push or email notifications for auto-followed threads.
- The other dialog entry route (whichever one the search does not pick).
- `ThreadAutoFollow` or `CollapsedThreads` variants.
- The account-level channel-mention auto-follow setting; the mobile flow.
- Any 12.2.0 behavior.

## 11. v12.1.0 vs HEAD (only differences that matter)

- `NM/channel_notifications_modal.tsx`: HEAD adds board-kind variants of the auto-follow title, description and
  checkbox label. Normal channels keep the same strings.
- `GT/thread_list/thread_list.tsx`: HEAD turns "Mark all threads as read" into a compass `IconButton`. The tabs and
  tabpanel are unchanged.
- `notification.go`: HEAD adds a channel read-access broadcast hook before publishing thread events (`:916-918`,
  `:1080-1081`). The auto-follow block is unchanged.
- `thread_store.go`, `api4/config.go` and `channel_header_menu.tsx` changed, but not in the lines cited. The
  config validation rule is still present (HEAD `config.go:5350`).
- Unchanged: `thread_item.tsx`, `global_threads.tsx`, `thread_pane.tsx`, `global_threads_link.tsx`,
  `NM/index.ts`, `model/channel_member.go`.

## 12. Unavailable or unverified sources

- The feature map is not in the repo. I used `discovery.notifications` + `messages.threads` as given.
- No live run (no Docker by instruction):
  - every accessible name above is source-derived, except the sidebar link and channel-menu naming patterns seen
    in earlier pilot traces;
  - the aria-snapshot rendering of thread-row child text is unverified;
  - per-replay timing is an estimate.
- I did not verify that `crt_thread_pane_step` is still meaningful. `git grep` finds no reader in the v12.1.0
  webapp, and it is kept only for parity with the lib.
- Open PRs were searched by title and keyword only, not reviewed diff by diff.

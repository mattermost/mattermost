# Regression benchmark MM-71128: QA notes

These notes back up `charter.json` in this folder. The charter is the only file the runner reads
(`src/journey_charter.ts:61-62` loads `charterPath(journey)` and nothing else). This file is for the lead, the
engine owner and the verifier. It must not be passed to the runner. Journey
`posts.attachments:empty-value-field-titles`, feature `messages.compose`, lane Browser.

- **Kind of run:** historical product-regression benchmark on a known build pair. It is not a coverage-gap journey
  like `auto-follow`, and it is not the `bookmarks` seed-value control. Its results are reported on their own.
- **Sources:** every product claim was read with `git show v12.0.2:<path>` or `git show v12.1.0:<path>`. E2E test
  citations are at the current checkout (HEAD) and were spot-checked as identical at `v12.1.0`.
- **No route here.** These notes hold no ordered path and name no control the journey needs. The lead holds the
  verifier route separately.

## 1. Regression facts (re-verified)

| Fact | Evidence |
| --- | --- |
| Introduced | PR #36338, commit `1c801690a06a39ad5ad467a621196c19229295bb` ("Mattermost Blocks"). First release tag containing it: `v11.10.0` (`git tag --contains`; earliest `v11.10.0-rc1`). |
| Fixed | PR #39112, commit `0c66f929d073c9c75140f6a89537dc6c50a11a38`, merged 2026-10-13. Ancestor of `v12.1.0`, not of `v12.0.2` (`git merge-base --is-ancestor`). |
| Affected code at v12.0.2 | `webapp/channels/src/components/block_renderer/translation/attachments.ts:246-249`: `valueStr = formatAttachmentFieldValue(field.value); if (!valueStr) continue;` drops a field whose value is empty, even if it has a title. |
| Fixed code at v12.1.0 | Same file `:246-250`: a field is skipped only if both title and value are empty. `:265-267`: the value block is emitted only for a non-empty value. |
| Only change in the renderer | `git diff --stat v12.0.2 v12.1.0 -- webapp/channels/src/components/block_renderer`: `attachments.ts` (+8/-5), `translation/index.test.ts` (+59), its snapshot (+11). Nothing else. |
| Blocks routing | `post_body_additional_content.tsx:164-174` (v12.0.2; `:166-176` at v12.1.0): with `mmBlocksEnabled`, a post for which `hasInteractiveMessageProps` is true renders `InteractiveMessages`. `translation/index.ts:51-65`: true for a non-empty `props.attachments`. `:72-93` `translatePostProps` sends attachments to `translateAttachments`. |
| Flag source | `post_body_additional_content/index.ts:26`: `getFeatureFlagValue(state, 'MmBlocksEnabled') === 'true'`. Default `true` in `server/public/model/feature_flags.go` (`v12.0.0:241`, `v12.0.2:248`, `v12.1.0:260`). Exposed as `FeatureFlagMmBlocksEnabled` in the client config (`server/config/client.go:453-455` at v12.0.2, inside `GenerateLimitedClientConfig`, which the full client config extends at `:17`). `infra/docker-compose.yml` sets no feature-flag variable. |
| PR description | Names Matterpoll end-of-poll results as the affected case. Expected: both field titles render side by side under the attachment text. Release note: "Fixed an issue where message attachment fields with a title but an empty value were not displayed when Mattermost Blocks was enabled." (read-only `gh pr view 39112`). |
| Server accepts the fixture post | `api4/post.go:25` (`createPost`, session required), `:118` `SanitizeInput` (`model/post.go:748-755`: clears DeleteAt, RemoteId, embeds). `app/post.go:245` `SanitizeProps` (`model/post.go:621-681`) removes only `add_channel_member` and notification and identity markers (`:625-670`), never `attachments`. Same at v12.1.0 (`model/post.go:635`). Props size cap `:609`. |

### Exact rendered text of a field title

- `attachments.ts:261-263` (v12.0.2) and `:262-264` (v12.1.0): a kept field with a title emits the text block
  `**<title>:**`. The v12.1.0 unit test expects `'**Great (1 vote):**'` and `'**Meh (0 votes):**'` for
  empty-value short fields (`translation/index.test.ts:135-150`).
- `block_renderer/text_block.tsx:28-37`: each text block goes through the `Markdown` component, so the visible text
  is the bold string `Apple (3 votes):` and `Pear (0 votes):`, colon included.
- Attachment title: `**<title>**` (`attachments.ts:59-67`, `:229-234`). Attachment text: plain text block (`:71-73`).
- Expected result for the fixture post:

| Build | Visible | Missing |
| --- | --- | --- |
| v12.0.2 (affected) | `Poll closed: favourite fruit`, `Results are final`, `Control:`, `present` | `Apple (3 votes):`, `Pear (0 votes):` (both dropped at `:247`) |
| v12.1.0 (fixed) | all of the above, plus `Apple (3 votes):` and `Pear (0 votes):` (a two-column row, since both are short) | nothing |

The `Control` field (value `present`) is kept on both builds. Its presence proves the attachment rendered, so a
missing title is a real rendering difference and not a missing post.

- **Accessibility snapshot:** expected to expose the titles as static text inside the post list item (a paragraph
  or strong text node), not as the accessible name of a control. This is source-derived and not live-verified. The
  engine reads `text_contains` from the raw snapshot first and has a DOM `getByText` fallback
  (`src/journey_ui.ts:241-259`). The charter requires the method used to be reported per string and per state.
  Note that `normalizeSnapshot` drops posts from state keys (`src/snapshot.ts:144-163`); UI checkpoints are
  evaluated on the raw snapshot (`journey_ui.ts:114-115`), so posts are visible to checkpoints.

## 2. Closest existing tests (each opened)

Searches: `props.attachments` / `attachments`, `fields` with `short`, empty `value`, `MmBlocks` / `mm_blocks` /
`mm-blocks` / `block_renderer`, and `poll`, across `e2e-tests/cypress` and `e2e-tests/playwright`. No E2E test
posts an attachment field with an empty or null value. No E2E test reads or sets `MmBlocksEnabled`.

| Test | Line | What it asserts | Why not equivalent |
| --- | --- | --- | --- |
| Cypress at-mention, field title | `e2e-tests/cypress/tests/integration/channels/messaging/at_mention_loading_spec.ts:144` (post `:150-162`) | `:165` `cy.contains('th', 'Note from @<user>')` visible | Field has a value (`:157`). Asserts the legacy `th` table cell, not Blocks output. |
| Cypress at-mention, field value | same file `:169` | `:190` the at-mention renders as a link | Field has a value. |
| Cypress MM-T631 short fields | `e2e-tests/cypress/tests/integration/channels/integrations/incoming_webhook/slack_formatting_spec.js:226-268` | `:260-264` legacy `table:nth-child(..) > thead > tr > th` text `Short 2`, cell `Another one` | Every field has a value (`:233-234`). Legacy table selectors. |
| Cypress MM-T629 / MM-T630 | same file `:154`, `:190` | `:183-184`, `:219-220` a link and a taco emoticon inside `.attachment-field` | Fields non-empty. Checks markdown in values. |
| Cypress MM-T633 | `e2e-tests/cypress/tests/integration/channels/enterprise/integrations/incoming_webhook_spec.ts:46` | `:74-75` `.mm-blocks` visible, `.mm-blocks-text` contains the attachment text; `:90-91` in search results | One field with a value (`:55-61`). Asserts attachment text, never a field title. Needs Elasticsearch. |
| Playwright post height | `e2e-tests/playwright/specs/functional/channels/post_list/post_height.spec.ts:209-227` | `:470-475` post height stays constant | Attachment has no fields. Measures layout, not text. |
| Unit (not E2E) | `translation/index.test.ts:135` at v12.1.0 | translation output equals `**Great (1 vote):**` blocks | Translation only, no rendering, no UI. Absent at v12.0.2. |

### Why this regression is not already covered

The only test of the empty-value case is the unit test added by the fix. It checks the translator, not what the
member sees, and it did not exist on the affected build. The E2E tests that post attachment fields all give every
field a value, and two of them assert legacy table markup that the Blocks path does not produce.

## 3. Placement and fixture decisions

- **Placement:** the member lands in `Release Planning` (no user post). The post is in `QA Sandbox`. The runner must
  discover a general navigation to the post's surface. A post in the landing channel would make the checkpoint
  true or false in the start state, with no exploration at all.
- **Unread state:** after writing the post, the fixture views `QA Sandbox` first and `Release Planning` last (the current
  factory's reversed-declaration rule, `src/journey_fixture.ts:181-189`). No sidebar link carries the ` unread`
  suffix at start (`sidebar_channel_link.tsx:152-153`). Viewing changes read state only. The post is stored and is
  fetched when its channel is opened. Candidate names are always read live, so a renamed link would still be found.
- **Author:** the member posts through their own REST session. The user instruction allows one actor only. A real
  poll result usually comes from a plugin or bot. The renderer does not branch on the author for attachments.
- **Feature id:** `messages.compose`. The feature map is not in the repo; the only in-repo use of
  `messages.compose` is bake-off F3 (`v2/bakeoff/PREREGISTRATION.md:41`). Lead may override.
- **Goal wording bias:** the goal says "closed", "poll", "votes" and "results". None of these stems matches a
  control name the journey needs, and `team` and `channel` are stopwords, so the lexical score gives no hint about
  where the post is. But the goal still tells the runner what to read, and the checkpoints tell the engine what
  text counts. A runner told nothing would have no reason to look for field titles.
- **Fixture placement is runner-visible:** the charter's fixture block says which channel holds the post. The
  engine's score (`README-engine.md`, heuristic section) reads goal terms, checkpoint progress, novelty and depth
  only, never fixture placement. The engine owner must keep it that way for this run.

## 4. Outcomes

| Run verdict | Meaning |
| --- | --- |
| `PASS` | The attachment rendered in some reached state with both field titles visible, confirmed by a fresh-fixture replay, and no state anywhere showed the attachment without the titles. Expected on v12.1.0. |
| `PRODUCT_FAILURE` | Some reached state showed the attachment (title, text, Control field) without the two empty-value titles, and a fresh-fixture replay of that state's path reproduced it. Holds even if another path passed. Expected on v12.0.2. |
| `INCONCLUSIVE` | The attachment never rendered within budget, or an observation could not be confirmed. Says nothing about the product. Reported as an open validation item. |
| `SETUP_FAILURE` | Precondition or read-back failed (flag not `'true'`, post rejected, C-DATA false). Not a verdict. Reported as an open validation item. |

**Observation policy (summary):** every checkpoint evaluation in every state, branch and replay is logged
append-only with its full action path. Failing observations are copied to `failing_observations` and are never
erased by a passing path, state dedupe or path selection. Each path with a decisive classification gets a
fresh-fixture confirmation replay, failing paths first, from six reserved replays. The search does not stop at the
first rendered state.

## 5. Budget

`max_actions 40`, `max_depth 3`, `max_states 30`, `max_replays 60` (6 reserved for confirmation),
`wall_clock_seconds 1500`.

- Depth: one general navigation reaches the post. Depth 2 covers a right-hand panel opened from a per-post control,
  which renders the post a second time. Depth 3 allows one dialog or menu step beyond that.
- Actions: a channel view offers roughly 25 to 35 in-play candidates after the exclusions. 40 expansions cover all
  depth-1 candidates and a few deeper ones.
- Replays: 40 expansions plus up to 6 confirmations plus margin. Each replay builds a fixture and signs in.
- Wall clock: settle waits (up to 8 s per state for C-RENDER-CONTROL) dominate. 60 replays at about 20 s take 1200 s; 1500 leaves slack for stack latency.
- The budget is fixed before the run and is the same on both builds.

## 6. Limits of this benchmark

- **Shallow journey.** The visible outcome is static text of a post created by REST. The UI part is opening the
  channel that holds it. The run exercises surface discovery only lightly.
- **What it demonstrates:** that the explorer, with a frozen charter and engine and no reference route, reaches a
  state where the post renders, and that its checkpoint classifies that state as `PRODUCT_FAILURE` on the affected
  build and `PASS` on the fixed build, with failing observations preserved and reproduced.
- **What it does not demonstrate:** deep exploration; finding an unknown bug; that the explorer would have found
  this bug without the declared expected outcome. The expected text comes from the fix's PR and code, written
  after the bug was known.
- **Build pair evidence.** The tag-to-commit mapping rests on git tag names and commit dates. Both tags are
  lightweight (they point straight at commits). Image config labels could not be read here (no Docker by
  instruction). The lead must read the running server's build identity at run time:

| Build | Expected `BuildHash` | Tag commit date |
| --- | --- | --- |
| 12.0.2 | `13ae6c4cf1a8e73c35a4f0c8816a505506c7acdd` (`git rev-parse v12.0.2^{commit}`) | 2026-11-04 |
| 12.1.0 | `243e3d0135203ab9166fe8f2873b07f697b06fd4` (`git rev-parse v12.1.0^{commit}`) | 2026-11-05 |

  `BuildHashEnterprise` cannot be predicted: `/agent/repos/enterprise` has no `v12.0.2` or `v12.1.0` tag. Record it
  only. Also expect `Version` to start with `12.0.2` and `12.1.0`. A `BuildHash` mismatch makes the pair unusable
  until the lead explains it (for example a rebuild from a release-branch commit); it is reported as an open
  validation item, not a product result.

## 7. Freeze procedure (before the measured run)

1. The engine owner implements the proposed extensions listed in section 9 and commits them. No measured run
   happens before this, because the current engine cannot tell `PRODUCT_FAILURE` from `INCONCLUSIVE`.
2. The working tree must be clean for `explorer-proto/` and `e2e-tests/playwright/lib/`
   (`git status --porcelain -- explorer-proto e2e-tests/playwright/lib` empty).
3. The lead records, in order, in a lead-owned record outside this folder:
   1. `git rev-parse HEAD` (the frozen commit).
   2. `sha256sum explorer-proto/sessions/regression-attachment-fields/charter.json`.
   3. Engine tree hash: `git rev-parse HEAD:explorer-proto/src`, plus `git rev-parse HEAD:explorer-proto/playwright.config.ts`
      and `git rev-parse HEAD:e2e-tests/playwright/lib` (the fixture factory uses the lib clients).
   4. `sha256sum` of this QA-NOTES.md (kept away from the runner; hashed so it cannot change silently).
   5. Both image refs with digests, as given in `target_release.build_pair`.
4. Immediately before and after each run, re-check the same hashes. Any difference makes the run invalid.
5. The charter is self-contained. No edit is planned after freezing. If one becomes necessary, the run restarts
   from the top of this procedure with new hashes, and the old results are reported as void, not overwritten.

## 8. Independent replay plan

- **Explorer runs:** the frozen engine runs this charter once on the affected image and once on the fixed image
  (`MATTERMOST_PILOT_IMAGE` set to each digest-pinned ref; stack torn down between runs). Expected verdicts:
  `PRODUCT_FAILURE` and `PASS`.
- **Verifier replay (independent):** a person or process that did not write the engine takes the representative
  path of the affected run's confirmed `failing_observations` entry. On a fresh fixture built from this charter it
  replays that path on the affected image and evaluates C-DATA, C-RENDER-CONTROL and C-RENDER-TITLES with its own
  web-first Playwright locators (not the engine's evaluator). It replays the same path on the fixed image and
  evaluates the same checkpoints. The verifier also runs the lead's sealed route on both images as a second,
  route-independent check.
- **Confirmation means:** on the affected image, C-DATA true, C-RENDER-CONTROL true, C-RENDER-TITLES false; on the
  fixed image, all three true; both for the explorer's path and the sealed route; and `BuildHash` matching
  section 6 on each image.
- **If the pair is unusable** (an image digest is not present locally, the stack does not come up, the flag
  precondition fails, or `BuildHash` mismatches): report "build pair unusable" with the reason as an open
  validation item. Do not substitute another tag, digest or image.
- **If a journey is inconclusive:** report `INCONCLUSIVE` with the preserved observations as an open validation
  item. Do not raise the budget or edit the charter after freezing.

## 9. Engine capabilities this charter needs (proposed extensions)

| Capability | Charter key | Current engine |
| --- | --- | --- |
| Append-only per-state, per-branch checkpoint log with action paths | `observation_policy` | Records checkpoint progress per state for scoring; no preserved failure list. |
| Preservation of failing observations across passing paths | `observation_policy.preserve_failures` | Not present. |
| Three-outcome verdict plus `SETUP_FAILURE` | `success_criteria.outcomes` | Only "qualifying path found and emitted" or "none found". |
| Confirmation of failing paths, reserved replays | `observation_policy.confirmation`, `budget_reserve` | Confirms qualifying paths only. |
| No early stop | `observation_policy.no_early_stop` | Not specified. |
| Web-first settle for UI checkpoints | `checkpoints[].predicate.settle` | Single evaluation; DOM fallback count does not wait. |
| Post-scoped text matching | `checkpoints[].predicate.post_scope` | Page-wide only. |
| Fixture-created posts and `{post.<key>.id}` binding | `fixture.posts` | No post writes in the factory. |
| Nested REST matchers | `C-DATA.predicate.expect` | Top-level fields only. |
| Client-config precondition | `fixture.server_preconditions` | Reads `GET /api/v4/config` as admin. |

Emission of a repo-native spec is not part of this benchmark's result. If the engine emits one, it must never
emit a spec from a path whose classification is `RENDERED_TITLES_MISSING` as a passing test.

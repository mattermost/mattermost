# Phase 8: Release

**Goal**: Update the Jira ticket, prep release metadata, plan backports, and draft release notes.

Steps 8.1–8.4 require a Jira ticket and are skipped if none was identified. Step 8.5 (Release Planning) always runs. If `acli` is unavailable, all Jira/Confluence calls fall back to Atlassian MCP, then manual prompts if both are missing ([rules.md §5.3](rules.md#53-cli-tool-fallback)).

## Step 8.1: Transition Ticket Status
Use `acli jira workitem` to update the ticket:
- **Status**: Move to `Submitted` (or the project's equivalent PR-submitted state)
- If transition fails (e.g., invalid workflow state), report and skip — don't block

## Step 8.2: Update Ticket Fields
Set these fields if available and applicable:

| Field | Value |
|-------|-------|
| Fix Version | Current development target (detect from branch name or ask user) |
| PR Link | The PR URL from Phase 7 |
| Labels | Add `has-pr` or equivalent if project uses it |

## Step 8.3: Add QA Test Steps
Post a comment on the ticket with structured QA test steps derived from:
- Acceptance criteria (from Phase 1 spec.md)
- Exploratory testing checklist (from Phase 4)
- Key user flows and edge cases

Format:
```text
QA Test Steps (auto-generated from /longshot):

Setup:
1. Check out branch: <branch-name>
2. Deploy locally / use test server

Verification:
1. [ ] <acceptance criterion 1> — expected: <behavior>
2. [ ] <acceptance criterion 2> — expected: <behavior>
...

Edge Cases:
1. [ ] <edge case from gap analysis>
2. [ ] <edge case from exploratory testing>

Regression:
1. [ ] Verify existing <related feature> still works
2. [ ] No console errors on affected pages
```

## Step 8.4: Link PR to Ticket
If not already linked via branch name convention, add the PR as a linked item on the ticket.

## Step 8.5: Release Planning

Always runs. Depth scales based on scope and whether this is a security issue.

**For all tickets** (standard release planning):

1. **Determine fix version**: If not already set in state.json `release.fix_version`, identify the target release:
   - **With ticket** (`state.json.repo` has a Jira ID): check the ticket's Fix Version via `acli jira workitem view`; query Jira project versions (`acli jira workitem search --jql "project = MM AND fixVersion = '<version>'" --fields fixVersion`) for Unreleased/Released status; update `state.json.release.fix_version` and set the field on the ticket.
   - **Without ticket**: skip Jira reads/writes entirely. Detect from branch name (e.g., `release-10.5` → `10.5.0`) or ask the user; write to `state.json.release.fix_version` only.
   - Either path: cross-reference with the [Mattermost Server Releases page](https://docs.mattermost.com/product-overview/mattermost-server-releases.html#latest-releases) to verify currency and release date.

2. **Backport eligibility**: Evaluate whether this fix should be cherry-picked to any active release or ESR branches:
   - Query Jira for active release versions and their statuses — look for versions marked as Unreleased to identify branches still accepting fixes
   - Reference the [Mattermost Server Releases page](https://docs.mattermost.com/product-overview/mattermost-server-releases.html#latest-releases) for support windows and ESR status
   - Is this a bug fix (not a new feature)?
   - Does it affect functionality available in older releases?
   - If yes to both: identify which maintained branches need the backport by cross-referencing Jira's active versions with the releases page's support windows
   - Record in `state.json.release.backport_targets`
   - Ask the user to confirm the backport list before adding it to the Jira ticket

3. **Document in Jira**: If backports are confirmed, add a comment to the ticket listing target branches and their status.

4. **Release notes & changelog** (non-security issues):
   - If the project maintains a `CHANGELOG.md` or release notes file: draft a concise entry — feature name, one-line description, PR link
   - If there are user-facing changes: draft a customer-facing release note in plain language (one short paragraph, no jargon)
   - If there are documentation updates needed (new config options, changed API surface, migration steps): verify docs were updated in Phase 7.1, or open a follow-up ticket if deferred
   - Ask user to confirm or edit the release note draft before closing the ticket

**Additional steps when `is_security_issue: true`**:

4. **CVE field prep**:
   - Extract CVE ID from the Jira ticket (check description, custom fields, and comments via `acli jira workitem view`)
   - If a CVE ID is present: update `state.json.security.cve` and set the CVE field on the Jira ticket
   - If no CVE yet: note that Security team will assign one; leave a comment on the ticket referencing the PR

5. **CVSS / severity confirmation**:
   - Verify the severity field matches what's documented in the ticket (Security team owns this)
   - If missing or unclear: leave a comment on the ticket asking Security team to confirm before release

6. **Backport coordination** (security-specific):
   - Security fixes typically need backports to ALL actively maintained ESR/release branches — not just the latest
   - Identify affected versions from the ticket's "Affected Versions" field or description
   - For each affected version that has an active branch: add to `state.json.release.backport_targets`
   - Coordinate with Security team on timing — backport PRs may need to land simultaneously (coordinated release)
   - Do NOT open backport PRs until Security team gives the go-ahead (embargo timing)

7. **Security team notification**: Remind the user to update the Security team in the appropriate Mattermost channel that the PR is submitted, fix version is set, and backport targets are identified.

Update state.json per [rules.md §1.5](rules.md#15-statejson-update-ritual). Additionally set top-level `status = "complete"` to close the run.

---

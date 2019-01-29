# Code Contribution Guidelines

Thank you for your interest in contributing! Please see the [Mattermost Contribution Guide](https://developers.mattermost.com/contribute/getting-started/) which describes the process for making code contributions across Mattermost projects and [join our "Contributors" community channel](https://pre-release.mattermost.com/core/channels/tickets) to ask questions from community members and the Mattermost core team.

### Review Process for this Repo

When you submit a pull request, it goes through the review process outlined below. We aim to start reviewing pull requests in this repo the week they are submitted, but the length of time to complete the process will vary depending on the pull request.

The one exception may be around release time, where the review process may take longer as the team focuses on our [release process](https://docs.mattermost.com/process/release-process.html).

#### PR submitted

After a PR is submitted, a core committer applies labels and notifies product managers (PMs) that there is a PR awaiting review by posting in the [PM/Docs PR Review channel](https://pre-release.mattermost.com/core/channels/pmdocs-pr-review-pub), which is a channel to discuss community pull requests that need review by PMs.

Then, one or more of the labels is applied:
 - `Awaiting PR`: Applied if the PR is awaiting another to be merged. For example, when a client PR is awaiting a server PR to be merged first. Once the PR is no longer blocked, the core committer removes the `Awaiting PR` label.
 - `1: PM Review`: Applied if the PR has UI changes or functionality that PMs can test on test servers called "spinmints".
 - `Major Change`: Applied if the PR is a major feature or affects large areas of the code base, e.g. [moving channel store and actions to Redux](https://github.com/mattermost/platform/pull/6235).
 - `Setup Test Server`: Applied if the PR is queued for PM testing.
 - `Work in Progress`: Applied if the PR is unfinished and needs further work before it's ready for review.

#### Stage 1: PM Review

A product manager (PM) will review the pull request to make sure it:
 - Fits with our product roadmap.
 - Works as described in the ticket.
 - Meets [user experience guidelines](https://docs.mattermost.com/developer/fx-guidelines.html).

This step is sometimes skipped for bugs or small improvements with a well-defined ticket. In this case the core committer will assign the appropriate devs for review. A PM can also ask developer support to set up a separate test instance if the PR cannot be easily tested.

When the review process begins:
 - Mattermost Core Committer
    - Assigns `1: PM Review` label within 1 business day after the PR is submitted.
    - Assigns PM reviewer under Assignees. Those related to end user features are assigned to @esethna, others to @jasonblais. PM re-assigns as needed.
 - PM
   - Applies milestone for next release if the PM thinks there is enough time for the PR to be merged and sufficiently tested on `master` before code complete. Otherwise moved to a future release, letting submitter know that PR may have a delay in review due to the release cycle.
 - Follows up with contributor if the CLA has not been signed. If no response within 7 days, PM closes the issue.
 - PM verifies there is a corresponding JIRA ticket or GitHub issue.

Next, the PM tests changes on a spinmint test server:
 - PM tests and verifies pull requests via the `Setup Test Server` label. Initial review is completed within 2 business days.
 - If changes are required, PM submits review as "Changes Requested", with a comment on the areas that require updates. Comment explains why changes are needed linking back to design principles.
   - PM applies `Awaiting Submitter Action` label to more easily query the PR queue.
   - Once changes are made, PM regenerates test server and repeats testing.
 - If bugs are found that are also on `master`, a new bug report is submitted in JIRA and linked to the PR. Bugs that are also found on `master` will typically not block merging of PRs.
 - If PR is approved, PM submits review as "Approved", commenting with areas that were tested.
 
#### Stage 2: Dev Review

Two developers will review the pull request and either give feedback or approve the PR. Any comments should be addressed before the pull request moves on to the next stage.

 - PM reviewer adds `2: Dev Review` label, removes `1: PM Review` and `Setup Test Server` labels, and assigns 2 developers for review under Reviewers.
   - At least one dev is assigned based on their [feature area](https://docs.mattermost.com/developer/core-developer-handbook.html#current-core-developers). Devs re-assign as needed.
 - Devs review the code and provide feedback, with initial review completed within 2 business days. Some areas to check include:
   - Proper Unit Tests
   - API documentation
   - Localization
 - After the submitter has addressed and satisfied all reviewers' comments, `3: Ready to Merge` label is applied.

#### Stage 3: Ready to Merge

Review process is complete and the pull request is merged.

 - Dev assigns `3: Ready to Merge` label.
 - If Mattermost is not in release mode (between [major feature cut and release candidate cut](https://docs.mattermost.com/process/release-process.html)), the PR is merged into `master`.
 - If the PR is a major change, merge is postponed until the next release cycle.
   - Dev calls out on the issue that it is a major change and it will be merged after branching.
   - Once the current release is branched the PR can be merged into `master`.

#### PR Merged

After a PR is merged:
- External Contributions: PM closes the [Help Wanted] issue and related JIRA ticket.
- Internal Contributions: Core committer resolves the JIRA ticket.
- PM follows up for docs and changelog, and QA for release tests.

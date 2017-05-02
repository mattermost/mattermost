# Code Contribution Guidelines

Thank you for your interest in contributing! Please see the [Mattermost Contribution Guide](http://docs.mattermost.com/developer/contribution-guide.html) which describes the process for making code contributions across Mattermost projects.

### Review Process for this Repo

When you submit a pull request, it goes through the review process outlined below. We aim to start reviewing pull requests in this repo the week they are submitted, but the length of time to complete the process will vary depending on the pull request.

The one exception may be around release time, where the review process may take longer as the team focuses on our [release process](https://docs.mattermost.com/process/release-process.html).

#### PR submitted

After a PR is submitted, a core committer applies labels and notifies product managers (PMs) that there is a PR awaiting review by posting in the [PM/Docs PR Review channel](https://pre-release.mattermost.com/core/channels/pmdocs-pr-review-pub), which is a channel to discuss community pull requests that need review by PMs.

Then, one or more of the labels is applied:
 - `Awaiting PR`: Applied if the PR is awaiting another to be merged. For example, when a client PR is awaiting a server PR to be merged first. Once the PR is no longer blocked, the core committer removes the `Awaiting PR` label
 - `1: PM Review`: Applied if the PR has UI changes or functionality that PMs can test on test servers called "spinmints"
 - `Major Change`: Applied if the PR is a major feature or affects large areas of the code base, e.g. [moving channel store and actions to Redux](https://github.com/mattermost/platform/pull/6235)
 - `Setup Test Server`: Applied if the PR is queued for PM testing
 - `Work in Progress`: Applied if the PR is unfinished and needs further work before it's ready for review

#### Stage 1: PM Review

A product manager will review the pull request to make sure it:

 - Fits with our product roadmap
 - Works as described in the ticket
 - Meets [user experience guidelines](https://docs.mattermost.com/developer/fx-guidelines.html)

This step is sometimes skipped for bugs or small improvements with a well defined ticket.

When the review process begins, the PM applies a milestone:
 - Set for next release if the PM thinks there is enough time for the PR to be merged and sufficiently tested on `master` before code complete.
 - Set for a future release if PR is too large to test prior to the code complete date
   - PM responds to submitter letting them know that PR may have a delay in review due to the release cycle

Next, the PM tests changes on the spinmint:
 - If changes are required, PM submits review as "Changes Requested", with a comment on the areas that require updates. Comment explains why changes are needed linking back to design principles.
   - PM applies `Awaiting Submitter Action` label to more easily query the PR queue
   - Once changes are made, PM regenerates test server and repeats testing.
 - If bugs are found that are also on `master`, a new bug report is submitted in JIRA and linked to the PR. Bugs that are also found on `master` will typically not block merging of PRs.
 - If PR is approved, PM submits review as "Approved" commenting with areas that were tested. Then:
   - PM removes `1: PM Review` and `Setup Test Server` labels
   - PM applies the `Stage 2: Dev Review` label, which moves the PR to Stage 2

#### Stage 2: Dev Review

Two developers will review the pull request and either give feedback or approve the PR. If changes are required:
 - Dev submits review as "Changes Requested", with a comment on the areas that require tweaks.
 - Once changes are made, dev reviews code changes

Any comments should be addressed before the pull request moves on to the last stage.

#### Stage 3: Ready to Merge

The review process is complete, and the pull request will be merged.

#### PR Merged

After a PR is merged:
- External Contributions: PM closes the [Help Wanted] issue and related Jira ticket
- Internal Contributions: Core committer resolves the JIRA ticket
- PM follows up for docs, changelog and release tests when working through the PR tracking spreadsheet

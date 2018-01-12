# Code Contribution Guidelines

Thank you for your interest in contributing! Please see the [Mattermost Contribution Guide](http://docs.mattermost.com/developer/contribution-guide.html) which describes the process for making code contributions across Mattermost projects.

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

#### Stage 1: Community Pull Request is submitted to any Mattermost Repo

#### Stage 2: Assign `1: PM Review` label

 - The label should be assigned within 1 business day.
 - Any Mattermost Core Committer can add the label.
 - Core Committer will assign PM under Assignees.
   - Assignment of PM should be based on their feature area (**see link??**).
   - When in doubt, look for a related Jira ticket or Github issue.
   - If still unclear, assign based on best judgment.
   - PM to re-assign to proper owner if needed.
 - In some instances it makes sense to skip this stage, if, for example, it is an internal code change from a core commmitter and doesn't need PM review.
   - In this case the core committer will submit the PR and assign the appropriate devs for review.

#### Stage 3: PM Review

A PM will review the pull request to make sure it:

 - Fits with our product roadmap.
 - Works as described in the ticket.
 - Meets [user experience guidelines](https://docs.mattermost.com/developer/fx-guidelines.html).

This step is sometimes skipped for bugs or small improvements with a well defined ticket.

When the review process begins, the PM applies a milestone:
 - Set for next release if the PM thinks there is enough time for the PR to be merged and sufficiently tested on `master` before code complete.
 - Set for a future release if PR is too large to test prior to the code complete date.
   - PM responds to submitter letting them know that PR may have a delay in review due to the release cycle.

- Initial review should be completed within 24-48 hrs (1-2 business days).
 - PM to follow up if the CLA has not been signed.
   - If no response after 7 days, PM to close the issue.
 - PM to verify there is a corresponding Jira ticket or Github issue.
   - If no corresponding issue is found, PM will do extra vetting. However, this is lower priority.

- PM tests and verifies pull requests utilizing the Setup Test Server.
 - If changes are required, PM submits review as "Changes Requested", with a comment on the areas that require updates. Comment explains why changes are needed linking back to design principles.
 - Not all pull requests can be tested so this step may be optional or PMs might require developer support to set up a test instance.
   - PM applies `Awaiting Submitter Action` label to more easily query the PR queue.
   - Once changes are made, PM regenerates test server and repeats testing.
 - If bugs are found that are also on `master`, a new bug report is submitted in JIRA and linked to the PR. Bugs that are also found on `master` will typically not block merging of PRs.
 - If PR is approved, PM submits review as "Approved", commenting with areas that were tested.
 
#### Stage 4: Assign `2: Dev Review` label

 - PM owner to add label and remove `1: PM Review` and `Setup Test Server` labels.
 - PM to assign 2 devs for review under Reviewers.
 - Primary dev should be assigned based on their feature area link.
 - Secondary dev should be assigned as well, but doesn't need to be in their feature area.
   - When in doubt, devs should be assigned based on best guess, or person who appears to have cycles.
 - Devs will re-assign to proper owner if needed.

#### Stage 5: Dev review

 - Initial review should be completed within 24-48 hrs (1-2 business days).
 - Devs to review the code and provide initial feedback.
   - Things to look for:
     - Proper Unit Tests
     - API documentation
     - Localization
 - After the submitter has addressed and satisfied all reviewers' comments, the PR will be marked as approved.
 - PRs require a minimum of 2 dev approvals. They will either give feedback or approve the PR. If changes are required:
   - Dev submits review as "Changes Requested", with a comment on the areas that require tweaks.
   - Once changes are made, dev reviews code changes.
 - Any comments should be addressed before the pull request moves on to the next stage.

#### Stage 6: Ready to Merge

 - Assign `3: Ready to Merge` label.
 - Verify we are not in release mode and the PR can be merged into master.
 - If the PR is a major change we prefer to postpone the merge for the next release cycle.
   - Call out on the issue that it is a major change and it will be merged after branching.
   - Once the current release is branched the PR can be merged into master.

#### Step 7: Merge the PR

 - The review process is complete, and the pull request will be merged.

#### PR Merged

After a PR is merged:
- External Contributions: PM closes the [Help Wanted] issue and related Jira ticket.
- Internal Contributions: Core committer resolves the JIRA ticket.
- PM follows up for docs, changelog and release tests when working through the PR tracking spreadsheet.

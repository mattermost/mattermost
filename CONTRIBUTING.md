# Code Contribution Guidelines

Please see the [Mattermost Contribution Guide](http://docs.mattermost.com/developer/contribution-guide.html) which describes the process for making code contributions across Mattermost projects. 

### Review Process for this Repo

After following the steps in the [Contribution Guide](http://docs.mattermost.com/developer/contribution-guide.html), submitted pull requests go through the review process outlined below. We aim to start reviewing pull requests in this repo the week they are submitted, but the length of time to complete the process will vary depending on the pull request.

The one exception may be around release time, where the review process may take longer as the team focuses on our [release process](https://docs.mattermost.com/process/release-process.html). 

#### PR submitted
Dev applies labels and alerts PMs that there is a PR awaiting review by posting in the [PM/Docs PR Review channel](https://pre-release.mattermost.com/core/channels/pmdocs-pr-review-pub)
 - `Awaiting PR`
  - Applied if the PR is awaiting for another to be merged. For exampl,e when a client PR is awaiting a server PR to be merged first.
  - PR is on hold until it's no longer blocked, then dev removes the `Awaiting PR` label
 - `1: PM Review`
  - Applied if PR has UI changes or functionality that PMs can test on spinmints
 - `Setup Test Server`
  - Applied if the PR is queued for PM review for testing
 - `Work in Progress`
  - Applied if the PR is unfinished
  - PR is not reviewed until the label is removed

#### Stage 1: PM Review

A Product Manager will review the pull request to make sure it:

 - Fits with our product roadmap
 - Works as expected
 - Meets UX guidelines

This step is sometimes skipped for bugs or small improvements with a ticket, but always happens for new features or pull requests without a related ticket.

The Product Manager may come back with some bugs or UI improvements to fix before the pull request moves on to the next stage.

- PM applies milestone:
 - Set for next release if the PM thinks there is enough time for the PR to be merged and sufficiently tested on `master` before code complete.
 - Set for a future release if PR is too large to test and merge prior to code complete date
   - PM responds to submitter letting them know that PR may have a delay in review due to the release cycle and can be taken in `master` after the release branch is cut 

- PM tests on spinmint:
 - If changes are required, PM submits review as "Changes Requested", with a comment on the areas that require updates. Comment explains why changes are needed linking back to design principles.
   - PM applies "Awaiting Submitter Action" label to more easily review the PM PR review queue
   - Once changes are made, PM regenerates test server and repeats testing.
 - If bugs are found that are also on `master`, submit a new bug report in JIRA and link them in the PR so the submitter is aware they exist
 - If PR is approved, PM submits review as "Approved" commenting with areas that were tested
   - PM removes `1: PM Review` and `Setup Test Server` labels
   - PM applies the `Stage 2: Dev Review` label, which moves the PR to Stage 2

#### Stage 2: Dev Review

Two developers will review the pull request and either give feedback or approve the PR. If changes are required
 - Dev submits review as "Changes Requested", with a comment on the areas that require tweaks.
 - Once changes are made, dev reviews code changes

Any comments will need to be addressed before the pull request moves on to the last stage.

#### Stage 3: Ready to Merge

The review process is complete, and the pull request will be merged. 

#### PR Merged

- External Contributions: PM closes the [Help Wanted] issue and related Jira ticket
- Internal Contributions: Dev resolves JIRA ticket
- PM follows up for docs, changelog and release tests when working through the PR tracking spreadsheet

---
title: "Labels"
heading: "Use labels to track issues and PRs at Mattermost"
description: "We leverage GitHub labels to track the details and lifecycle of issues and pull requests. Learn what our labels mean."
date: 2018-03-06T00:00:00-04:00
weight: 7
aliases:
  - /contribute/getting-started/labels
---

We leverage {{< newtabref href="https://help.github.com/en/articles/about-labels" title="GitHub labels" >}} to track the details and lifecycle of issues and pull requests.

# Issue labels

* `Area/<name>`: Involves changes to the named area (APIv4, E2E Tests, Localization, Plugins, etc.)
* `Bug Report/Open`: Bug report unresolved, awaiting for more information or in development backlog.
* `Bug Report/Scheduled for Release`: Bug report resolved and scheduled for an upcoming release. Milestone indicates scheduled release version.
* `Difficulty/1:easy`: Easy ticket.
* `Difficulty/2:medium`: Medium ticket.
* `Difficulty/3:hard`: Hard ticket.
* `Good First Issue`: Suitable for first-time contributors.
* `Help Wanted`: Community help wanted.
* `Move to Feature Ideas forum`: Marked for relocation to the feature ideas forum.
* `Move to Troubleshooting`: Marked for relocation to the troubleshooting section of the documentation.
* `PR Submitted`: A pull request has been opened for this issue.
* `Tech/<name>`: Requires using the named technology (Go, JavaScript, ReactJS, Redux, etc.)
* `Up for Grabs`: Ready for help from the community. Removed when someone volunteers.

# Pull request labels

* `1: PM Review`: Requires review by a {{< newtabref href="https://handbook.mattermost.com/contributors/contributors/core-committers#product-managers" title="product manager" >}}.
* `1: UX Review`: Requires review by a UX designer.
* `1: SME Review`: Requires review by a subject matter expert (used in the Handbook).
* `2: Dev Review`: Requires review by a {{< newtabref href="https://handbook.mattermost.com/contributors/contributors/core-committers#core-committers" title="core committer" >}}.
* `2: Editor Review`: Requires review by a {{< newtabref href="https://handbook.mattermost.com/contributors/contributors/core-committers#technical-writers" title="technical writer" >}}.
* `3: QA Review`: Requires review by a {{< newtabref href="https://handbook.mattermost.com/contributors/contributors/core-committers#qa-testers" title="QA tester" >}}. May occur at the same time as Dev Review.
* `4: Reviews Complete`: All reviewers have approved the pull request.
* `Awaiting Submitter Action`: Blocked on the author.
* `AutoMerge`: If all checks and approvals pass and the user adds this label, it will be in the queue to get merge automatically without a human intervention.
* `Changelog/Done`: Required changelog entry has been written.
* `Changelog/Not Needed`: Does not require a changelog entry.
* `CherryPick/Approved`: Meant for the quality or patch release tracked in the milestone.
* `CherryPick/Candidate`: A candidate for a quality or patch release, but not yet approved.
* `CherryPick/Done`: Successfully cherry-picked to the quality or patch release tracked in the milestone.
* `Demo Plugin Changes/Needed`: Requires changes to the demo plugin.
* `Demo Plugin Changes/Done`: Required changes to the demo plugin have been submitted.
* `Do Not Merge/Awaiting Loadtest`: Must be loadtested before it can be merged.
* `Do Not Merge/Awaiting Next Release`: To be merged with the next release (e.g. API documentation updates).
* `Do Not Merge/Awaiting PR`: Awaiting another pull request before merging (e.g. server changes).
* `Do Not Merge`: Should not be merged until this label is removed.
* `Docs/Done`: Required documentation has been written.
* `Docs/Needed`: Requires documentation.
* `Docs/Not Needed`: Does not require documentation.
* `Hackfest`: Related to a Mattermost hackathon.
* `Hacktoberfest`: Related to {{< newtabref href="https://hacktoberfest.digitalocean.com/" title="Hacktoberfest" >}}.
* `Lifecycle/<state>`: An [inactive contribution]({{< ref "/contribute/more-info/getting-started/inactive-contributions" >}}).
* `Loadtest`: Triggers an automatic load test.
* `Major Change`: The pull request is a major feature or affects large areas of the code base (e.g. {{< newtabref href="https://github.com/mattermost/platform/pull/6235" title="moving channel store and actions to Redux" >}}).
* `QA Deferred`: Testing of this PR is expected to be completed after merge, likely when it is available on Community. Apply this in lieu of asking for `3: QA Review`.
* `Setup Cloud Test Server`: Triggers the creation of a Enterprise Edition test server.
* `Setup HA Cloud Test Server`: Triggers the creation of a test server that has high availability.
* `Setup Cloud + CWS Test Server`: Triggers the creation of a test server that connects to our test Customer Web Server.
* `Setup Upgrade Test Server`: Triggers the creation a test server and performs an upgrade.
* `Tests/Done`: Required tests have been written.
* `Tests/Not Needed`: Does not require tests.
* `Work in Progress`: Not yet ready for review.

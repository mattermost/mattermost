---
title: "Slash commands"
heading: "Get started with Mattermost slash commands"
description: "There are some slash commands available on GitHub that can be implemented via Mattermod. Learn more about what they are."
weight: 30
aliases:
  - /contribute/getting-started/slash-commands
---

There are a couple of slash-commands available on GitHub which are implemented via {{< newtabref href="https://github.com/mattermost/mattermost-mattermod" title="Mattermod" >}}. They only work on PRs.

The commands are:

- `/cherry-pick $BRANCH_NAME`, e.g. `/cherry-pick release-5.10`: Opens a PR to cherry-pick a change into the branch `$BRANCH_NAME`. This command only works for the submitter of the PR and members of the Mattermost organization.
- `/check-cla`: Checks if the PR contributor has signed the CLA.
- `/autoassign`: Automatically assigns reviewers to a PR.
- `/update-branch`: Updates the pull request branch with the latest upstream changes by merging HEAD from the base branch into the pull request branch. This command only works for members of the Mattermost organization.

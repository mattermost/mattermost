---
title: "Mattermost cherry-pick process"
heading: "Mattermost cherry-pick process"
description: "What the branch strategy and cherry-pick process looks like."
date: 2019-06-18T00:00:00-04:00
weight: 20
aliases:
  - /contribute/getting-started/branching
---

The self-managed releases are cut based off of the Mattermost Cloud release tags (e.g Mattermost Server v6.3 release was based off of ``cloud-2021-12-08-1`` Cloud release tag) in the server, webapp, enterprise, and api-reference repos. See {{< newtabref href="https://handbook.mattermost.com/operations/research-and-development/product/release-process/release-overview#cloud-release-branch-processes" title="the Handbook release process" >}} for more details.

The Mobile and Desktop app release branches are based off of ``master`` branch.

## Developer process

When your PR is required on a release branch (e.g. for a dot release or to fix a regression for an upcoming release), you will follow the cherry-picking process.

1. Make a PR to 'master' like normal.
2. Add the appropriate milestone and the `CherryPick/Approved` label.
3. When your PR is approved, it will be assigned back to you to perform the merge and any cherry picking if necessary.
4. Merge the PR.
5. An automated cherry-pick process will try to cherry-pick the PR. If the automatic process succeeds, a new PR pointing to the correct release branch will open with all the appropriate labels. If there are no additional changes from the original PR for the cherry-pick, it can be merged without further review.
6. If the automated cherry-pick fails, the developer will need to cherry-pick the PR manually. Cherry-pick the master commit back to the appropriate releases. If the release branches have not been cut yet, leave the labels as-is and cherry-pick once the branch has been cut. The release manager will remind you to finish your cherry-pick.
7. Set the `CherryPick/Done` label when completed.

   * If the cherry-pick fails, the developer needs to apply the cherry-pick manually.
   * Cherry-pick the commit from `master` to the affected releases. See the steps below:
8. Run the checks for lint and tests.
9. Push your changes directly to the remote branch if the check style and tests passed.
10. No new pull request is required unless there are substantial merge conflicts.
11. Remove the `CherryPick/Approved` label and apply the `CherryPick/Done` label.

{{<note "Note:">}}
If the PR needs to go to other release branches, you can run the command `/cherry-pick release-x.yz` in the PR comments and it will try to cherry-pick it to the branch you specified.
{{</note>}}

### Manual cherry-pick

If conflicts appear between your pull request (PR) and the cherry-pick target branch, the automated cherry-pick process will fail and will let you know that you need to do a manual cherry-pick. Here are the steps to do so:

1. Fetch the latest updates from origin:
```sh
git fetch origin
```
2. Create a new branch starting at the release branch on origin.
```sh
git checkout -b manual-cherry-pick-pr-[PR_NUMBER] origin/release-[VERSION]
```
3. Find the SHA of the pull request merge commit, and cherry-pick this commit in your new branch:
```sh
git log origin/master
git cherry-pick [SHA]
```
4. You're likely to face the conflict that prevented the automated cherry-pick now. Fix the conflict, and then run the following:
```sh
git add [path/to/conflicted/files]
git cherry-pick --continue
```
5. Finally, push your new branch as usual and create a PR. Make sure you select `release-[VERSION]` as the base branch, and not the default (master).
```sh
git push -u origin manual-cherry-pick-pr-[PR_NUMBER]
```

## Reviewer process

If you are the second reviewer reviewing a PR that needs to be cherry-picked, do not merge the PR. If the submitter is a core team member, you should set the `Reviews Complete` label and assign it to the submitter to cherry-pick. If the submitter is a community member who is not available to cherry-pick their PR or can not do it themselves, you should follow the cherry-pick process above.

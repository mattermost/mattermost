---
title: "Using Gitpod"
heading: "Using Gitpod"
description: "How to work on Mattermost repositories with Gitpod."
weight: 6
aliases:
  - /contribute/getting-started/gitpod
---

### What is Gitpod?
{{<newtabref href="https://www.gitpod.io/" title="Gitpod">}} is a cloud development environment. The following instructions have been adapted from comments on this issue: {{<newtabref href="https://github.com/mattermost/mattermost-gitpod-config/issues/18" title="Document general usage of Gitpod #18 ">}}. You can also check out these videos to learn how to work with Gitpod (and write an E2E test): {{<newtabref href="https://www.youtube.com/watch?v=LgQ2Z_GelYQ" title="How to set up a developer environment for Mattermost with Gitpod">}} and {{<newtabref href="https://www.youtube.com/watch?v=mLbzKSGZv4A" title="Writing your first E2E test for Mattermost">}}.

#### :cyclone: Spinning up an environment

1. Create a new workspace for a ticket/issue that you've claimed by going to the {{<newtabref href="https://github.com/mattermost/mattermost-gitpod-config/tree/master" title="mattermost-gitpod-config">}} repository and clicking the "Open in Gitpod" badge.

    * You can also use the [Gitpod browser extension](https://www.gitpod.io/docs/configure/user-settings/browser-extension) to open up a repository in Gitpod, or manually prefix GitHub repository URLs with `gitpod.io/#`. What the extension does is add a green Gitpod button to repository pages on GitHub, and clicking it spins up a new environment for the repository on Gitpod.
    ![mattermost-gitpod-config-repo](https://user-images.githubusercontent.com/43153413/194467192-675a6b15-bb3b-4a4d-be05-f1df0fbdd524.jpeg)

2. You may need to sign in (through GitHub) to access the workspace on Gitpod. Once Gitpod has done loading, the user interface presented is that of VSCode.
![mattermost-gitpod-intro](https://user-images.githubusercontent.com/43153413/194467255-98b5a9be-85a5-4da8-b519-279011882384.jpeg)
 
#### :pencil2: Working on an issue/ticket
 
3. Make changes to one of the projects. For example, you could be working on writing an End-to-End (E2E) test, like this issue {{<newtabref href="https://github.com/mattermost/mattermost/issues/18184" title=`Write Webapp E2E with Cypress: "MM-T642 Attachment does not collapse" #18184`>}}. The development process is very similar to how you would work locally.

#### :herb: Making branches and forks

4. You most likely won't have direct write access to the repository you are working on. Thus, you will need to bring the changes you've made over from the `master` or `main` branch to a new branch on your own fork of the repository.
 
5. Click the "Source Control" icon on the left sidebar. On the panel next to the side bar, you will see a list of the repositories in the workspace, and under each repository a list of the files that have changed (if any). Next to the label for `mattermost-webapp`, click the button with the branch name and the source control icon.

6. A dropdown will appear via the command palette. Click the option that says: "+ Create new branch..."
![mattermost-gitpod-new-branch](https://user-images.githubusercontent.com/43153413/194467696-498917fe-14a3-4cbc-ac35-1b201ce3c730.jpeg)

7. In the box that appears, name your new branch. A good name idea is to name it after the code that refers to your issue - in this case, this is the "Test Key", so a suitable name for the branch is `MM-T642`. Then, hit `Enter` on your keyboard.
![mattermost-gitpod-branch-name](https://user-images.githubusercontent.com/43153413/194467742-e7312d5d-dbb3-4bcc-a5af-b67941bbf4f2.jpeg)

8. Now that the branch has changed, you can commit your changes to it. Back in the source control panel, you can make a commit message in the text box above the "commit button" in the section for the `mattermost-webapp` repository. Then, press the "commit button". A modal may appear asking you to first stage your changes.
![mattermost-gitpod-commit-message](https://user-images.githubusercontent.com/43153413/194467789-0f588a7c-ff8b-4bc9-adaf-5d224726b2a5.jpeg)
 
9. You can now publish your branch to the remote. However, as you will not have access to the main repository itself, you will be prompted to first create a fork. Click on the "publish branch button" on the source control panel. A popup will appear, asking if you would like to make a fork and push to that instead. On the popup, select the "create fork" button.
![mattermost-gitpod-make-fork](https://user-images.githubusercontent.com/43153413/194468420-14564230-fb63-442c-b0e6-815aeb799da5.jpeg)
 
10. During the process of fork creation, you may be prompted to grant GitHub access to Gitpod's GitHub extension (you should allow this).
![mattermost-gitpod-sign-into-GitHub](https://user-images.githubusercontent.com/43153413/194468466-79cf2804-5393-4a1c-994f-9c087ff42b1d.jpeg)
 
11. You may also be asked to update the permissions you give Gitpod to access GitHub through a popup. If this happens, you will have to restart the fork creation process (publish branch -> say yes to creating a fork). Click the "open access control" button on the popup.
![mattermost-gitpod-need-perms](https://user-images.githubusercontent.com/43153413/194468523-f7c7ce87-3586-48bf-b779-38253de0059e.jpeg)
 
12. You will get taken to the Integration section of Gitpod's settings. In the list of Git Providers on the page, find GitHub, click the three dots next to the listing, and select "Edit Permissions" from the dropdown menu.
![mattermost-gitpod-open-perms](https://user-images.githubusercontent.com/43153413/194468548-7b31a634-dd4a-49bb-a697-a8b3e5aa39db.jpeg)
 
13. A popup will appear with a list of permission checkboxes. It's a good idea to check all of them off so you don't need to go through this process again. When you're done checking off the permissions, click the "Update Permissions" button.
![mattermost-gitpod-select-perms](https://user-images.githubusercontent.com/43153413/194468567-fba1fc58-f4db-4787-8dcd-d594472d7692.jpeg)
 
14. Another tab might also appear where on GitHub's end you accept the additional permissions Gitpod is requesting. Click on the "authorize gitpod-io" button.
![mattermost-gitpod-confirm-perms](https://user-images.githubusercontent.com/43153413/194468598-1866b681-ae3b-42a0-b94c-c02735776e02.jpeg)
 
15. Once the forking process is done, there will be a couple of popups that appear on Gitpod: one asking if you'd like to periodically run `git fetch` (which will periodically download content from the remote), another one asking if you'd like to create a pull request for the branch you're on right inside Gitpod/the VSCode editor, and finally one informing that the fork was successfully created. On the successful fork creation popup, click the `open on GitHub` option.
![mattermost-gitpod-open-fork-on-GitHub](https://user-images.githubusercontent.com/43153413/194468614-a89701c4-8b09-4b80-b84e-a0beaca8431c.jpeg)
 
#### :mag: Creating a Pull Request (PR)
 
16. You'll get taken to GitHub, to the fork of the repository you've worked on in your account instead of the main one in the Mattermost organization. Navigate to the branch you've made on your fork if you're not there already.
 
    * Near the top of the page will be a bar mentioning how many commits ahead/behind your branch is from the `master`/`main` branch of the main repository. There will also be two buttons: "contribute" and "sync fork". Click on the "contribute" button, and in the dropdown that appears, click the "open pull request" button.
![mattermost-gitpod-create-PR-on-GitHub](https://user-images.githubusercontent.com/43153413/194468644-8c625663-17d4-4187-92be-171b683d298f.jpeg)
 
17. You'll be taken to another page on GitHub called "Open a pull request".
![mattermost-gitpod-PR-creation-page](https://user-images.githubusercontent.com/43153413/194468667-aace5ac5-4bbe-4e93-9902-e210964e00c8.jpeg)

    * The first section of the page compares whether the branches (your branch on your fork - the "head repository" vs. the master/main branch on the main repository - the "base repository") can be merged automatically.
    * The second section of the page will show other PRs that are based on your same branch, if any.
    * The third section is where you create a write-up for your pull request - giving it a title, and filling out the template. At the bottom of this section is a "Create pull request" button. This button will be faded out until you make a title for the PR.
        * If you haven't already, give Mattermost's [Contribution Checklist](https://developers.mattermost.com/contribute/more-info/getting-started/contribution-checklist/) a read. An important takeaway is that you will need to sign the [Contributor License Agreement](https://mattermost.com/mattermost-contributor-agreement/) - this will be another check on the pull request and if you haven't signed it, this will also block merging.
        * Also check out this blog post about [Submitting Great PRs](https://developers.mattermost.com/blog/2019-01-24-submitting-great-prs), and other repository specific information [here](https://developers.mattermost.com/contribute).
        * **Parts of a PR body**:
            * _Title_: a good title will refer back to the issue; and it should begin with the related Jira or GitHub ticket ID (e.g. [MM-394] or [GH-394]). In the context of the E2E issue example: `MM-T642: Attachment does not collapse - Cypress Webapp E2E Test`.
            * _Summary_: description of what the PR does, as well as QA test steps (if applicable and if not already added to the Jira ticket). For example: `Verifies that attachments on posts do not collapse after entering the slash command collapse`.
            * _Ticket Link_: Either link the relevant Jira ticket or if you picked up an issue/ticket with a `Helped Wanted` label, link to the GitHub issue. For example: [Write Webapp E2E with Cypress: "MM-T642 Attachment does not collapse" #18184](https://github.com/mattermost/mattermost/issues/18184).
            * _Related Pull Requests_: Link other PRs here if they are related to this PR.
            * _Screenshots_: Illustrate what your changes have done.
            * _Release Note_: There are certain conditions that require release notes:
                * Config changes (additions, deletions, updates).
                * API additions—new endpoints, new response fields, or newly accepted request parameters.
                * Database changes (any).
                * Schema migration changes. Use the [Schema Migration Template](https://docs.google.com/document/d/18lD7N32oyMtYjFrJKwsNv8yn6Fe5QtF-eMm8nn0O8tk/edit?usp=sharing) as a starting point to capture these details as release notes.
                * Websocket additions or changes.
                * Anything noteworthy to a Mattermost instance administrator (err on the side of over-communicating).
                * New features and improvements, including behavioral changes, UI changes, and CLI changes.
                * Bug fixes and fixes of previous known issues.
                * Deprecation warnings, breaking changes, or compatibility notes.
                <br><br/>
                If no release notes are required, write NONE. Use past-tense. For E2E tests, having `NONE` as a release note suffices. If you do not end up writing a release note at all, you'll get a warning on your PR like this: `Adding the "do-not-merge/release-note-label-needed" label [to the PR] because no release-note block was detected, please follow our release note process to remove it.` If this happens, you can just edit the body of the PR, and add it back in.
 
    * The last section details the code changes on your branch, including information on the commits on the branch, the files changed, and the contributors.
 
18. Once you've created your pull request, you'll get taken to its page, like this one: {{<newtabref href="https://github.com/mattermost/mattermost/pull/11231" title="MM-T642: Attachment does not collapse - Cypress Webapp E2E Test #11231">}}. Below your initial body text of the PR will be a list of commits and other comments. At the end of this list is a checklist which notes the status of reviews required for the pull request, and the checks that the pull request must pass, plus a place to write your own additional comments.
![mattermost-gitpod-real-PR-1](https://user-images.githubusercontent.com/43153413/194468726-afddf66f-eaf1-4dab-a6bf-7ddf39db78bf.jpeg)
 
19. if you need to make any changes to your PR, you can return to Gitpod and stage and commit your changes from there onto your branch; and this will be reflected in GitHub.
 
### :white_check_mark: Code Review
 
Information from this section comes from: [Code review at Mattermost](https://developers.mattermost.com/contribute/more-info/getting-started/code-review/). 
 
20. Wait for a reviewer to be assigned - normally this is handled automatically, but if you need help feel free to ask for help in the [Developers channel](https://community.mattermost.com/core/channels/developers) of the Mattermost community server.
 
21. Wait for a review - if a reviewer requests changes, your PR will disappear from their queue of reviews. Once you've addressed the concerns, re-request a review from any person requesting changes. Avoid force pushing, which is the act of overwriting the commit history on the remote with what you have on local.
 
22. Once all reviewers approve your pull request, they will handle the merging of your code.

 
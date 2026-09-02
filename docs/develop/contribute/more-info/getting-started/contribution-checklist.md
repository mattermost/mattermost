---
title: "Contribution checklist"
sidebar_position: 2
---

Thanks for your interest in contributing to Mattermost! Come join our [Contributors community channel](https://community.mattermost.com/core/channels/tickets) on the community server, where you can discuss questions with community members and the Mattermost core team.

To help with translations, [see the localization process](https://docs.mattermost.com/developer/localization.html).

Follow this checklist for submitting a pull request (PR):

1. You've signed the [Contributor License Agreement](https://mattermost.com/mattermost-contributor-agreement/), so you can be added to the Mattermost [Approved Contributor List](https://docs.google.com/spreadsheets/d/1NTCeG-iL_VS9bFqtmHSfwETo5f-8MQ7oMDE5IUYJi_Y/pubhtml?gid=0&single=true).
    - If you've included your mailing address in the signed [Contributor License Agreement](https://mattermost.com/mattermost-contributor-agreement/), you may receive a [Limited Edition Mattermost Mug](https://forum.mattermost.com/t/limited-edition-mattermost-mugs/143) as a thank you gift after your first pull request is merged.
2. You have claimed the ticket that you wish to work on by asking for an assignment from the Mattermost team.
   - Tickets are assigned on a first-come-first-serve basis.
3. Your ticket is a Help Wanted GitHub issue for the Mattermost project you're contributing to.
    - If not, follow the process [here](/developers/contribute/more-info/getting-started/contributions-without-ticket).
4. Your code is thoroughly tested, including appropriate [unit, end-to-end, and integration tests for webapp](/developers/contribute/more-info/getting-started/test-guideline).
5. If applicable, user interface strings are included in localization files:
    - [mattermost/server/en.json](https://github.com/mattermost/mattermost/blob/master/server/i18n/en.json)
    - [mattermost/webapp/channels/src/i18n/en.json](https://github.com/mattermost/mattermost/blob/master/webapp/channels/src/i18n/en.json)
    - [mattermost-mobile/assets/base/i18n/en.json](https://github.com/mattermost/mattermost-mobile/blob/master/assets/base/i18n/en.json)

    5.1. In the webapp/channels repository run `npm run i18n-extract` to generate the new/updated strings.
6. The PR is submitted against the Mattermost `master` branch from your fork.
7. The PR title begins with the Jira or GitHub ticket ID (e.g. `[MM-394]` or `[GH-394]`) and summary template is filled out.
8. If your PR adds or changes a RESTful API endpoint, please update the [API documentation](https://github.com/mattermost/mattermost/tree/master/api).
9. If your PR adds a new plugin API method or hook, please add an example to the [Plugin Starter Template](https://github.com/mattermost/mattermost-plugin-starter-template).
10. If QA review is applicable, your PR includes test steps or expected results.
11. If the PR adds a substantial feature, a feature flag is included. Please see [criteria here](/developers/contribute/more-info/server/feature-flags#when-to-use).
12. Your PR includes basic documentation about the change/addition you're submitting. View our [guidelines](https://handbook.mattermost.com/operations/research-and-development/product/technical-writing-team-handbook#submit-documentation-with-your-pr-community) for more information about submitting documentation and the review process.

Once submitted, the automated build process must pass in order for the PR to be accepted. Any errors or failures need to be addressed in order for the PR to be accepted. Next, the PR goes through [code review](/developers/contribute/more-info/getting-started/code-review). To learn about the review process for each project, read the `CONTRIBUTING.md` file of that GitHub repository. 

That's all! If you have any feedback about this checklist, let us know in the [Contributors channel](https://community.mattermost.com/core/channels/tickets).

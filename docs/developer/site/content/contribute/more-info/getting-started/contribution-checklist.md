---
title: "Contribution checklist"
heading: "Mattermost contribution checklist"
description: "Join our Contributors community channel where you can discuss questions with community members and the Mattermost core team."
date: 2017-08-20T12:33:36-04:00
weight: 2
aliases:
  - /contribute/getting-started/contribution-checklist
---

Thanks for your interest in contributing to Mattermost! Come join our {{< newtabref href="https://community.mattermost.com/core/channels/tickets" title="Contributors community channel" >}} on the community server, where you can discuss questions with community members and the Mattermost core team.

To help with translations, {{< newtabref href="https://docs.mattermost.com/developer/localization.html" title="see the localization process" >}}.

Follow this checklist for submitting a pull request (PR):

1. You've signed the {{< newtabref href="https://mattermost.com/mattermost-contributor-agreement/" title="Contributor License Agreement" >}}, so you can be added to the Mattermost {{< newtabref href="https://docs.google.com/spreadsheets/d/1NTCeG-iL_VS9bFqtmHSfwETo5f-8MQ7oMDE5IUYJi_Y/pubhtml?gid=0&single=true" title="Approved Contributor List" >}}.
    - If you've included your mailing address in the signed {{< newtabref href="https://mattermost.com/mattermost-contributor-agreement/" title="Contributor License Agreement" >}}, you may receive a {{< newtabref href="https://forum.mattermost.com/t/limited-edition-mattermost-mugs/143" title="Limited Edition Mattermost Mug" >}} as a thank you gift after your first pull request is merged.
2. You have claimed the ticket that you wish to work on by asking for an assignment from the Mattermost team.
   - Tickets are assigned on a first-come-first-serve basis.
3. Your ticket is a Help Wanted GitHub issue for the Mattermost project you're contributing to.
    - If not, follow the process [here]({{< ref "/contribute/more-info/getting-started/contributions-without-ticket" >}}).
4. Your code is thoroughly tested, including appropriate [unit, end-to-end, and integration tests for webapp]({{< ref "/contribute/more-info/getting-started/test-guideline" >}}).
5. If applicable, user interface strings are included in localization files:
    - {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/server/i18n/en.json" title="mattermost/server/en.json" >}}
    - {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/webapp/channels/src/i18n/en.json" title="mattermost/webapp/channels/src/i18n/en.json" >}}
    - {{< newtabref href="https://github.com/mattermost/mattermost-mobile/blob/master/assets/base/i18n/en.json" title="mattermost-mobile/assets/base/i18n/en.json" >}}

    5.1. In the webapp/channels repository run `npm run i18n-extract` to generate the new/updated strings.
6. The PR is submitted against the Mattermost `master` branch from your fork.
7. The PR title begins with the Jira or GitHub ticket ID (e.g. `[MM-394]` or `[GH-394]`) and summary template is filled out.
8. If your PR adds or changes a RESTful API endpoint, please update the {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/api" title="API documentation" >}}.
9. If your PR adds a new plugin API method or hook, please add an example to the {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template" title="Plugin Starter Template" >}}.
10. If QA review is applicable, your PR includes test steps or expected results.
11. If the PR adds a substantial feature, a feature flag is included. Please see [criteria here]({{< ref "/contribute/more-info/server/feature-flags#when-to-use" >}}).
12. Your PR includes basic documentation about the change/addition you're submitting. View our {{< newtabref href="https://handbook.mattermost.com/operations/research-and-development/product/technical-writing-team-handbook#submit-documentation-with-your-pr-community" title="guidelines" >}} for more information about submitting documentation and the review process.

Once submitted, the automated build process must pass in order for the PR to be accepted. Any errors or failures need to be addressed in order for the PR to be accepted. Next, the PR goes through [code review]({{< ref "/contribute/more-info/getting-started/code-review" >}}). To learn about the review process for each project, read the `CONTRIBUTING.md` file of that GitHub repository. 

That's all! If you have any feedback about this checklist, let us know in the {{< newtabref href="https://community.mattermost.com/core/channels/tickets" title="Contributors channel" >}}.

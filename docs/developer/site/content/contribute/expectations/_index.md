---
title: "Contributor expectations"
heading: "Contributor expectations"
weight: 3
subsection: contributor expectations
cascade:
  - subsection: contributor expectations
---

To contribute to Mattermost, you must sign the {{< newtabref href="https://mattermost.com/mattermost-contributor-agreement/" title="Contributor License Agreement" >}}. Doing so adds you to our list of {{< newtabref href="https://docs.google.com/spreadsheets/d/1NTCeG-iL_VS9bFqtmHSfwETo5f-8MQ7oMDE5IUYJi_Y/pubhtml?gid=0&single=true" title="Mattermost Approved Contributors" >}}. 
Please also read our [community expectations]({{< ref "/contribute/good-decisions/" >}}) and note that we all abide by the {{< newtabref href="https://handbook.mattermost.com/contributors/contributors/guidelines/contribution-guidelines" title="Mattermost Code of Conduct (CoC)" >}}, and by joining our contributor community, you agree to abide by it as well.

{{<note "Tip:">}}
Love swag? If you choose to provide us with your mailing address in the signed agreement, you'll receive a {{< newtabref href="https://forum.mattermost.com/t/limited-edition-mattermost-mugs/143" title="Limited Edition Mattermost Mug" >}} as a thank you gift after your first pull request is merged.
{{</note>}}


## Before contributing

There are many ways to contribute to Mattermost beyond a core Mattermost repository:
- You can create lightweight external applications that don’t require customizations to the Mattermost user experience by using [incoming]({{< ref "/integrate/webhooks/incoming" >}}) and [outgoing]({{< ref "/integrate/webhooks/outgoing" >}}) webhooks, or by using {{< newtabref href="https://api.mattermost.com/" title="the Mattermost API" >}}.
- You can activate external functionality within Mattermost by creating custom [slash commands]({{< ref "/integrate/slash-commands/" >}}).
- You can extend, modify, and deeply integrate with the Mattermost server and its UI/UX by using [plugins]({{< ref "/integrate/plugins/" >}}). However, please note that plugin development comes with the highest level of overhead and must be written in Go and React.
- You can use Mattermost from other applications, by [embedding and launching]({{< ref "/integrate/customization/embedding/" >}}) Mattermost within other applications and mobile apps.

To get started:

1. Identify which repository you need to work in (see point below), then review the README located within the root of the repository to learn more about getting started with your contribution and any processes that may be unique to that repository.

    These are the Mattermost Core repositories you can contribute to:
     - [Server]({{< ref "/contribute/more-info/server/" >}}): Highly-scalable Mattermost server written in Go.
     - [Web App]({{< ref "/contribute/more-info/webapp/" >}}): JavaScript client app built on React and Redux.
     - [Mobile Apps]({{< ref "/contribute/more-info/mobile/" >}}): JavaScript client apps for Android and iOS built on React Native.
     - [Desktop App]({{< ref "/contribute/more-info/desktop/" >}}): An Electron wrapper around the web app project that runs on Windows, Linux, and macOS.
     - [Core Plugins]({{< ref "/contribute/more-info/plugins/" >}}): A core set of officially-maintained plugins that provide a variety of improvements to Mattermost.
     - [Boards]({{< ref "/contribute/more-info/focalboard/" >}}) and [Playbooks](https://github.com/mattermost/mattermost-plugin-playbooks) core integrations.

2. To contribute to documentation, you should be able to edit any page and get to the source file in the documentation repository by selecting the **Edit on GitHub** button in the top right of its respective published page. You can read more about this process on the [why and how to contribute page]({{< ref "/contribute/why-contribute/#you-want-to-help-with-content" >}}). You can contribute to the following Mattermost documentation sites:

    - {{< newtabref href="https://github.com/mattermost/docs" title="Product documentation" >}}
    - {{< newtabref href="https://github.com/mattermost/mattermost-developer-documentation" title="Developer documentation" >}}
    - {{< newtabref href="https://github.com/mattermost/mattermost-api-reference" title="API reference documentation" >}}
    - {{< newtabref href="https://github.com/mattermost/mattermost-handbook" title="Handbook documentation" >}}

## During the contribution process

1. Check in regularly with your Pull Request (PR) to review and respond to feedback.
2. Thoroughly document what you’re doing in your PR. This way, future contributors can pick up on your work (including you!). This is especially helpful if you need to step back from a PR.
3. Each PR should represent a single project, both in code and in content. Keep unrelated tasks in separate  PRs.
4. Make your PR titles and commit messages descriptive! Briefly describing the project in the PR title and in your commit messages often results in faster responses, less clarifying questions, and better feedback.

{{<note "Tip:">}}
If you need to take a break from an assigned issue during, for example, the Hacktoberfest project, please commit any completed work to date in a PR, and note that you're stepping away in the issue itself. These two steps help ensure that your contributions are counted and outstanding work on a given ticket can be made available to other contributors.
{{</note>}}

## Writing code

Thoroughly test your contributions! We recommend the following testing best practices for your contribution:
1. Detail exactly what you expect to happen in the product when others test your contributions.
2. Identify updates to existing [product](https://docs.mattermost.com/), [developer](https://developers.mattermost.com/), and/or {{< newtabref href="https://api.mattermost.com/" title="API" >}} documentation based on your contributions, and identify documentation gaps for new features or functionality. 

{{<note "Note:">}}
   Contributors and reviewers are strongly encouraged to work with the Mattermost Technical Writing team via the {{< newtabref href="https://community.mattermost.com/core/channels/dwg-documentation-working-group" title="Documentation Working Group channel" >}} on the Mattermost Community Server before approving community contributions. See the Mattermost Handbook for additional details on {{< newtabref href="https://handbook.mattermost.com/operations/research-and-development/product/technical-writing-team-handbook/work-with-us#how-to-engage-with-us" title="engaging the Mattermost Technical Writing team" >}}, and for {{< newtabref href="https://handbook.mattermost.com/operations/research-and-development/product/technical-writing-team-handbook/writing-community-documentation#submit-documentation-with-your-pr" title="submitting documentation with your PR" >}}.
   {{</note>}}


3. If your PR adds a new plugin API method or hook, please add an example to the {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template" title="Plugin Starter Template" >}}.
4. If your code adds a new user interface string, include it in the proper localization file, either for {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/server/i18n/en.json" title="the server" >}}, {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/webapp/channels/src/i18n/en.json" title="the webapp" >}}, or {{< newtabref href="https://github.com/mattermost/mattermost-mobile/blob/master/assets/base/i18n/en.json" title="mobile" >}}. 


{{<note "Note:">}}
When working within the webapp repository, additionally run `make i18n-extract` from a terminal to update the list of product strings with your changes.
{{</note>}}

# Writing content

Always consider who will consume your content, and write directly to your target audience.

Write clearly and be concise. Write informally, in the present tense, and address the reader directly. See our {{< newtabref href="https://handbook.mattermost.com/operations/operations/company-processes/publishing/publishing-guidelines/voice-tone-and-writing-style-guidelines" title="voice, tone, and writing style guidelines" >}}, and the {{< newtabref href="https://handbook.mattermost.com/operations/operations/company-processes/publishing/publishing-guidelines/voice-tone-and-writing-style-guidelines" title="Mattermost Documentation Style Guide" >}} for details on general writing principles, syntax used to format content, and common terms used to describe product functionality.

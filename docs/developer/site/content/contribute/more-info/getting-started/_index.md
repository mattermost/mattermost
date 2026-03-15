---
title: "Contribute code"
heading: "Contribute code to Mattermost"
description: "Learn how to contribute code to the core Mattermost repositories."
date: "2018-05-19T12:01:23-04:00"
weight: 1
aliases:
  - /contribute/devtalks/
  - /contribute/getting-started
---

This site is for developers who want to contribute code to the core Mattermost project. If you’re looking for other ways to contribute, {{< newtabref href="https://mattermost.com/contribute/" title="head over to our website" >}}. Before getting started, it’s a good idea to review our guide on [integrating and extending Mattermost]({{< ref "/integrate/getting-started" >}}) because you might be able to build the improvements you want without needing to contribute them upstream.


## Technical overview

The Mattermost core repositories include:
* [Server]({{< ref "/contribute/more-info/server" >}}) - Highly-scalable Mattermost installation written in Go
* [Web App]({{< ref "/contribute/more-info/webapp" >}}) - JavaScript client app built on React and Redux
* [Mobile Apps]({{< ref "/contribute/more-info/mobile" >}}) - JavaScript client apps for Android and iOS built on React Native
* [Desktop App]({{< ref "/contribute/more-info/desktop" >}}) - An Electron wrapper around the web app project that runs on Windows, Linux, and macOS
* [Core Plugins]({{< ref "/contribute/more-info/plugins" >}}) - A core set of officially-maintained plugins that provide a variety of improvements to Mattermost.
* Core Integrations - Major Mattermost features including [Focalboard]({{< ref "/contribute/more-info/focalboard" >}}) and {{< newtabref href="https://github.com/mattermost/mattermost-plugin-playbooks" title="Playbooks" >}}.

Improvements to Mattermost may require you to contribute to multiple projects; if you’re unsure where to start, the server repository is generally the best way to get introduced to the codebase.


## How to contribute code

If you’re looking for an existing issue to help with, check out the {{< newtabref href="https://mattermost.com/pl/help-wanted" title="help wanted tickets on GitHub" >}}. If you see any that you’re interested in working on, comment on it to let everyone know you’re working on it. If there’s no ticket for what you want to contribute, see our guide on [contributing without a ticket.]({{< ref "contributions-without-ticket.md" >}})

Once you’ve created some code that you want to contribute, follow our [pull request checklist]({{< ref "contribution-checklist.md" >}}) to submit your contribution for [review]({{< ref "code-review.md" >}}), and one of our [core committers]({{< ref "/contribute/more-info/getting-started/core-committers" >}}) will reach out with any feedback, questions, or requests they have.


## How to get help with your contribution

Our contributor community is segmented into [guilds]({{< ref "/contribute/more-info/getting-started/guilds" >}}) that focus on specific components within the Mattermost ecosystem. Each guild has a leader and a channel on our {{< newtabref href="https://docs.mattermost.com/guides/community-chat.html" title="community chat server" >}} where you can ask questions about your contribution.

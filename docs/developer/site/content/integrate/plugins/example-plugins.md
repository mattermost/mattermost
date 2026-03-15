---
title: "Example plugins"
heading: "Example plugins in Mattermost"
description: "To get started extending server-side functionality with plugins, take a look at our server “Hello, world!” tutorial."
date: 2018-07-10T00:00:00-05:00
weight: 90
aliases:
  - /extend/plugins/example-plugins/
---

## Server "Hello, world!"

To get started extending server-side functionality with plugins, take a look at our [server "Hello, world!" tutorial]({{< ref "/integrate/plugins/components/server/hello-world" >}}).

## Web app "Hello, world!"

To get started extending browser-side functionality with plugins, take a look at our [web app "Hello, world!" tutorial]({{< ref "/integrate/plugins/components/webapp/hello-world" >}}).

## Demo plugin

To see a demonstration of all server-side hooks and webapp components, take a look at our {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo" title="demo plugin" >}}.

## Sample plugin

To see a stripped down version of the demo plugin with just the build scripts and templates to get started, take a look at our {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template" title="plugin starter template" >}}.

## Zoom

The {{< newtabref href="https://github.com/mattermost/mattermost-plugin-zoom" title="Zoom plugin for Mattermost" >}} adds UI elements that allow users to easily create and join Zoom meetings:

<img src="/img/extend/zoom-plugin-screenshot.png" width="445" height="295" />

Topics demonstrated:

* Uses a custom HTTP handler to integrate with external systems.
* Defines a settings schema, allowing system administrators to configure the plugin via system console UI.
* Implements tests using the {{< newtabref href="https://godoc.org/github.com/mattermost/mattermost/server/public/plugin/plugintest" title="plugin/plugintest" >}} package.
* Creates rich posts using custom post types.
* Extends existing webapp components to add elements to the UI.

## JIRA

The {{< newtabref href="https://github.com/mattermost/mattermost-plugin-jira" title="JIRA plugin for Mattermost" >}} creates a webhook that your JIRA server can use to post messages to Mattermost when issues are created:

<img src="/img/extend/jira-plugin-screenshot.png" width="445" height="263" />

Topics demonstrated:

* Uses a custom HTTP handler to integrate with external systems.
* Defines a settings schema, allowing system administrators to configure the plugin via system console UI.
* Implements tests using the {{< newtabref href="https://godoc.org/github.com/mattermost/mattermost/server/public/plugin/plugintest" title="plugin/plugintest" >}} package.
* Compiles and publishes releases for multiple platforms using Travis-CI.

## Profanity filter

The {{< newtabref href="https://github.com/mattermost/mattermost-plugin-profanity-filter" title="profanity filter plugin for Mattermost" >}} automatically detects restricted words in posts and censors them prior to writing to the database. For more use cases, {{< newtabref href="https://forum.mattermost.com/t/coming-soon-apiv4-mattermost-post-intercept/4982" title="see this forum post" >}}.

Topics demonstrated:

* Interception and modification of posts prior to writing them into the database.
* Rejection of posts prior to writing them into the database.

## Memes

The {{< newtabref href="https://github.com/mattermost/mattermost-plugin-memes" title="Memes plugin for Mattermost" >}} creates a slash command that can be used to create dank memes:

<img src="/img/extend/memes-plugin-screenshot.png" width="445" height="325" />

Topics demonstrated:

* Registers a custom slash command.
* Uses a custom HTTP handler to generate and serve content.
* Compiles and publishes releases for multiple platforms using Travis-CI.

---
title: "Example plugins"
sidebar_position: 90
---

## Server "Hello, world!"

To get started extending server-side functionality with plugins, take a look at our [server "Hello, world!" tutorial](/developers/integrate/plugins/components/server/hello-world).

## Web app "Hello, world!"

To get started extending browser-side functionality with plugins, take a look at our [web app "Hello, world!" tutorial](/developers/integrate/plugins/components/webapp/hello-world).

## Demo plugin

To see a demonstration of all server-side hooks and webapp components, take a look at our [demo plugin](https://github.com/mattermost/mattermost-plugin-demo).

## Sample plugin

To see a stripped down version of the demo plugin with just the build scripts and templates to get started, take a look at our [plugin starter template](https://github.com/mattermost/mattermost-plugin-starter-template).

## Zoom

The [Zoom plugin for Mattermost](https://github.com/mattermost/mattermost-plugin-zoom) adds UI elements that allow users to easily create and join Zoom meetings:

<img src="/img/extend/zoom-plugin-screenshot.png" width="445" height="295" />

Topics demonstrated:

* Uses a custom HTTP handler to integrate with external systems.
* Defines a settings schema, allowing system administrators to configure the plugin via system console UI.
* Implements tests using the [plugin/plugintest](https://godoc.org/github.com/mattermost/mattermost/server/public/plugin/plugintest) package.
* Creates rich posts using custom post types.
* Extends existing webapp components to add elements to the UI.

## JIRA

The [JIRA plugin for Mattermost](https://github.com/mattermost/mattermost-plugin-jira) creates a webhook that your JIRA server can use to post messages to Mattermost when issues are created:

<img src="/img/extend/jira-plugin-screenshot.png" width="445" height="263" />

Topics demonstrated:

* Uses a custom HTTP handler to integrate with external systems.
* Defines a settings schema, allowing system administrators to configure the plugin via system console UI.
* Implements tests using the [plugin/plugintest](https://godoc.org/github.com/mattermost/mattermost/server/public/plugin/plugintest) package.
* Compiles and publishes releases for multiple platforms using Travis-CI.

## Profanity filter

The [profanity filter plugin for Mattermost](https://github.com/mattermost/mattermost-plugin-profanity-filter) automatically detects restricted words in posts and censors them prior to writing to the database. For more use cases, [see this forum post](https://forum.mattermost.com/t/coming-soon-apiv4-mattermost-post-intercept/4982).

Topics demonstrated:

* Interception and modification of posts prior to writing them into the database.
* Rejection of posts prior to writing them into the database.

## Memes

The [Memes plugin for Mattermost](https://github.com/mattermost/mattermost-plugin-memes) creates a slash command that can be used to create dank memes:

<img src="/img/extend/memes-plugin-screenshot.png" width="445" height="325" />

Topics demonstrated:

* Registers a custom slash command.
* Uses a custom HTTP handler to generate and serve content.
* Compiles and publishes releases for multiple platforms using Travis-CI.

---
title: Web app plugins
heading: "Web app plugins at Mattermost"
description: "Web app plugins extend and modify the Mattermost web and desktop apps, without having to fork and rebase on every Mattermost release."
date: 2018-07-10T00:00:00-05:00
weight: 20
aliases:
  - /extend/plugins/webapp/
  - /integrate/plugins/webapp/
---

Web app plugins extend and modify the Mattermost web and desktop apps, without having to fork and rebase on every Mattermost release.

Looking for a quick start? [See our "Hello, world!" tutorial]({{< ref "/integrate/plugins/components/webapp/hello-world" >}}).

Want the web app SDK reference doc? [Find it here]({{< ref "/integrate/reference/webapp/webapp-reference" >}}).

## Features

#### Extend existing components

Register your own React components to be added to the channel header, sidebars, user details popover, main menu and other supported components. Multiple plugins can add to the same component simultaneously. This API focuses on ease of use and maintaining compatibility with future Mattermost releases.

For example, the {{< newtabref href="https://github.com/mattermost/mattermost-plugin-zoom" title="Mattermost Zoom Plugin" >}} registers a button in the channel header to trigger a Zoom call and post a link to the call in the current channel.

#### Add new root components

Register your own React components alongside other root components like the sidebars and modals. This enables whole new interactions that aren't constrained by the set of existing components. This API is geared towards power and flexibility, but may require fine tuning with future Mattermost releases.

#### Custom post type components

Web app plugins can also render different post components based on the post's type. Any time the web app encounters a post with this post type, it replaces the default rendering of the post component with your own custom implementation. Only one plugin can own the rendering for a given custom post type at a time: the last plugin to register will own the rendering for that custom post type.

For example, you can register a custom post type `custom_poll` using [registerPostTypeComponent]({{< ref "/integrate/reference/webapp/webapp-reference#registerPostTypeComponent" >}}). Then, any time the web app sees that post type, it replaces the regular rendering of the post component with your own custom implementation.

Use this in conjunction with setting the post type in webhooks or slash commands, through the REST API or with a server plugin, and you can deeply integrate or extend Mattermost posts to fit your needs.

## How it works

When a plugin is uploaded to a Mattermost server and activated, the server checks to see if there is a webapp portion included as part of the plugin by looking at the [plugin's manifest]({{< ref "/integrate/plugins/manifest-reference" >}}). If one is found, the server copies the bundled JavaScript included with the plugin into the static directory for serving. A WebSocket event is then fired off to the connected clients signalling the activation of a new plugin.

On web app launch, a request is made to the server to get a list of plugins that contain web app components. The web app then proceeds to download and execute the JavaScript bundles for each plugin. A similar process happens if an already launched web app receives a WebSocket event for a newly activated plugin.

Once downloaded and executed, each plugin should have registered itself via the global [registerPlugin]({{< ref "/integrate/reference/webapp/webapp-reference#registerPlugin" >}}). The web app then invokes the `initialize` function defined on the plugin class, passing a registry and store. The registry passed allows the plugin to register (and unregister) components, event callbacks and Redux reducers to track plugin state. The store passed is the same Redux store used by the web app, giving the plugin access to the full state of the web app.

Components registered by the plugin via the registry are tracked in the Redux store and used by `Pluggable` components throughout the web app. `Pluggable` components with a `pluggableName` attribute can render multiple such components registered by plugins.

Custom post types work similarly, but are registered slightly differently, use a separate reducer and have more of a custom implementation.

## Redux actions

Further information on the available Redux Actions is documented here: [Redux Actions]({{< ref "/integrate/plugins/components/webapp/actions" >}})

## Best practices

Some best practices for working with the webapp component of a plugin are documented here: [Best Practices]({{< ref "/integrate/plugins/components/webapp/best-practices" >}})

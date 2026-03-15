---
title: Server plugins
heading: "Mattermost Server plugins"
description: "Server plugins are subprocesses invoked by the server that communicate with Mattermost using remote procedure calls (RPC)."
date: 2018-07-10T00:00:00-05:00
weight: 10
aliases:
  - /extend/plugins/server/
  - /integrate/plugins/server/
---

Server plugins are subprocesses invoked by the server that communicate with Mattermost using remote procedure calls (RPC).

Looking for a quick start? [See our "Hello, world!" tutorial]({{< ref "/integrate/plugins/components/server/hello-world" >}}).

Want the Server SDK reference doc? [Find it here]({{< ref "/integrate/reference/server/server-reference" >}}).

## Features

#### RPC API

Use the [RPC API]({{< ref "/integrate/reference/server/server-reference#API" >}}) to execute create, read, update and delete (CRUD) operations on server data models.

For example, your plugin can consume events from a third-party webhook and create corresponding posts in Mattermost, without having to host your code outside Mattermost.

#### Hooks

Register for [hooks]({{< ref "/integrate/reference/server/server-reference#Hooks" >}}) and get alerted when certain events occur.

For example, consume the [OnConfigurationChange]({{< ref "/integrate/reference/server/server-reference#Hooks.OnConfigurationChange" >}}) hook to respond to server configuration changes, or the [MessageHasBeenPosted]({{< ref "/integrate/reference/server/server-reference#Hooks.MessageHasBeenPosted" >}}) hook to respond to posts.

#### REST API

Implement the [ServeHTTP]({{< ref "/integrate/" >}}) hook to extend the existing Mattermost REST API.

Plugins with both a web app and server component can leverage this REST API to exchange data. Alternatively, expose your REST API to services and developers connecting from outside Mattermost.

## How it works

When starting a plugin, the server consults the [plugin's manifest]({{< ref "/integrate/plugins/manifest-reference" >}}) to determine if a server component was included. If found, the server launches a new process using the executable included with the plugin.

The server will trigger the [OnActivate]({{< ref "/integrate/reference/server/server-reference#Hooks.OnActivate" >}}) hook if the plugin is successfully started, allowing you to perform startup events. If the plugin is disabled, the server will trigger the [OnDeactivate]({{< ref "/integrate/reference/server/server-reference#Hooks.OnDeactivate" >}}) hook. While running, the server plugin can consume hook events, make API calls, launch threads or subprocesses of its own, interact with third-party services or do anything else a regular program can do.

## High availability

Considerations for plugins in a high availability configuration are documented here: [High Availability]({{< ref "/integrate/plugins/components/server/ha" >}})

## Best practices

Some best practices for working with the server component of a plugin are documented here: [Best Practices]({{< ref "/integrate/plugins/components/server/best-practices" >}})

## Debug Server plugins

Guidelines for debugging the server-side of plugins are documented here: [Debug Server plugins]({{< ref "/integrate/plugins/components/server/debugging" >}})

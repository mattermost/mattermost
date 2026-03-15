---
title: "Plugins"
heading: "Plugins at Mattermost"
description: "Mattermost supports plugins to extend and integrate server and web/desktop apps. Learn about our plugin infrastructure and how to contribute."
date: 2017-08-20T11:35:32-04:00
weight: 5
aliases:
  - /contribute/server/plugins
---

Mattermost supports plugins that offer powerful features for extending and deeply integrating with both the server and web/desktop apps.

This document covers the plugin infrastructure and how to contribute to it.

## Build plugins

Looking to build a plugin? [Then you want the plugin author documentation.]({{< ref "/integrate/plugins" >}})

## Overview

Plugins are generally made of at least two parts: a manifest and a server binary and/or a JavaScript bundle.

The manifest tells Mattermost what the plugin is and provides a set of metadata used by the server to install and run the plugin. Please see the [manifest reference]({{< ref "/integrate/plugins/manifest-reference" >}}) for more information. Manifests may be defined in JSON or YAML.

The server binary is a compiled Go program that extends the {{< newtabref href="https://godoc.org/github.com/mattermost/mattermost/server/public/plugin#MattermostPlugin" title="MattermostPlugin" >}} struct of the {{< newtabref href="https://godoc.org/github.com/mattermost/mattermost/server/public/plugin" title="plugin" >}} package. When enabled, the plugin's server binary is started as a process by the Mattermost server. Plugin developers then have access to interact with the Mattermost server over RPC through the plugin [API]({{< ref "/integrate/reference/server/server-reference#API" >}}) and [Hooks]({{< ref "/integrate/reference/server/server-reference#Hooks" >}}). The server-side of plugins is built using the {{< newtabref href="https://github.com/hashicorp/go-plugin" title="go-plugin" >}} library from Hashicorp. More information is available in the [server side of the plugin author documentation]({{< ref "/integrate/plugins/components/server" >}}).

The JavaScript bundle is a webpack-built collection of JavaScript code that will be run on the Mattermost web/desktop apps. When a plugin is enabled, the client is notified and it makes a request to add the JS bundle to the document. The plugin's client code then registers itself and its components with the Mattermost client through the client's [plugin registry]({{< ref "/integrate/reference/webapp/webapp-reference#registry" >}}). The registry contains many methods for registering different components and callbacks. These are all stored as part of the app's {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/webapp/channels/src/reducers/plugins/index.ts" title="plugin reducer" >}}. The {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/webapp/channels/src/plugins/pluggable" title="Pluggable" >}} component is then inserted into various places in the app, allowing plugins to insert components into these locations in the UI. In some special cases, the Pluggable component is not used and we instead implement the plugs manually. More information is available in the [webapp side of the plugin author documentation]({{< ref "/integrate/plugins/components/webapp" >}}).

All these different components of a plugin are compressed into a .tar.gz bundle. Installing a plugin is the process of uploading this bundle to the Mattermost server (via the UI, REST API or CLI). The server then unpacks the bundle, performs some validation and extracts it into the configured directory for storing installed plugins. Installed plugins are not yet running. To start a plugin it must be enabled (again via the UI, REST API or CLI). Once it is enabled, the server will then start the server process and prepare the web app bundle for serving to the client. Plugin settings, configuration and enabled/disabled status are managed by the Mattermost `config.json` using a {{< newtabref href="https://godoc.org/github.com/mattermost/mattermost/server/public/model#PluginSettings" title="PluginSettings" >}} struct.

Check out the {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/server/public/plugin" title="`plugin` package" >}} and the {{< newtabref href="https://github.com/mattermost/mattermost/tree/master/server/channels/app" title="plugin_* files in the `app` package" >}} for the code, and {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo" title="mattermost-plugin-demo" >}} for an example plugin. To start developing your own plugin, please follow the instructions [here]({{< ref "/integrate/plugins/developer-setup" >}}).

## Add an API

To add a plugin API you need to add the signature of your new method to the {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/server/public/plugin/api.go" title="API interface" >}}. You then need to implement the API in the {{< newtabref href="https://github.com/mattermost/mattermost/blob/master/server/channels/app/plugin_api.go" title="plugin_api.go" >}} of the `app` package. Finally, you need to run `make pluginapi` to generate the RPC glue code needed for your new API and `make plugin-mocks` to generate the mocks used for plugin testing.

That's it! Submit your pull request.

## Questions?

If you have any questions, feel free to ask in the {{< newtabref href="https://community.mattermost.com/core/channels/developer-toolkit" title="Toolkit channel" >}} of our Mattermost community instance.

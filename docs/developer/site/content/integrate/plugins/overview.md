---
title: Overview
heading: "An overview of Mattermost Plugins"
description: "Plugins are defined by a manifest file and contain at least a server or web app component, or both. Learn more in our overview of plugins."
date: 2018-07-10T00:00:00-05:00
weight: 10
aliases:
  - /extend/plugins/overview/
---

Plugins are defined by a manifest file and contain at least a server or web app component, or both.

The {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template" title="Plugin Starter Template" >}} is a starting point and illustrates the different components of a Mattermost plugin.

A more detailed example is the {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo" title="Demo Plugin" >}}, which showcases many of the features of plugins.

If you'd like to better understand how plugins work, [see the contributor documentation on plugins]({{< ref "/contribute/more-info/server/plugins" >}}).

### Manifest
The plugin manifest provides required metadata about the plugin, such as name and ID. It is defined in JSON or YAML. This is `plugin.json` in both the {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template/blob/master/plugin.json" title="sample" >}} and {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo/blob/master/plugin.json" title="demo" >}} plugins.

See the [manifest reference]({{< ref "/integrate/plugins/manifest-reference" >}}) for more information.

### Server
The server component of a plugin is written in Go and runs as a subprocess of the Mattermost server process. The Go code extends the {{< newtabref href="https://godoc.org/github.com/mattermost/mattermost/server/public/plugin#MattermostPlugin" title="MattermostPlugin" >}} struct that contains an [API]({{< ref "/integrate/reference/server/server-reference#API" >}}) and allows for the implementation of [Hook]({{< ref "/integrate/reference/server/server-reference#Hooks" >}}) methods that enable the plugin to interact with the Mattermost server.

The sample plugin implements this simply in {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template/blob/master/server/plugin.go" title="plugin.go" >}} and the demo plugin splits the API and hook usage throughout {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo/tree/master/server" title="multiple files" >}}.

Read more about the server-side of plugins [here]({{< ref "/integrate/plugins/components/server" >}}).

### Web/desktop app
The web app component of a plugin is written in JavaScript with {{< newtabref href="https://react.dev/" title="React" >}} and {{< newtabref href="https://redux.js.org/" title="Redux" >}}. The plugin's bundled JavaScript is included on the page and runs alongside the web app code as a [PluginClass]({{< ref "/integrate/reference/webapp/webapp-reference#pluginclass" >}}) that has initialize and uninitialize methods available for implementation. The initialize function is passed through the [registry]({{< ref "/integrate/reference/webapp/webapp-reference#registry" >}}) which allows the plugin to register React components, actions and hooks to modify and interact with the Mattermost web app.

The sample plugin has a {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template/blob/master/webapp/src/index.tsx" title="shell of an implemented PluginClass" >}}, while the demo plugin {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo/blob/master/webapp/src/plugin.jsx" title="contains a more complete example" >}}.

The desktop app is a shim of the web app, meaning any plugin that works in the web app will also work in the desktop app.

Read more about the web app component of plugins [here]({{< ref "/integrate/plugins/components/webapp" >}}).

### Mobile app
Currently there is no mobile app component of plugins but it is planned for the near term.

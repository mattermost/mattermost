---
title: "Mattermost Boards plugin guide"
heading: "Mattermost Boards plugin guide"
description: "Learn how to build the Mattermost Boards plugin."
date: 2022-03-24T00:40:23-07:00
weight: 2
aliases:
  - /contribute/focalboard/mattermost-boards-setup-guide
---

{{<note "Important:">}}
From Mattermost v7.11, Mattermost Boards is a core part of the product that cannot be disabled or built separately. Developers should read the updated [Developer Guide]({{< ref "/contribute/developer-setup" >}}) for details.
{{</note>}}

In Mattermost v7.10 and earlier releases, **{{< newtabref href="https://mattermost.com/boards/" title="Mattermost Boards" >}}** is the Mattermost plugin version of Focalboard that combines project management tools with messaging and collaboration for teams of all sizes. It is installed and enabled by default in Mattermost v6.0 and later. For working with Focalboard as a standalone application, please refer to the [Personal Server Setup Guide]({{< ref "/contribute/more-info/focalboard/personal-server-setup-guide" >}}).

## Build the plugin


1. Fork the {{< newtabref href="https://github.com/mattermost/focalboard" title="Focalboard repository" >}} and clone it locally. Clone {{< newtabref href="https://github.com/mattermost/mattermost" title="Mattermost" >}} in a sibling directory.
2. Define an environment variable ``EXCLUDE_ENTERPRISE`` with a value of ``1``.
3. To install the dependencies:
```
cd mattermost-plugin/webapp
npm install --no-optional
cd ../..
make prebuild
```
4. To build the plugin:
```
make webapp
cd mattermost-plugin
make dist
```

Refer to the {{< newtabref href="https://github.com/mattermost/focalboard/blob/main/.github/workflows/dev-release.yml#L168" title="dev-release.yml" >}} workflow for the up-to-date commands that are run as part of CI.

## Upload and install the plugin

1. Enable [custom plugins]({{< ref "/integrate/plugins/using-and-managing-plugins#custom-plugins" >}}) by setting `PluginSettings.EnableUploads` to `true` and set `FileSettings.MaxFileSize` to a number larger than the size of the packed`.tar.gz` plugin file in bytes (e.g., `524288000`) in the Mattermost `config.json` file.
2. Navigate to **System Console > Plugins > Management** and upload the packed `.tar.gz` file from your `mattermost-plugin/dist` directory.
3. Enable the plugin.

## Deploy the plugin to a local Mattermost server

Instead of following the steps above, you can also set up a `mattermost-server` in local mode and automatically deploy `mattermost-plugin` via `make deploy`.

* Follow the steps in the [`mattermost-webapp` developer setup guide]({{< ref "/contribute/developer-setup" >}}) and then:
  * Open a new terminal window. In this terminal window, add an environmental variable to your bash via `MM_SERVICESETTINGS_SITEURL='http://localhost:8065'` ([docs](https://developers.mattermost.com/blog/subpath/#using-subpaths-in-development))
  * Build the web app via `make build`
* Follow the steps in the [`mattermost-server` developer setup guide]({{< ref "/contribute/developer-setup" >}}) and then:
  * Make sure Docker is running.
  * Run `make config-reset` to generate the `config/config.json` file:
    * Edit `config/config.json`:
      * Set `ServiceSettings > SiteURL` to `http://localhost:8065` ({{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#site-url" title="docs" >}})
      * Set `ServiceSettings > EnableLocalMode` to `true` ({{< newtabref href="https://docs.mattermost.com/configure/configuration-settings.html#enable-local-mode" title="docs" >}})
      * Set `PluginSettings > EnableUploads` to `true` ([docs]({{< ref "/integrate/plugins/using-and-managing-plugins#custom-plugins" >}}))
  * In this terminal window, add an environmental variable to your bash via `MM_SERVICESETTINGS_SITEURL='http://localhost:8065'` ([docs](https://developers.mattermost.com/blog/subpath/#using-subpaths-in-development))
  * Build and run the server via `make run-server`
* Follow the [steps above](#build-the-plugin) to install the dependencies.
* Run `make deploy` in the `mattermost-plugin` folder to automatically deploy your plugin to your local Mattermost server.

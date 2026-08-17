---
title: "Plugin quick start"
sidebar_position: -10
---

This tutorial will walk you through the basics of writing a Mattermost plugin with a server component.

Note that the steps below are intentionally very manual to explain all of the pieces fitting together. In practice, we recommend referencing [mattermost-plugin-starter-template](https://github.com/mattermost/mattermost-plugin-starter-template) for helpful build scripts. Also, the plugin API changed in Mattermost 5.2. Consult the [migration](/developers/integrate/plugins/migration) document to upgrade older plugins.

## Prerequisites

Mattermost plugins extend the server using a Go API. In the future, gRPC may be supported, allowing you to write plugins in any language. For now, you'll need a functioning Go environment, so follow [Go's Getting Started](https://golang.org/doc/install) guide if needed.

You'll also need a Mattermost server to install and test the plugin. This server must have [Enable](https://docs.mattermost.com/administration/config-settings.html#enable-plugins) set to true in the [PluginSettings](https://docs.mattermost.com/administration/config-settings.html#plugins-beta) section of its config file. If you want to upload plugins via the System Console or API, you'll also need to set [EnableUploads](https://docs.mattermost.com/administration/config-settings.html#enable-plugin-uploads) to true in the same section.

## Build the plugin

The process that will communicate with the Mattermost server is built using a set of APIs provided by the source code for the Mattermost server.

Download the source code for the Mattermost server:

```bash
go get -u github.com/mattermost/mattermost/server/v8
```

Define `$GOPATH`. By default, this is already `$HOME/go`, but it's helpful to make this explicit:
```shell
export GOPATH=$HOME/go
```

Now, create a directory to act as your workspace:

```bash
mkdir -p $GOPATH/src/my-plugin
cd $GOPATH/src/my-plugin
```

Create a file named `plugin.go` with the following contents:

\{/* TODO: unconverted Hugo shortcode \{\{&lt;plugingoexamplecode name="_helloWorld"&gt;\}\} (sources/mattermost-developer-documentation/site/content/integrate/plugins/components/server/hello-world.md) */\}

This plugin will register an HTTP handler that will respond with "Hello, world!" when requested.

Build the executable that will be distributed with your plugin:

```bash
go build -o plugin.exe plugin.go
```


<Note title="Note">
Your executable is platform specific! If you're building the plugin for a server running on a different operating system, you'll need to use a slightly different command. For example, if you're developing the plugin from MacOS and deploying to a Linux server, you'll need to use this command:
</Note>


```bash
GOOS=linux GOARCH=amd64 go build -o plugin.exe plugin.go
```

Also note that the ".exe" extension is required if you'd like your plugin to run on Windows, but is otherwise optional. Consider referencing [mattermost-plugin-starter-template](https://github.com/mattermost/mattermost-plugin-starter-template) for helpful build scripts.

Now, we'll need to define the required manifest describing your plugin's entry point. Create a file named `plugin.json` with the following contents:

```json
{
    "id": "com.mattermost.server-hello-world",
    "name": "Hello World",
    "server": {
        "executable": "plugin.exe"
    }
}
```

This manifest gives the server the location of your executable within your plugin bundle. Consult the [manifest reference](/developers/integrate/plugins/manifest-reference) for more details, including how to define a cross-platform bundle by defining multiple executables, and how to define a minimum required server version for your plugin.

Note that you may also use `plugin.yaml` to define the manifest.

Bundle the manifest and executable into a tar file:

```bash
tar -czvf plugin.tar.gz plugin.exe plugin.json
```

You should now have a file named `plugin.tar.gz` in your workspace. Congratulations! This is your first server plugin!

## Install the plugin

Install the plugin in one of the following ways:

1) Through System Console UI:

```text
- Log in to Mattermost as a System Admin.
- Open the System Console at `/admin_console`
- Navigate to *Plugins > Plugin Management** and upload the `plugin.tar.gz` you generated above.
- Click **Enable** under the plugin after it has uploaded.
```

2) Or, manually:

    - Extract `plugin.tar.gz` to a folder with the same name as the plugin id you specified in ``plugin.json``, in this case `com.mattermost.server-hello-world/`.
    - Add the plugin to the directory set by **PluginSettings > Directory** in your ``config.json`` file. If none is set, defaults to `./plugins` relative to your Mattermost installation directory. The resulting directory structure should look something like:

      ```
      mattermost/
          plugins/
              com.mattermost.server-hello-world/
                  plugin.json
                  plugin.exe
      ```
    - Restart the Mattermost server.

Once you've installed the plugin in one of the ways above, browse to `https://<your-mattermost-server>/plugins/com.mattermost.server-hello-world`, and you'll be greeted by your plugin.

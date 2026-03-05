---
title: "Developer workflow"
heading: "Developer workflow for Mattermost Plugins"
description: "Read about developer workflows and learn how work with plugins and debug them in Mattermost."
date: 2020-07-11T23:00:00-04:00
weight: 30
aliases:
  - /extend/plugins/developer-workflow/
---

### Common `make` commands for working with plugins

- `make test` - Runs the plugin's server tests and webapp tests
- `make check-style` - Runs linting checks on the plugin's server and webapp folders
- `make deploy` - Compiles the plugin using the `make dist` command, then automatically deploys the plugin to the Mattermost server. Enabling [Local Mode]({{< ref "/integrate/plugins/developer-setup#deploying-with-local-mode" >}}) on your server is the easiest way to use this command.
- `make watch` - Uses webpack's watch feature to re-compile and deploy the webapp portion of your plugin on any change to the `webapp/src` folder.
- `make dist` - Compile the plugin into a g-zipped file, ready to upload to a Mattermost server. The file is saved in the plugin repo's `dist` folder.
- `make enable` - Enables the plugin on the Mattermost server
- `make disable` - Disables the plugin on the Mattermost server.
- `make reset` - Disables and re-enables the plugin on the Mattermost server.
- `make attach-headless` - Starts a `delve` process and attaches it to your running plugin.
- `make clean` - Force deletes the content of build-related files. Use when running into build issues.

You can run the development build of the plugin by setting the environment variable `MM_DEBUG=1`, or prefixing the variable at the beginning of the `make` command. For example, `MM_DEBUG=1 make deploy` will deploy the development build of the plugin to your server, allowing you to have a more fluid debugging experience. To use the production build of the plugin instead, unset the `MM_DEBUG` environment variable before running the `make` commands.

### Develop in the plugin's webapp folder

In order for your IDE to know the root directory of the plugin's webapp code, it is advantageous to open the IDE in the webapp folder itself when working on the webapp portion of the plugin. This way, the IDE is aware of files such as `webpack.config.js` and `tsconfig.json`.

### Expose the Mattermost server using `ngrok`

When a plugin integrates with an external service, webhooks and/or authentication redirects are necessary, which requires your local server to be available on the web. In order for your Mattermost server to be available to process webhook requests, it needs to expose its port to an external address. A common way to do this is to use the command line tool {{< newtabref href="https://ngrok.com" title="ngrok" >}}. Follow these steps to set up `ngrok` with your server:

- Download the ngrok tool from {{< newtabref href="https://ngrok.com/download" title="here" >}}.
- Put the executable somewhere within your shell's `PATH`.
- With your Mattermost server already running, use the command `ngrok http 8065` to make your Mattermost server available for webhook requests.
- Visit the `https` URL from the `ngrok` command's output, and log into Mattermost.
- Set your Mattermost server's {{< newtabref href="http://localhost:8065/admin_console/environment/web_server" title="Site URL" >}} to the `https` address given from the `ngrok` command output.
- Monitor incoming webhook requests with ngrok's request inspector. Visit {{< newtabref href="http://localhost:4040" title="http://localhost:4040" >}} once you have your tunnel open. You can analyze the contents of the HTTP request from the external service, and the response from your plugin.

If you're using a free ngrok account, the URL given by the output of the `ngrok http` command will be different each time you run the command. As a result, you'll need to adjust the webhook URL on Mattermost's side and the external service's side (e.g. GitHub) each time you run the command.

With this setup, many integrations require you to be logged into Mattermost using your ngrok URL. After logging into your ngrok URL pointed to your Mattermost server, in most cases you can continue using your `localhost` address in your browser for quicker network requests to your server. If you receive an error like `unauthorized` or `enable third-party cookies` when connecting to an external service, make sure you're logged into your ngrok URL in the same browser.

##### Use `localhost.run` instead of `ngrok`

If you would like to avoid using ngrok, there is another free option that you can run from your terminal, called [`localhost.run`](https://localhost.run). Use this command to expose your server:

```sh
ssh -R 80:localhost:8065 ssh.localhost.run
```

An `http` URL pointing to your server should show in the terminal. The `https` version of this same URL should also work, which is what you will want to use for your webhook URLs. One disadvantage of using `localhost.run` is there is no request/response logging dashboard that is available with ngrok.

### Debug server-side plugins using `delve`

Using the `delve` debugger, we can step through code for a running plugin on our local Mattermost server. There are a few steps for setup to make this work properly.

#### Configure Mattermost server for debugging plugins

In order to allow the debugger to pause code execution, we need to disable Mattermost's "health check" for plugins and the Hashicorp `go-plugin` package's "keep alive" feature for its RPC connection. We'll configure the server with the following steps:

- In the server's `config.json`, set `PluginSettings.EnableHealthCheck` to `false`
- Run the script below with `./patch_go_plugin.sh $GO_PLUGIN_PACKAGE_VERSION` where `GO_PLUGIN_PACKAGE_VERSION` is the version of `go-plugin` that your Mattermost server is using. This can be found in the monorepo at [server/go.mod](https://github.com/mattermost/mattermost/blob/4bdd8bb18e47d16f9680905972516526b6fd61d8/server/go.mod#L141) on your local server.
- Restart the server

More details on this are explained below:

##### Disable Mattermost plugin health check job

To disable the Mattermost plugin health check job, go into your `config.json` and set `PluginSettings.EnableHealthCheck` to `false`. Note that this will make it so if your plugin panics/crashes for any reason during your development, the Mattermost server will not restart the plugin or notice that it crashed. It will remain with the status of "running" in the plugin management page, even though it has crashed. Because of this, you'll need to watch server logs for any information related to plugin panics during your debugging.

##### Disable `go-plugin` RPC client "keep alive"

We'll be editing external library source code directly, so we only want to do this in a development environment.

By default, the `go-plugin` package runs plugins with a "keep alive" feature enabled, which essentially pings the plugin RPC connection every 30 seconds, and if the plugin doesn't respond, the RPC connection will be terminated. There is a way to disable this, though the `go-plugin` currently doesn't expose a way to configure this setting, so we need to edit the `go-plugin` package's source code to have the right configuration for our debugging use case.

In the script below, we automatically modify the file located at `${GOPATH}/pkg/mod/github.com/hashicorp/go-plugin@${GO_PLUGIN_PACKAGE_VERSION}/rpc_client.go`, where `GO_PLUGIN_PACKAGE_VERSION` is the version of `go-plugin` that your Mattermost server is using. This can be found in your local copy of the monorepo at [server/go.mod](https://github.com/mattermost/mattermost/blob/4bdd8bb18e47d16f9680905972516526b6fd61d8/server/go.mod#L141). This script essentially replaces the line in [go-plugin/rpc_client.go](https://github.com/hashicorp/go-plugin/blob/586d14f3dcef1eb42bfb7da4c7af102ec6638668/rpc_client.go#L66) to have a custom configuration for the RPC client connection, that disables the "keep alive" feature. This makes it so the debugger can be paused for long amounts of time, and the Mattermost server will keep the connection with the plugin open.

```sh
# patch_go_plugin.sh

GO_PLUGIN_PACKAGE_VERSION=$1

GO_PLUGIN_RPC_CLIENT_PATH=${GOPATH}/pkg/mod/github.com/hashicorp/go-plugin@${GO_PLUGIN_PACKAGE_VERSION}/rpc_client.go

echo "Patching $GO_PLUGIN_RPC_CLIENT_PATH for debugging Mattermost plugins"

if ! grep -q 'mux, err := yamux.Client(conn, nil)' "$GO_PLUGIN_RPC_CLIENT_PATH"; then
  echo "The file has already been patched or the target line was not found."
  exit 0
fi

sudo sudo sed -i '' '/import (/a\
    "time"
' $GO_PLUGIN_RPC_CLIENT_PATH

sudo sed -i '' '/mux, err := yamux.Client(conn, nil)/c\
    sessionConfig := yamux.DefaultConfig()\
    sessionConfig.EnableKeepAlive = false\
    sessionConfig.ConnectionWriteTimeout = time.Minute * 5\
    mux, err := yamux.Client(conn, sessionConfig)
' $GO_PLUGIN_RPC_CLIENT_PATH

echo "Patched go-plugin's rpc_client.go for debugging Mattermost plugins"
```

Then run the script like so:

```sh
chmod +x patch_go_plugin.sh
./patch_go_plugin.sh v1.6.0 # as of writing, this is the version of `go-plugin` being used by the server
```

#### Configure VSCode for debugging

This section assumes you are using VSCode to debug your plugin. If you want to use a different IDE, the process will be mostly the same. If you want to debug in your terminal directly with `delve` instead of using an IDE, you can run `make attach` instead of `make attach-headless` below, which will launch a `delve` process as an interactive terminal.

Include this configuration in your VSCode instance's [launch.json](https://learn.microsoft.com/en-us/microsoft-edge/visual-studio-code/microsoft-edge-devtools-extension/launch-json):

```json
{
    "name": "Attach to Mattermost plugin",
    "type": "go",
    "request": "attach",
    "mode": "remote",
    "port": 2346,
    "host": "127.0.0.1",
    "apiVersion": 2
}
```

#### Attach headless `delve` process to the running plugin

Build the plugin and deploy to your local Mattermost server:

```sh
make deploy
```

In a separate terminal, open a `delve` process for VSCode to connect to:

```sh
make attach-headless
```

This starts a headless `delve` process for your IDE to connect to. The process listens on port `2346`, which is the port defined in our `launch.json` configuration. Somewhat related, the Mattermost server's `Makefile` has a command `debug-server-headless`, which starts a headless `delve` process for the Mattermost server, listening on port `2345`. So you can create a similar `launch.json` configuration in the server directory of the monorepo to connect to your server by using that port.

#### Attach the debugger to the `delve` process

Run the debugger in VSCode by navigating to the "Run and Debug" tab on the left side of the IDE, selecting your launch configuration, and clicking the green play button. This should bring up a debugging widget that looks like this:

![image](https://github.com/mattermost/mattermost-developer-documentation/assets/6913320/9419ce8b-c803-40b7-82bb-9ccd64971676)

![image](https://github.com/mattermost/mattermost-developer-documentation/assets/6913320/f28681c3-c256-41a1-b1f4-835f96628d6a)

Your IDE's debugger is now running and ready to pause your plugin's execution at any breakpoints you set in the IDE.

### Troubleshooting

If you run into issues with debugging, first make sure you've stopped any active debugging sessions by clicking the red disconnect button in the VSCode debugging widget.

You can then use the `make reset` command in the plugin repository to do the following:
- Disable and re-enable the plugin
- Terminate any running `delve` processes running for this plugin

For more discussion on this, please join the Toolkit channel on our community server: https://community.mattermost.com/core/channels/developer-toolkit

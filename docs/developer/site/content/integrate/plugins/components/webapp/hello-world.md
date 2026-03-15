---
title: Web app quick start
heading: "Extending the Mattermost web app"
description: "This quickstart tutorial will walk you through the basics of extending the Mattermost web app using plugins."
date: 2018-07-10T00:00:00-05:00
weight: -10
aliases:
  - /extend/plugins/webapp/hello-world/
  - /integrate/plugins/webapp/hello-world/
---

This tutorial will walk you through the basics of extending the Mattermost web app.

Note that the steps below are intentionally very manual to explain all of the pieces fitting together. In practice, we recommend referencing {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template" title="mattermost-plugin-starter-template" >}} for helpful build scripts. Also, the plugin API changed in Mattermost 5.2. Consult the [migration]({{< ref "/integrate/plugins/migration" >}}) document to upgrade older plugins.

## Prerequisites

Plugins, just like the Mattermost web app itself, are built using {{< newtabref href="https://react.dev/" title="ReactJS" >}} with {{< newtabref href="https://redux.js.org/" title="Redux" >}}. Make sure to install {{< newtabref href="https://www.npmjs.com/get-npm" title="npm" >}} to manage your JavaScript dependencies.

You'll also need a Mattermost server to install and test the plugin. This server must have {{< newtabref href="https://docs.mattermost.com/administration/config-settings.html#enable-plugins" title="Enable" >}} set to true in the {{< newtabref href="https://docs.mattermost.com/administration/config-settings.html#plugins-beta" title="PluginSettings" >}} section of its config file. If you want to upload plugins via the System Console or API, you'll also need to set {{< newtabref href="https://docs.mattermost.com/administration/config-settings.html#enable-plugin-uploads" title="EnableUploads" >}} to true in the same section.

## Set up the workspace

Create a directory to act as your plugin workspace. With that directory, create and switch to a `webapp` directory:

```bash
mkdir webapp
cd webapp
```

Install the necessary NPM dependencies:

```bash
npm install --save-dev @babel/core @babel/preset-env @babel/preset-react babel-loader webpack webpack-cli
npm install --save react
```

Configure Webpack by creating a `webpack.config.js` file:

```js
var path = require('path');

module.exports = {
    entry: [
        './src/index.jsx',
    ],
    resolve: {
        modules: [
            'src',
            'node_modules',
        ],
        extensions: ['*', '.js', '.jsx'],
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-react',
                            [
                                "@babel/preset-env",
                                {
                                    "modules": "commonjs",
                                    "targets": {
                                        "node": "current"
                                    }
                                }
                            ]
                        ],
                    },
                },
            },
        ],
    },
    externals: {
        react: 'React',
    },
    output: {
        path: path.join(__dirname, '/dist'),
        publicPath: '/',
        filename: 'main.js',
    },
};
```

Observe that `react` is specified as an external library. This allows you to test your code locally (e.g. with {{< newtabref href="https://jestjs.io/" title="jest" >}} and snapshots) but leverage the version of React shipped with Mattermost to avoid bloating your plugin.

Now create the entry point file and output directory:
```bash
mkdir src dist
touch src/index.jsx
```

Then populate `src/index.jsx` with the following:
```jsx
import React from 'react';

// Courtesy of https://feathericons.com/
const Icon = () => <i className='icon fa fa-plug'/>;

class HelloWorldPlugin {
    initialize(registry, store) {
        registry.registerChannelHeaderButtonAction(
            // icon - JSX element to use as the button's icon
            <Icon />,
            // action - a function called when the button is clicked, passed the channel and channel member as arguments
            // null,
            () => {
                alert("Hello World!");
            },
            // dropdown_text - string or JSX element shown for the dropdown button description
            "Hello World",
        );
    }
}

window.registerPlugin('com.mattermost.webapp-hello-world', new HelloWorldPlugin());
```

Generate a minified bundle ready to install as a web app plugin:

```bash
./node_modules/.bin/webpack --mode=production
```

Now, we'll need to define the required manifest describing your plugin's entry point. Create a file named `plugin.json` with the following contents:

```json
{
    "id": "com.mattermost.webapp-hello-world",
    "name": "Hello World",
    "webapp": {
        "bundle_path": "main.js"
    }
}
```

This manifest gives the server the location of your components within your plugin bundle. Consult the [manifest reference]({{< ref "/integrate/plugins/manifest-reference.md" >}}) for more details, including how to define a minimum required server version for your plugin.

Note that you may also use `plugin.yaml` to define the manifest.

Bundle the manifest and entry point into a tar file:

```bash
mkdir -p com.mattermost.webapp-hello-world
cp -r dist/main.js com.mattermost.webapp-hello-world/
cp plugin.json com.mattermost.webapp-hello-world/
tar -czvf plugin.tar.gz com.mattermost.webapp-hello-world
```

You should now have a file named `plugin.tar.gz` in your workspace. Congratulations! This is your first web app plugin!

## Install the plugin

Install the plugin in one of the following ways:

1) Through System Console UI:

    - Log in to Mattermost as a System Admin.
    - Open the System Console at `/admin_console`
    - Navigate to **Plugins > Plugin Management** and upload the `plugin.tar.gz` you generated above.
    - Click **Enable** under the plugin after it has uploaded.

2) Or, manually:

    - Extract `plugin.tar.gz` to a folder with the same name as the plugin id you specified in ``plugin.json``, in this case `com.mattermost.server-hello-world/`.
    - Add the plugin to the directory set by **PluginSettings > Directory** in your ``config.json`` file. If none is set, defaults to `./plugins` relative to your Mattermost installation directory. The resulting directory structure should look something like:

      ```
      mattermost/
          plugins/
              com.mattermost.webapp-hello-world/
                  plugin.json
                  main.js
      ```
    - Restart the Mattermost server.
    - Enable the plugin in **System Console > Plugins > Plugin Management**.

Navigate to a regular Mattermost page and observe the new icon in the channel header. Click the icon and observe the alert dialog.

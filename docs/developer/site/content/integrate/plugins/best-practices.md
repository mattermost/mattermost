---
title: "Best practices"
heading: "Best practices for plugins"
description: "Learn more about best practices for using Mattermost plugins to better extend and integrate your Mattermost server."
weight: 100
aliases:
  - /extend/plugins/best-practices/
---

See here for [server-specific best practices for plugins]({{< ref "/integrate/plugins/components/server/best-practices" >}}). Webapp-specific best practices are incoming.

## How can a plugin enable its configuration through the System Console?

Once a plugin is installed, Administrators have access to the plugin's configuration page in the __System Console > Plugins__ section. The configurable settings must first be defined in the plugin's manifest [setting schema]({{< ref "/integrate/plugins/manifest-reference#settings_schema" >}}). The web app supports several basic pre-defined settings type, e.g. `bool` and `dropdown`, for which the corresponding UI components are provided in order to complete configuration in the System Console.

These settings are stored within the server configuration under [`Plugins`] indexed by plugin ids. The plugin's server code can access their current configuration calling the [`getConfig`]({{< ref "/integrate/reference/server/server-reference#API.GetConfig" >}}) API call and can also make changes as needed with [`saveConfig`]({{< ref "/integrate/reference/server/server-reference#API.SaveConfig" >}}).

## How can a plugin define its own setting type?

A plugin could define its own type of setting with a corresponding custom user interface that will be displayed in the System Console following the process below.  

1. Define a `type: custom` setting in the plugins manifest `settings_schema`

    ```diff
    "settings_schema": {
        "settings": [{
            "key": "NormalSetting",
            "type": "text",
    +    }, {
    +        "key": "CustomSetting",
    +        "type": "custom"
        }]
    }
    ```

2. In the plugin's web app code, define a custom component to manage the plugin's custom setting and register it in the web app with [`registerAdminConsoleCustomSetting`]({{< ref "/integrate/reference/webapp/webapp-reference#registerAdminConsoleCustomSetting" >}}). This component will be instantiated in the System Console with the following `props` passed in:

    - `id`: The setting `key` as defined in the plugin manifest within `settings_schema.settings`.
    - `label`: The text for the component label based on the setting's `displayName` defined in the manifest. 
    - `helpText`: The help text based on the setting's `helpText` defined in the manifest. 
    - `value`: The setting's current json value in the config at the time the component is loaded.
    - `disabled`: Boolean indicating if the setting is disabled by a parent component within the System Console.
    - `config`: The server configuration loaded by the web app.
    - `license`: The license information for the related Mattermost server.
    - `setByEnv`: Boolean that indicates if the setting is based on a server environment variable. 
    - `onChange`: Function that receives the setting id and current json value of the setting when it has been changed within the custom component. 
    - `setSaveNeeded`: Function that will prompt the System Console to enable the Save button in the plugin settings screen. 
    - `registerSaveAction`: Registers the given function to be executed when the setting is saved. This is registered when the custom component is mounted.
    - `unRegisterSaveAction`: On unmount of the custom component, unRegisterSaveAction will remove the registered function executed on save of the custom component.

3. On initialization of the custom component, the current value of the custom setting is passed in the `props.value` in a json format as read from the config. This value can be processed as necessary to display in your custom UI and ready to be modified by the end user. In the example below, it processes the initial `props.value` and sets it in a local state for the component to use as needed:

    ```js
    constructor(props) {
        super(props);
    
        this.state = {
            attributes: this.initAttributes(props.value),
        }
    }
    ```

4. When a user makes a change in the UI, the `OnChange` handler sends back the current value of the setting as a json. Additionally, `setSaveNeeded` should be called to enable the `Save` button in order for the changes to be saved.

    ```js
    handleChange = () => {
        // ...
        this.props.onChange(this.props.id,  Array.from(this.state.attributes.values()));
        this.props.setSaveNeeded()
    };
    ```

5. Once the user saves the changes, any handler that was registered with `registerSaveAction` will be executed to perform any additional custom actions the plugin may require, such as calling an additional endpoint within the plugin. 

For examples of custom settings see: Demo Plugin {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo/blob/master/webapp/src/components/admin_settings/custom_setting.jsx" title="`CustomSetting`" >}} and Custom Attributes Plugin {{< newtabref href="https://github.com/mattermost/mattermost-plugin-custom-attributes/pull/18" title="implementation" >}}.

## How can I review the entire code base of a plugin?

Sometimes, you have been working on a personal repository for a new plugin, most probably based on the {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template/" title="mattermost-plugin-starter-template" >}} repo. As it was a personal project, you may have pushed all of your commits directly to `master`. And now that it's functional, you need a reviewer to take a look at the whole thing.

For this, it is useful to create a PR with only the commits you added. Follow these steps to do so:

1. First of all, you need to obtain the identifier of the oldest commit that should be reviewed. You can review your history with `git log --oneline`, where you need to look for the very first commit that you added. Imagine that the output is something like the following:

    ```
    f7d89b8 (HEAD -> master, origin/master) Lint code
    fa99500 Fix bug
    0b3b5bd Add feature
    8f6aef3 My first commit to the plugin
    ...
    ... rest of commits from mattermost-plugin-starter-template
    ...
    ```

    In this case, the identifier that we need to copy is `8f6aef3`.

2. Create a new branch without the commits that you added. Using the SHA that you copied, create the branch `base` and push it:

    ```shell
    git branch base 8f6aef3~1
    git push origin base
    ```

    Note that `8f6aef3~1` means _the parent commit of `8f6aef3`_, effectively selecting all the commits in the branch except the ones that you added.

3. Create a branch with all the commits, included the ones that you added, and push it. This branch, `compare`, will be an exact copy of `master`:

    ```sh
    git branch compare master
    git push origin compare
    ```

4. Now you have two new branches in the repository: `base` and `compare`. In Github, create a new PR in your repository, setting the _base_ branch to `base` and the _compare_ branch to `compare`.

5. Request a code review on the resulting PR.

For future changes, you can always repeat this process, making sure to identify the first commit you want to be reviewed. You can also consider the more common scenario of creating a feature branch (using something like `git checkout -b my.feature.branch`) and opening a PR whenever you want to merge the changes into `master`. It's up to you!

## When to write a new API method or hook?

Don't be afraid to extend the API or hooks to support brand new functionality. Consider accepting an options struct instead of a list of parameters to simplify extending the API in the future:

```go
// GetUsers a list of users based on search options.
//
// Minimum server version: 5.10
GetUsers(options *model.UserGetOptions) ([]*model.User, *model.AppError)
```

Old servers won't do anything with new, unrecognized fields, but also won't break if they are present.


## How to expose performance metrics for a plugin?

From Mattermost v9.4, a [`ServeMetrics`]({{< ref "/integrate/reference/server/server-reference#API.ServeMetrics" >}}) hook can be used to expose performance metrics in the [open metrics format](https://openmetrics.io/) under the common HTTP listener controlled by the [`MetricsSettings.ListenAddress`](https://docs.mattermost.com/configure/environment-configuration-settings.html#listen-address-for-performance) config setting.

Data returned by the hook's implementation through the given `http.ResponseWriter` object will be served through the `http://SITE_URL:8067/plugins/PLUGIN_ID/metrics` URL.

Here's a sample implementation using the [Prometheus HTTP client
library](https://pkg.go.dev/github.com/prometheus/client_golang/prometheus):

```go
import (
  "net/http"

  "github.com/mattermost/mattermost/server/public/plugin"

  "github.com/prometheus/client_golang/prometheus"
  "github.com/prometheus/client_golang/prometheus/promhttp"
)

func (p *Plugin) initMetrics() {
  p.registry = prometheus.NewRegistry()
  // ... Registrations
}

func (p *Plugin) ServeMetrics(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	promhttp.HandlerFor(p.registry, promhttp.HandlerOpts{}).ServeHTTP(w, r)
}
```


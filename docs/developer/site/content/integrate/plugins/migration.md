---
title: Migrate plugins
heading: "Migrate plugins from Mattermost 5.5"
description: "The plugin package exposed by Mattermost 5.6 and later drops support for automatically unmarshalling a plugin’s configuration onto the struct embedding MattermostPlugin."
date: 2018-10-01T00:00:00-05:00
weight: 60
aliases:
  - /extend/plugins/migration/
---

The plugin package exposed by Mattermost 5.6 and later drops support for automatically unmarshalling a plugin's configuration onto the struct embedding `MattermostPlugin`. As server plugins are inherently concurrent (hooks being called asynchronously) and the plugin configuration can change at any time, access to the configuration must be synchronized.

Plugins compiled against 5.5 and earlier will continue to work without modification, automatically unmarshalling a plugin's configuration but with the existing risk of a corrupted read or write. Once the plugin is recompiled against Mattermost 5.6, it will be necessary to manually unmarshal your plugin's configuration. Client-only plugins and server plugins without public fields require no modifications.

Note that you do not need to wait until Mattermost 5.6 to make these changes, as the hardened approach explained below will work with Mattermost 5.5 and earlier. Any implementation of `OnConfigurationChange` you define overrides the one automatically unmarshalling.

### Server changes

#### Unmarshalling configuration

Previously, any public fields defined on the struct embedding `MattermostPlugin` would be automatically unmarshalled from the plugin's configuration:

```go
type Plugin struct {
    plugin.MattermostPlugin

    Greeting string
}

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello %s!", p.Greeting)
}
```

Writing to `Greeting` while the plugin may be concurrently reading from same could result in a corrupted read or write. The {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template" title="mattermost-plugin-starter-template" >}} and {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo" title="mattermost-plugin-demo" >}} have both been updated with more complete examples, but the general idea is to manually handle the `OnConfigurationChange` hook and synchronize access to these variables. One such way is with a {{< newtabref href="https://golang.org/pkg/sync/#RWMutex" title="sync.RWMutex" >}}:

```go
type Plugin struct {
    plugin.MattermostPlugin

    greetingLock sync.Mutex
    greeting string
}

func (p *Plugin) OnConfigurationChange() error {
    type configuration struct {
        Greeting string
    }

    // Load the public configuration fields from the Mattermost server configuration.
    if err := p.API.LoadPluginConfiguration(configuration); err != nil {
        return errors.Wrap(err, "failed to load plugin configuration")
    }

    p.configurationLock.Lock()
    defer p.configurationLock.Unlock()
    p.greeting = configuration.Greeting

    return nil
}

func (p *Plugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
    p.configurationLock.RLock()
    defer p.configurationLock.RUnlock()

    fmt.Fprintf(w, "Hello %s!", p.greeting)
}
```

Unfortunately, this adds a fair bit of extra complexity. You may wish to base your updated implementation off of {{< newtabref href="https://github.com/mattermost/mattermost-plugin-starter-template" title="mattermost-plugin-starter-template" >}} or {{< newtabref href="https://github.com/mattermost/mattermost-plugin-demo" title="mattermost-plugin-demo" >}} to simplify your code.

## Migrate plugins from Mattermost 5.1 and earlier

Mattermost 5.2 introduces breaking changes to the plugins beta. This page documents the changes necessary to migrate your existing plugins to be compatible with Mattermost 5.2 and later.

See {{< newtabref href="https://github.com/mattermost/mattermost-plugin-zoom/compare/98eca6653e1a62c6b758e39b24d6ea075905c210...master" title="mattermost-plugin-zoom" >}} for an example migration involving both a server and web app component.

### Server changes

Although the underlying changes are significant, the required migration for server plugins is minimal.

#### Entry point

The plugin entry point was previously:

```go
import "github.com/mattermost/server/public/plugin/rpcplugin"

func main() {
    rpcplugin.Main(&HelloWorldPlugin{})
}
```

Change the imported package and invoke `ClientMain` instead:

```go
import "github.com/mattermost/mattermost/server/public/plugin"

func main() {
    plugin.ClientMain(&HelloWorldPlugin{})
}
```

#### Hook parameters

Most hook callbacks now contain a leading `plugin.Context` parameter. Consult the [Hooks]({{< ref "/integrate/reference/server/server-reference#Hooks" >}}) documentation for more details, but for example, the `ServeHTTP` hook was previously:

```go
func (p *MyPlugin) ServeHTTP(w http.ResponseWriter, r *http.Request) {
    // ...
}
```

Change it to:

```go
func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
    // ...
}
```

#### API changes

Most of the previous API calls remain available and unchanged, with the notable exception of removing the `KeyValueStore()`. Use [KVSet]({{< ref "/integrate/reference/server/server-reference#API.KVSet" >}}), [KVGet]({{< ref "/integrate/reference/server/server-reference#API.KVGet" >}}) and [KVDelete]({{< ref "/integrate/reference/server/server-reference#API.KVDelete" >}}) instead test:

```go
func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
    key := r.URL.Query().Get("key")
    switch r.Method {
    case http.MethodGet:
        value, _ := p.API.KVGet(key)
        fmt.Fprintf(w, string(value))
    case http.MethodPut:
        value := r.URL.Query().Get("value")
        p.API.KVSet(key, []byte(value))
    case http.MethodDelete:
        p.API.KVDelete(key)
    }
}
```

Any standard error from your plugin will now be captured in the server logs, including output from the standard {{< newtabref href="https://golang.org/pkg/log/" title="log" >}} package, but there are also explicit API methods for emitting structured logs:

```go
func (p *MyPlugin) ServeHTTP(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
    p.API.LogDebug("received http request", "user_agent", r.UserAgent())
    if r.Referer() == "" {
        p.API.LogError("missing referer")
    }
}
```

This would generate something like the following in your server logs:
```json
{"level":"debug","ts":1531494669.83655,"caller":"app/plugin_api.go:254","msg":"received http request","plugin_id":"my-plugin","user_agent":"HTTPie/0.9.9"}
{"level":"error","ts":1531494669.8368616,"caller":"app/plugin_api.go:260","msg":"missing referer","plugin_id":"my-plugin"}
```

### Web app changes

The changes to web app plugins are more significant than server plugins.

#### Entry point

The plugin entry point was previously registered by directly manipulating a global variable:

```js
window.plugins['my-plugin'] = new MyPlugin();
```

Instead, use the globally exported `registerPlugin` method:

```js
window.registerPlugin('my-plugin', new MyPlugin());
```

#### Externalize dependencies

The plugins beta suggested relying on the global export of common libraries from the web app:

```js
const React = window.react;
```

While this remains supported, it is more natural to leverage Webpack {{< newtabref href="https://webpack.js.org/configuration/externals/" title="Externals" >}}. Configure this in your `.webpack.config.js`:

```js
module.exports = {
    // ...
    externals: {
        react: 'react',
    },
    // ...
};
```

and then import your modules naturally:

```js
import React from 'react';
```

Note however that the exported variables have changed to the following:

| Prior to Mattermost 5.2   | Mattermost 5.2        |
|---------------------------|-----------------------|
| window.react              | window.React          |
| window['react-dom']       | window.ReactDom       |
| window.redux              | window.Redux          |
| window['react-redux']     | window.ReactRedux     |
| window['react-bootstrap'] | window.ReactBootstrap |
| window['post-utils']      | window.PostUtils      |
| _N/A_                     | window.PropTypes      |

#### Initialization

The `initialize` callback used to receive a `registerComponents` callback to configure components, post types and main menu overrides:

```js
import ChannelHeaderButton from './components/channel_header_button';
import MobileChannelHeaderButton from './components/mobile_channel_header_button';
import PostTypeZoom from './components/post_type_zoom';
import {configureZoom} from './actions/zoom';

class MyPlugin {
    initialize(registerComponents) {
        registerComponents(
            {ChannelHeaderButton, MobileChannelHeaderButton},
            {custom_zoom: PostTypeZoom},
            {
                id: 'zoom-configuration',
                text: 'Zoom Configuration',
                action: configureZoom,
            },
        );
    }
}
```

The `initialize` callback now receives an instance of the plugin [registry]({{< ref "/integrate/reference/webapp/webapp-reference#registry" >}}). In some cases, the registry's API now requires a more discrete breakdown of the registered component to allow the web app to handle various rendering scenarios:

```js
import ChannelHeaderButtonIcon from './components/channel_header_button/icon';
import MobileChannelHeaderButton from './components/mobile_channel_header_button';
import PostTypeZoom from './components/post_type_zoom';
import {startZoomMeeting, configureZoom} from './actions/zoom';

class MyPlugin {
    initialize(registry) {
        registry.registerChannelHeaderButtonAction(
            ChannelHeaderButtonIcon,
            startZoomMeeting,
            'Start Zoom Meeting',
        );

        registry.registerPostTypeComponent('custom_zoom', PostTypeZoom);

        registry.registerMainMenuAction(
            'Zoom Configuration',
            configureZoom,
            MobileChannelHeaderButton,
        );
    }
}
```

Restructuring your plugin to use the new registry API will likely prove to be the hardest part of migrating.

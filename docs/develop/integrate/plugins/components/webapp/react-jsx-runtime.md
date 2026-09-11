---
title: "React JSX runtime compatibility"
sidebar_position: 30
---

Mattermost v12 uses React 19. Web app plugins must use the host's React and ReactDOM, along with JSX helpers compatible with that React version. On Mattermost v12, use the JSX helpers provided by the host. Externalizing only `react` can leave an older `react/jsx-runtime` bundled in the plugin or one of its dependencies, causing `ReactCurrentOwner` or incompatible-element errors.

Choose the setup that matches the servers your plugin supports:

- **Mattermost v12 only:** [use the host runtime exports directly](#mattermost-v12-only-plugins).
- **Mattermost v12 and older servers:** [use compatibility modules](#plugins-that-support-older-servers) that select the host exports when available and a compatible bundled runtime otherwise.

Rebuild and release a plugin after changing its runtime configuration. Adding host exports does not change a bundle that has already been published.

For background on React 19 changes, see the [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide). The `externals` examples below use [Webpack's externals configuration](https://webpack.js.org/configuration/externals/).

## Mattermost v12-only plugins

Mattermost v12 publishes these synchronous JSX helpers alongside `React` and `ReactDOM`, before plugin bundles execute:

```js
window.ReactJSXRuntime
// {Fragment, jsx, jsxs}

window.ReactJSXDevRuntime
// {Fragment, jsxDEV}
```

Use these exports for both automatic JSX runtime entry points: `react/jsx-runtime` and `react/jsx-dev-runtime`. Development plugin builds also work on production hosts, but development-only JSX diagnostics are unavailable there.

On development hosts, `jsxDEV` uses React's native implementation. On production hosts, it calls the host's `jsx` or `jsxs` according to `isStaticChildren`; the fallback does not use development source or self metadata.

These helpers must be available synchronously before plugin code runs. Do not load them through the asynchronous `loadSharedDependency` helper.

In your plugin's Webpack configuration, externalize all five module paths below. Include `react-dom/client` because dependencies may import it directly:

```js
module.exports = {
    // ...
    externals: {
        react: 'React',
        'react-dom': 'ReactDOM',
        'react-dom/client': 'ReactDOM',
        'react/jsx-runtime': 'ReactJSXRuntime',
        'react/jsx-dev-runtime': 'ReactJSXDevRuntime',
    },
};
```

Set `"min_server_version": "12.0.0"` in the plugin manifest. This setup requires the v12 host exports and does not need an older-server fallback.

## Plugins that support older servers

The bundled fallback must be compatible with the React versions used by the older servers you support. The examples below use the JSX runtime from the plugin's installed `react` package as that fallback. Installing React 19 in the plugin does not provide a fallback for older React hosts.

Keep `react` externalized and retain the ReactDOM configuration that works on your supported older hosts. Map `react-dom/client` to `ReactDOM` only if every supported host provides the required APIs, such as `createRoot`.

### 1. Create the compatibility modules

Create both files below in your plugin's webapp directory. Each module selects the host runtime before requiring the bundled fallback. The React 19 guard prevents an older fallback from loading on a newer host that is missing the required exports.

```js
// src/jsx-runtime-compat.js
const hostRuntime = typeof window !== 'undefined' &&
    window.ReactJSXRuntime;
const hasHostRuntime = hostRuntime && hostRuntime.Fragment &&
    typeof hostRuntime.jsx === 'function' && typeof hostRuntime.jsxs === 'function';

if (hasHostRuntime) {
    module.exports = hostRuntime;
} else {
    const reactVersion = typeof window !== 'undefined' && window.React && window.React.version;
    const reactMajor = reactVersion && Number.parseInt(reactVersion, 10);
    if (reactMajor >= 19) {
        throw new Error('Mattermost host is missing window.ReactJSXRuntime; upgrade Mattermost or install a compatible plugin build.');
    }
    module.exports = require('plugin-react-jsx-runtime-fallback');
}
```

```js
// src/jsx-dev-runtime-compat.js
const hostRuntime = typeof window !== 'undefined' &&
    window.ReactJSXDevRuntime;
const hasHostRuntime = hostRuntime && hostRuntime.Fragment &&
    typeof hostRuntime.jsxDEV === 'function';

if (hasHostRuntime) {
    module.exports = hostRuntime;
} else {
    const reactVersion = typeof window !== 'undefined' && window.React && window.React.version;
    const reactMajor = reactVersion && Number.parseInt(reactVersion, 10);
    if (reactMajor >= 19) {
        throw new Error('Mattermost host is missing window.ReactJSXDevRuntime; upgrade Mattermost or install a compatible plugin build.');
    }
    module.exports = require('plugin-react-jsx-dev-runtime-fallback');
}
```

Keep each fallback `require` inside its `else` branch. An unconditional ESM import would evaluate the older runtime before the host runtime can be selected.

### 2. Configure Webpack

Add exact Webpack aliases and resolve the fallback names to the original package files:

```js
const path = require('path');

module.exports = {
    // ...
    externals: {
        react: 'React',
        'react-dom': 'ReactDOM',
    },
    resolve: {
        alias: {
            'react/jsx-runtime$': path.resolve(__dirname, 'src/jsx-runtime-compat.js'),
            'react/jsx-dev-runtime$': path.resolve(__dirname, 'src/jsx-dev-runtime-compat.js'),
            'plugin-react-jsx-runtime-fallback$': require.resolve('react/jsx-runtime'),
            'plugin-react-jsx-dev-runtime-fallback$': require.resolve('react/jsx-dev-runtime'),
        },
    },
};
```

The `$` aliases match the complete request, including imports made by dependencies. The fallback names are local aliases, not additional packages to install. They point to the original runtime files so the compatibility modules do not resolve themselves recursively.

If you already externalize `react/jsx-runtime` or `react/jsx-dev-runtime`, remove those two external entries. An external bypasses the compatibility modules.

### 3. Verify and release the plugin

Run both `require.resolve` calls from the plugin's actual webapp directory and verify that its runtime package exposes both entry points before adopting this configuration.

Inspect the emitted bundle for JSX runtimes embedded by dependencies. An alias can intercept a dependency's `react/jsx-runtime` import or require, but it cannot replace a runtime already embedded in that dependency's code. If you find one, update the dependency to a release that imports the runtime separately, then rebuild the plugin.

Test the same plugin bundle on a v12 host and on each supported older host before releasing it. Keep the manifest's `min_server_version` set to the oldest server version you support and have verified.

## Scope of this compatibility

The shared JSX runtime keeps element creation aligned; it does not restore APIs removed by React 19. Replace plugin or dependency calls to `findDOMNode` with DOM refs, and replace legacy root rendering and unmounting with root handles. Check delayed UI paths such as modals, menus, and settings in both production and development plugin builds, including a development plugin on a production host.

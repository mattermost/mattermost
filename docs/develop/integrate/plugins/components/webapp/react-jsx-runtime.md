---
title: "React JSX runtime compatibility"
sidebar_position: 30
---

Mattermost v12 uses React 19. Web app plugins must use the host's React, ReactDOM, and JSX runtime. Externalizing only `react` can leave an older JSX runtime bundled in the plugin or a dependency, causing `ReactCurrentOwner` or incompatible-element errors.

## 1. Require Mattermost 12.0

Set `"min_server_version": "12.0.0"` in the plugin manifest, or keep a higher minimum if your plugin already requires one.

## 2. Use the host's JSX runtime

Add all five module paths below to your plugin's Webpack `externals` configuration:

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

Continue writing JSX normally. With the automatic JSX transform, your compiler imports helpers from `react/jsx-runtime` or `react/jsx-dev-runtime`; this configuration resolves those imports to Mattermost's runtime. Include `react-dom/client` because dependencies may import it directly.

Mattermost provides these exports before plugin code runs. Development plugin builds also work on production hosts, but development-only JSX diagnostics are unavailable there.

## 3. Rebuild and test

Rebuild and release the plugin after updating its configuration. Existing published bundles are not changed by the host exports.

Check dependencies for embedded JSX runtimes. Webpack externals handle module imports, but cannot replace a runtime already embedded in a dependency's code. Update affected dependencies to versions that import the runtime separately.

Test the rebuilt plugin on Mattermost 12.0, including modals, menus, settings, and other UI that appears after startup. Exercise production and development plugin builds, including a development plugin on a production host. If your plugin requires a higher minimum server version, test on that version.

The shared JSX runtime does not restore APIs removed by React 19. Replace `findDOMNode` with DOM refs and legacy ReactDOM rendering calls with root APIs. See the [React 19 upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) for the remaining migration steps.

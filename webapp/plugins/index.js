// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// EXPERIMENTAL - SUBJECT TO CHANGE

import store from 'stores/redux_store.jsx';

global.window.plugins = {};
global.window.plugins.components = {};

export function registerComponents(components) {
    global.window.plugins.components = {...components, ...global.window.plugins.components};
}

export function initializePlugins() {
    const pluginJson = global.window.mm_config.Plugins || '[]';
    const pluginManifests = JSON.parse(pluginJson);

    pluginManifests.forEach((m) => {
        // Fetch the plugin's bundled js
        const xhrObj = new XMLHttpRequest();
        xhrObj.open('GET', m.bundle_path, false);
        xhrObj.send('');

        // Add the plugin's js to the page
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.text = xhrObj.responseText;
        document.getElementsByTagName('head')[0].appendChild(script);

        // Initialize the plugin
        console.log('Registering ' + m.id + ' plugin...'); //eslint-disable-line no-console
        const plugin = global.window.plugins[m.id];
        plugin.initialize(registerComponents, store);
        console.log('...done'); //eslint-disable-line no-console
    });
}


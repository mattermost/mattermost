// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// EXPERIMENTAL - SUBJECT TO CHANGE

import store from 'stores/redux_store.jsx';
import {ActionTypes} from 'utils/constants.jsx';
import {getSiteURL} from 'utils/url.jsx';

window.plugins = {};

export function registerComponents(components) {
    store.dispatch({
        type: ActionTypes.RECEIVED_PLUGIN_COMPONENTS,
        data: components || {}
    });
}

export function initializePlugins() {
    const pluginJson = window.mm_config.Plugins || '[]';

    let pluginManifests;
    try {
        pluginManifests = JSON.parse(pluginJson);
    } catch (error) {
        console.error('Invalid plugins JSON: ' + error); //eslint-disable-line no-console
        return;
    }

    pluginManifests.forEach((m) => {
        function onLoad() {
            // Add the plugin's js to the page
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.text = this.responseText;
            document.getElementsByTagName('head')[0].appendChild(script);

            // Initialize the plugin
            console.log('Registering ' + m.id + ' plugin...'); //eslint-disable-line no-console
            const plugin = window.plugins[m.id];
            plugin.initialize(registerComponents, store);
            console.log('...done'); //eslint-disable-line no-console
        }

        // Fetch the plugin's bundled js
        const xhrObj = new XMLHttpRequest();
        xhrObj.open('GET', getSiteURL() + m.bundle_path, true);
        xhrObj.addEventListener('load', onLoad);
        xhrObj.send('');
    });
}

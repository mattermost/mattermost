// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../fixtures/timeouts';

// *****************************************************************************
// Plugins
// https://api.mattermost.com/#tag/plugins
// *****************************************************************************

Cypress.Commands.add('apiGetAllPlugins', () => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: '/api/v4/plugins',
        method: 'GET',
        failOnStatusCode: false,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap({plugins: response.body});
    });
});

function getPlugin(plugins, pluginId, version) {
    return Cypress._.find(plugins, (plugin) => {
        return version ? plugin.id === pluginId && plugin.version === version : plugin.id === pluginId;
    });
}

Cypress.Commands.add('apiGetPluginStatus', (pluginId, version) => {
    return cy.apiGetAllPlugins().then(({plugins}) => {
        const active = getPlugin(plugins.active, pluginId, version);
        const inactive = getPlugin(plugins.inactive, pluginId, version);

        if (active) {
            return cy.wrap({isInstalled: true, isActive: true});
        }

        if (inactive) {
            return cy.wrap({isInstalled: true, isActive: false});
        }

        return cy.wrap({isInstalled: false, isActive: false});
    });
});

Cypress.Commands.add('apiUploadPlugin', (filename) => {
    const options = {
        url: '/api/v4/plugins',
        method: 'POST',
        successStatus: 201,
    };
    return cy.apiUploadFile('plugin', filename, options).then(() => {
        return cy.wait(TIMEOUTS.THREE_SEC);
    });
});

Cypress.Commands.add('apiUploadAndEnablePlugin', ({filename, url, id, version}) => {
    return cy.apiGetPluginStatus(id, version).then((data) => {
        // # If already active, then only return the data
        if (data.isActive) {
            cy.log(`${id}: Plugin is active.`);
            return cy.wrap(data);
        }

        // # If already installed, then only enable the plugin
        if (data.isInstalled) {
            cy.log(`${id}: Plugin is inactive. Only going to enable.`);
            return cy.apiEnablePluginById(id).then(() => {
                cy.wait(TIMEOUTS.ONE_SEC);
                return cy.wrap(data);
            });
        }

        if (url) {
            // # Upload plugin by URL then enable
            cy.log(`${id}: Plugin is to be uploaded via URL and then enable.`);
            return cy.apiInstallPluginFromUrl(url).then(() => {
                cy.wait(TIMEOUTS.FIVE_SEC);
                return cy.apiEnablePluginById(id).then(() => {
                    cy.wait(TIMEOUTS.ONE_SEC);
                    return cy.wrap({isInstalled: true, isActive: true});
                });
            });
        }

        // # Upload plugin by file then enable
        cy.log(`${id}: Plugin is to be uploaded by filename and then enable.`);
        return cy.apiUploadPlugin(filename).then(() => {
            return cy.apiEnablePluginById(id).then(() => {
                return cy.wrap({isInstalled: true, isActive: true});
            });
        });
    });
});

Cypress.Commands.add('apiInstallPluginFromUrl', (url, force = true) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/plugins/install_from_url?plugin_download_url=${encodeURIComponent(url)}&force=${force}`,
        method: 'POST',
        timeout: TIMEOUTS.TWO_MIN,
        failOnStatusCode: false,
    }).then((response) => {
        expect(response.status).to.equal(201);

        cy.wait(TIMEOUTS.THREE_SEC);
        return cy.wrap({plugin: response.body});
    });
});

Cypress.Commands.add('apiEnablePluginById', (pluginId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/plugins/${encodeURIComponent(pluginId)}/enable`,
        method: 'POST',
        timeout: TIMEOUTS.TWO_MIN,
        failOnStatusCode: false,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

Cypress.Commands.add('apiDisablePluginById', (pluginId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/plugins/${encodeURIComponent(pluginId)}/disable`,
        method: 'POST',
        timeout: TIMEOUTS.ONE_MIN,
        failOnStatusCode: false,
    }).then((response) => {
        expect(response.status).to.equal(200);
        return cy.wrap(response);
    });
});

const prepackagedPlugins = [
    'antivirus',
    'mattermost-autolink',
    'com.mattermost.aws-sns',
    'com.mattermost.plugin-channel-export',
    'com.mattermost.custom-attributes',
    'github',
    'com.github.manland.mattermost-plugin-gitlab',
    'com.mattermost.plugin-incident-management',
    'jenkins',
    'jira',
    'com.mattermost.nps',
    'com.mattermost.welcomebot',
    'zoom',
];

Cypress.Commands.add('apiDisableNonPrepackagedPlugins', () => {
    cy.apiGetAllPlugins().then(({plugins}) => {
        plugins.active.forEach((plugin) => {
            if (!prepackagedPlugins.includes(plugin.id)) {
                cy.apiDisablePluginById(plugin.id);
            }
        });
    });
});

Cypress.Commands.add('apiRemovePluginById', (pluginId) => {
    return cy.request({
        headers: {'X-Requested-With': 'XMLHttpRequest'},
        url: `/api/v4/plugins/${encodeURIComponent(pluginId)}`,
        method: 'DELETE',
        timeout: TIMEOUTS.TWO_MIN,
        failOnStatusCode: false,
    }).then((response) => {
        return cy.wrap(response);
    });
});

Cypress.Commands.add('apiUninstallAllPlugins', () => {
    // # Uninstall all plugins
    cy.apiGetAllPlugins().then(({plugins}) => {
        const {active, inactive} = plugins;
        inactive.forEach((plugin) => cy.apiRemovePluginById(plugin.id));
        active.forEach((plugin) => cy.apiRemovePluginById(plugin.id));
    });

    // * Check that all plugins are uninstalled
    cy.apiGetAllPlugins().then(({plugins}) => {
        const {active, inactive} = plugins;

        // # Log all uninstalled plugins for debugging
        if (active.length) {
            cy.log(JSON.stringify(active));
        }
        if (inactive.length) {
            cy.log(JSON.stringify(active));
        }

        expect(active.length).to.equal(0);
        expect(inactive.length).to.equal(0);
    });
});

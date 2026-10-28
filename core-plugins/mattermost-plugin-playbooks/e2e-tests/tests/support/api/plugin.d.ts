// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/// <reference types="cypress" />

// ***************************************************************
// Each command should be properly documented using JSDoc.
// See https://jsdoc.app/index.html for reference.
// Basic requirements for documentation are the following:
// - Meaningful description
// - Specific link to https://api.mattermost.com
// - Each parameter with `@params`
// - Return value with `@returns`
// - Example usage with `@example`
// Custom command should follow naming convention of having `api` prefix, e.g. `apiLogin`.
// ***************************************************************

interface PluginStatus {
    isInstalled: boolean;
    isActive: boolean;
}

interface PluginTestInfo {
    id: string;
    version: string;
    url: string;
    filename: string;
}

declare namespace Cypress {
    interface Chainable {

        /**
         * Get plugins.
         * See https://api.mattermost.com/#tag/plugins/paths/~1plugins/get
         * @returns {PluginsResponse} `out.plugins` as `PluginsResponse`
         *
         * @example
         *   cy.apiGetAllPlugins().then(({plugins}) => {
         *       // do something with plugins
         *   });
         */
        apiGetAllPlugins(): Chainable<PluginsResponse>;

        /**
         * Get plugins.
         * @param {string} pluginId - plugin ID
         * @param {string} version - plugin version
         *
         * @returns {PluginStatus} - plugin status if upload and active
         *
         * @example
         *   cy.apiGetPluginStatus(pluginId, version).then((status) => {
         *       // do something with status
         *   });
         */
        apiGetPluginStatus(pluginId: string, version?: string): Chainable<PluginStatus>;

        /**
         * Upload plugin.
         * See https://api.mattermost.com/#tag/plugins/paths/~1plugins/post
         * @param {string} filename - name of the plugin to upload
         * @returns {Response} response: Cypress-chainable response
         *
         * @example
         *   cy.apiUploadPlugin('filename');
         */
        apiUploadPlugin(filename: string): Chainable<Response>;

        /**
         * Upload a plugin and enable.
         * - If a plugin is already active, then it will immediately return.
         * - If a plugin is inactive, then it will be enabled only.
         * - If a plugin is not found in the server, then it will be uploaded
         * and the enabled.
         * - On plugin upload, if `pluginTestInfo` includes a `url` field, then
         * the plugin will be installed via URL. Otherwise if `filename` field
         * is present, then it will look at such filename under fixtures folder
         * and then use the file to upload.
         *
         * @param {PluginTestInfo} pluginTestInfo - plugin test info
         * @returns {Response} response: Cypress-chainable response
         *
         * @example
         *   cy.apiUploadAndEnablePlugin(pluginTestInfo);
         */
        apiUploadAndEnablePlugin(pluginTestInfo: PluginTestInfo): Chainable<Response>;

        /**
         * Install plugin from url.
         * See https://api.mattermost.com/#tag/plugins/paths/~1plugins~1install_from_url/post
         * @param {string} pluginDownloadUrl - URL used to download the plugin
         * @param {string} force - Set to 'true' to overwrite a previously installed plugin with the same ID, if any
         * @returns {PluginManifest} `out.plugin` as `PluginManifest`
         *
         * @example
         *   cy.apiInstallPluginFromUrl('url', 'true').then(({plugin}) => {
         *       // do something with plugin
         *   });
         */
        apiInstallPluginFromUrl(pluginDownloadUrl: string, force: string): Chainable<PluginManifest>;

        /**
         * Enable plugin.
         * See https://api.mattermost.com/#tag/plugins/paths/~1plugins~1{plugin_id}~1enable/post
         * @param {string} pluginId - Id of the plugin to enable
         * @returns {string} `out.status`
         *
         * @example
         *   cy.apiEnablePluginById('pluginId');
         */
        apiEnablePluginById(pluginId: string): Chainable<Record<string, any>>;

        /**
         * Disable plugin.
         * See https://api.mattermost.com/#tag/plugins/paths/~1plugins~1{plugin_id}~disable/post
         * @param {string} pluginId - Id of the plugin to disable
         * @returns {string} `out.status`
         *
         * @example
         *   cy.apiDisablePluginById('pluginId');
         */
        apiDisablePluginById(pluginId: string): Chainable<Record<string, any>>;

        /**
         * Disable all plugins installed that are not prepackaged.
         *
         * @example
         *   cy.apiDisableNonPrepackagedPlugins();
         */
        apiDisableNonPrepackagedPlugins(): Chainable<Record<string, any>>;

        /**
         * Remove plugin.
         * See https://api.mattermost.com/#tag/plugins/paths/~1plugins~1{plugin_id}/delete
         * @param {string} pluginId - Id of the plugin to uninstall
         * @returns {string} `out.status`
         *
         * @example
         *   cy.apiRemovePluginById('url');
         */
        apiRemovePluginById(pluginId: string, force: string): Chainable<Record<string, any>>;

        /**
         * Removes all active and inactive plugins.
         *
         * @example
         *   cy.apiUninstallAllPlugins();
         */
        apiUninstallAllPlugins(): Chainable;
    }
}

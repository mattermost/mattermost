// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

/**
 * Note: This spec requires "demoPlugin" and "demoPluginOld" files
 * at fixtures folder.
 * See details at "e2e/cypress/tests/utils/plugins.js", download the files
 * from the given "@url" and save as indicated in the "@filename"
 * under fixtures folder.
 */

// Group: @channels @system_console @plugin @plugins_uninstall @not_cloud

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {demoPlugin, demoPluginOld} from '../../../utils/plugins';

import {waitForAlertMessage} from './helpers';

describe('Plugin remains enabled when upgraded', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();
        cy.apiUninstallAllPlugins();

        // # Visit plugin management in the system console
        cy.visit('/admin_console/plugins/plugin_management');
        cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Plugin Management');
    });

    it('MM-T40 Plugin remains enabled when upgraded', () => {
        // # Set plugin settings
        const newSettings = {
            ServiceSettings: {
                EnableGifPicker: true,
            },
            FileSettings: {
                EnablePublicLink: true,
            },
        };
        cy.apiUpdateConfig(newSettings);

        // * Upload Demo plugin from the browser
        const mimeType = 'application/gzip';
        cy.fixture(demoPluginOld.filename, 'binary').
            then(Cypress.Blob.binaryStringToBlob).
            then((fileContent) => {
                cy.get('input[type=file]').attachFile({fileContent, fileName: demoPluginOld.filename, mimeType});
            });

        cy.get('#uploadPlugin').scrollIntoView().should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify that the button shows correct text while uploading
        cy.findByText('Uploading...', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // * Verify that the button shows correct text and is disabled after upload
        waitForServerStatus(demoPluginOld.id, demoPluginOld.version, {isInstalled: true});
        cy.findByText('Upload', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
        cy.get('#uploadPlugin', {timeout: TIMEOUTS.ONE_MIN}).should('be.disabled');

        // * Verify that the old demo plugin is successfully uploaded
        cy.findByText(`Successfully uploaded plugin from ${demoPluginOld.filename}`);

        // # Enable demo plugin
        doTaskOnPlugin(demoPluginOld.id, () => {
            // * Verify Demo Plugin title is shown
            cy.waitUntil(() => cy.get('strong').scrollIntoView().should('be.visible').then((title) => {
                return title[0].innerText === 'Demo Plugin';
            }));

            // # Click on Enable link
            cy.findByText('Enable').click();
        });

        // * Verify older version of demo plugin
        cy.findByText(new RegExp(`${demoPluginOld.id} - ${demoPluginOld.version}`)).scrollIntoView().should('be.visible');

        cy.get('#uploadPlugin').scrollIntoView().should('be.visible');

        // # Upgrade plugin
        cy.fixture(demoPlugin.filename, 'binary').
            then(Cypress.Blob.binaryStringToBlob).
            then((fileContent) => {
                cy.get('input[type=file]').attachFile({fileContent, fileName: demoPlugin.filename, mimeType});
            });

        // * Verify that the button shows correct text while uploading
        cy.get('#uploadPlugin').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Confirm overwrite of plugin with same name
        cy.get('#confirmModalButton').should('be.visible').click();

        // * Verify that the button shows correct text and is disabled after upload
        waitForServerStatus(demoPlugin.id, demoPlugin.version, {isActive: true});
        cy.findByText('Upload', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
        cy.get('#uploadPlugin', {timeout: TIMEOUTS.ONE_MIN}).should('be.disabled');

        // * Verify that the latest demo plugin is successfully uploaded
        cy.findByText(`Successfully updated plugin from ${demoPlugin.filename}`);

        // * Verify plugin is running
        waitForAlertMessage(demoPlugin.id, 'This plugin is running.');

        // * Verify latest version of demo plugin
        cy.findByText(new RegExp(`${demoPlugin.id} - ${demoPlugin.version}`)).scrollIntoView().should('be.visible');
    });

    it('MM-T39 Disable Plugin on Removal', () => {
        const {id: pluginId, url: pluginUrl, version} = demoPlugin;

        // # Install demo plugin and enable it
        cy.apiUploadAndEnablePlugin({url: pluginUrl, id: pluginId});
        waitForServerStatus(pluginId, version, {isActive: true});
        cy.findByTestId(pluginId).scrollIntoView().should('be.visible');
        waitForAlertMessage(pluginId, 'This plugin is running.');

        // # Remove demo plugin
        cy.apiRemovePluginById(pluginId);
        waitForServerStatus(pluginId, version, {isInstalled: false});
        cy.findByTestId(pluginId).should('not.exist');

        // # Install demo plugin again
        cy.apiInstallPluginFromUrl(demoPlugin.url, true);
        waitForServerStatus(pluginId, version, {isInstalled: true});

        cy.apiGetPluginStatus(pluginId).then((data) => {
            // * Confirm demo plugin is uploaded but not active/enabled
            expect(data.isInstalled).to.be.true;
            expect(data.isActive).to.be.false;
        });

        // * Verify demo plugin is installed but disabled
        cy.findByTestId(pluginId).scrollIntoView().should('be.visible');
        waitForAlertMessage(pluginId, 'This plugin is not enabled.');
    });
});

function doTaskOnPlugin(pluginId, taskCallback) {
    cy.findByText(/Installed Plugins/).scrollIntoView().should('be.visible');
    cy.findByTestId(pluginId).scrollIntoView().should('be.visible').within(() => {
        // # Perform task
        taskCallback();
    });
}

function waitForServerStatus(pluginId, version, state = {}) {
    const checkFn = () => {
        cy.log(`Waiting for ${pluginId}`);
        return cy.apiGetPluginStatus(pluginId, version).then((status) => {
            if (Object.hasOwn(state, 'isActive')) {
                return state.isActive === status.isActive;
            }

            if (Object.hasOwn(state, 'isInstalled')) {
                return state.isInstalled === status.isInstalled;
            }

            return false;
        });
    };

    const options = {
        timeout: TIMEOUTS.TWO_MIN,
        interval: TIMEOUTS.FIVE_SEC,
    };

    return cy.waitUntil(checkFn, options);
}

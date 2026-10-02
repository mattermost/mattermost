// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// <reference path="../support/index.d.ts" />

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

/**
 * Note: This spec requires "demoPlugin" file at fixtures folder.
 * See details at "e2e/cypress/tests/utils/plugins.js", download the file
 * from the given "@url" and save as indicated in the "@filename"
 * under fixtures folder.
 */

// Group: @channels @system_console @plugin @not_cloud @timeout_error

import {waitForAlertMessage} from './helpers';

import * as TIMEOUTS from '@/fixtures/timeouts';
import {demoPlugin} from '@/utils/plugins';

describe('Plugins Management', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();
        cy.apiRemovePluginById(demoPlugin.id);
    });

    it('MM-T2400 Plugins Management', () => {
        // Visit the plugin management page
        cy.visit('/admin_console/plugins/plugin_management');

        const mimeType = 'application/gzip';
        cy.fixture(demoPlugin.filename, 'binary').
            then(Cypress.Blob.binaryStringToBlob).
            then((fileContent) => {
                cy.get('input[type=file]').attachFile({fileContent, fileName: demoPlugin.filename, mimeType});
            });

        // * Verify initial disabled state after upload
        cy.findByTestId(demoPlugin.id, {timeout: TIMEOUTS.FIVE_MIN}).scrollIntoView().should('be.visible').within(() => {
            cy.findByText('Enable').should('be.visible');
            cy.findByText('Remove').should('be.visible');
        });

        verifyStatus(demoPlugin.id, 'This plugin is not enabled.');

        // * Reload browser to make plugin's Settings appear
        cy.reload();

        cy.findByTestId(demoPlugin.id, {timeout: TIMEOUTS.ONE_MIN}).scrollIntoView().should('be.visible').within(() => {
            // * Verify disabled state
            cy.findByText('Enable').should('be.visible');
            cy.findByText('Remove').should('be.visible');
            cy.findByText('Settings').should('be.visible');
        });

        verifyStatus(demoPlugin.id, 'This plugin is not enabled.');

        cy.findByTestId(demoPlugin.id).scrollIntoView().should('be.visible').within(() => {
            // # Enable plugin
            cy.findByText('Enable').should('be.visible').click();

            // * Verify enabling state
            cy.findByText('Enabling...').should('be.visible');
            cy.findByText('This plugin is starting.').should('be.visible');
        });

        // * Verify enabled state
        verifyStatus(demoPlugin.id, 'This plugin is running.');

        cy.findByTestId(demoPlugin.id).scrollIntoView().should('be.visible').within(() => {
            // # Open the plugin settings page
            cy.findByText('Settings').should('be.visible').click();
        });

        // * Verify status is also shown on the plugin settings page
        cy.findByTestId('plugin-metadata-panel', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
        cy.findByText('Running').should('be.visible');

        // # Return to Plugin Management
        cy.visit('/admin_console/plugins/plugin_management');

        cy.findByTestId(demoPlugin.id).scrollIntoView().should('be.visible').within(() => {
            // # Disable plugin
            cy.findByText('Disable').should('be.visible').click();
            cy.findByText('This plugin is stopping.').should('be.visible');
        });

        // * Verify final disabled state
        verifyStatus(demoPlugin.id, 'This plugin is not enabled.');
        cy.findByTestId(demoPlugin.id).scrollIntoView().
            findByText('Enable').should('be.visible');
    });

    it('MM-T5714 Enable, disable and uninstall a plugin from its settings page', () => {
        cy.apiRemovePluginById(demoPlugin.id);
        cy.apiUploadPlugin(demoPlugin.filename);
        cy.apiEnablePluginById(demoPlugin.id);
        cy.visit(`/admin_console/plugins/plugin_${demoPlugin.id}`);

        // * Verify the enable toggle reflects the running state
        cy.findByTestId('plugin-metadata-panel', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
        cy.findByTestId(pluginEnableToggleTestId(demoPlugin.id)).
            should('have.attr', 'aria-pressed', 'true').
            and('have.attr', 'aria-label', 'Disable plugin');

        // # Disable the plugin from the settings page
        cy.findByTestId(pluginEnableToggleTestId(demoPlugin.id)).click();

        // * Verify it disables in place, without needing Save
        cy.findByTestId('plugin-metadata-status').should('contain.text', 'Not running');
        cy.findByTestId(pluginEnableToggleTestId(demoPlugin.id)).
            should('have.attr', 'aria-pressed', 'false').
            and('have.attr', 'aria-label', 'Enable plugin');

        // # Re-enable the plugin from the settings page
        cy.findByTestId(pluginEnableToggleTestId(demoPlugin.id)).click();
        cy.findByTestId('plugin-metadata-status').should('contain.text', 'Running');

        // # Uninstall the plugin from the settings page
        cy.get(`#plugin-actions-menu-button-${demoPlugin.id}`).click();
        cy.get(`#plugin-actions-uninstall-${demoPlugin.id}`).click();

        // * Verify the confirmation dialog
        cy.get('.modal-title').should('contain.text', 'Remove plugin?');
        cy.get('#confirmModalButton').click();

        // * Verify redirect back to Plugin Management and the plugin is gone
        cy.url().should('include', '/admin_console/plugins/plugin_management');
        cy.findByTestId(demoPlugin.id).should('not.exist');
    });

    it('MM-T5715 Blocks plugin actions on the settings page when there are unsaved changes', () => {
        cy.apiRemovePluginById(demoPlugin.id);
        cy.apiUploadPlugin(demoPlugin.filename);
        cy.apiEnablePluginById(demoPlugin.id);
        cy.visit(`/admin_console/plugins/plugin_${demoPlugin.id}`);

        // # Dirty a plugin setting without saving
        cy.findByTestId(pluginSettingInputTestId(demoPlugin.id, 'channelname'), {timeout: TIMEOUTS.ONE_MIN}).
            clear().
            type('a_new_channel_name');

        // # Attempt to disable the plugin while unsaved changes exist
        cy.findByTestId(pluginEnableToggleTestId(demoPlugin.id)).click();

        // * Verify the action is blocked with the expected warning, and the plugin stays enabled
        cy.findByText('Please save unsaved changes first').should('be.visible');
        cy.findByTestId(pluginEnableToggleTestId(demoPlugin.id)).should('have.attr', 'aria-pressed', 'true');

        // # Attempt to uninstall the plugin while unsaved changes exist
        cy.get(`#plugin-actions-menu-button-${demoPlugin.id}`).click();
        cy.get(`#plugin-actions-uninstall-${demoPlugin.id}`).click();

        // * Verify the action is still blocked: no confirmation dialog shown, plugin still installed
        cy.get('.modal-title').should('not.exist');
        cy.findByText('Please save unsaved changes first').should('be.visible');

        cy.apiRemovePluginById(demoPlugin.id);
    });
});

function verifyStatus(pluginId, message) {
    waitForAlertMessage(pluginId, message);
    cy.findByTestId(pluginId).scrollIntoView().
        findByText(message).should('be.visible');
}

function pluginEnableToggleTestId(pluginId) {
    return `PluginSettings.PluginStates.${pluginId.replace(/\./g, '+')}.Enable-button`;
}

function pluginSettingInputTestId(pluginId, settingKey) {
    return `PluginSettings.Plugins.${pluginId.replace(/\./g, '+')}.${settingKey}input`;
}

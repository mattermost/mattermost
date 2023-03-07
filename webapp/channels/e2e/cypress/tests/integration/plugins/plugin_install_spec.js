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

// Group: @system_console @plugin @not_cloud @timeout_error

import * as TIMEOUTS from '../../fixtures/timeouts';
import {demoPlugin} from '../../utils/plugins';

import {waitForAlertMessage} from './helpers';

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

        // # Upload plugin
        cy.get('#uploadPlugin').scrollIntoView().should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

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
            // # Disable plugin
            cy.findByText('Disable').should('be.visible').click();
            cy.findByText('This plugin is stopping.').should('be.visible');
        });

        // * Verify final disabled state
        verifyStatus(demoPlugin.id, 'This plugin is not enabled.');
        cy.findByTestId(demoPlugin.id).scrollIntoView().
            findByText('Enable').should('be.visible');
    });
});

function verifyStatus(pluginId, message) {
    waitForAlertMessage(pluginId, message);
    cy.findByTestId(pluginId).scrollIntoView().
        findByText(message).should('be.visible');
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

/**
 * Note: This spec requires "gitlabPlugin" file at fixtures folder.
 * See details at "e2e/cypress/tests/utils/plugins.js", download the file
 * from the given "@url" and save as indicated in the "@filename"
 * under fixtures folder.
 */

// Stage: @prod
// Group: @channels @system_console @plugin @not_cloud @timeout_error

import * as TIMEOUTS from '../../../fixtures/timeouts';
import {gitlabPlugin} from '../../../utils/plugins';

describe('If plugins fail to start, they can be disabled', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.shouldHavePluginUploadEnabled();
        cy.apiRemovePluginById(gitlabPlugin.id);

        // # Visit plugin management in the system console
        cy.visit('/admin_console/plugins/plugin_management');
        cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', 'Plugin Management');
    });

    it('MM-T2391 If plugins fail to start, they can be disabled', () => {
        const mimeType = 'application/gzip';
        cy.fixture(gitlabPlugin.filename, 'binary').
            then(Cypress.Blob.binaryStringToBlob).
            then((fileContent) => {
                cy.get('input[type=file]').attachFile({fileContent, fileName: gitlabPlugin.filename, mimeType});
            });

        cy.get('#uploadPlugin').scrollIntoView().should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // * Verify that the button shows correct text while uploading
        cy.findByText('Uploading...', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');

        // * Verify that the button shows correct text and is disabled after upload
        cy.findByText('Upload', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible');
        cy.get('#uploadPlugin').and('be.disabled');

        // # Enable GitLab plugin
        cy.findByTestId(gitlabPlugin.id).scrollIntoView().should('be.visible').within(() => {
            // * Verify GitLab Plugin title is shown
            cy.waitUntil(() => cy.get('strong').scrollIntoView().should('be.visible').then((title) => {
                return title[0].innerText === 'GitLab';
            }));

            // # Click on Enable link
            cy.findByText('Enable').click();
            cy.findByText('This plugin failed to start. must have a GitLab oauth client id').should('be.visible');

            cy.findByText('Disable').click();
            cy.findByText('This plugin is not enabled.').should('be.visible');
        });
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @system_console @authentication @not_cloud

import * as TIMEOUTS from '../../fixtures/timeouts';

describe('Authentication', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
    });

    beforeEach(() => {
        // # Log in as admin.
        cy.apiAdminLogin();
    });

    it('MM-T1762 - Invite Salt', () => {
        cy.visit('/admin_console/site_config/public_links');

        // * Check that public link salt is masked
        cy.findByText('********************************').should('be.visible');

        // # Click "Regenerate"
        cy.findByText('Regenerate', {timeout: TIMEOUTS.ONE_MIN}).click();

        // * Check that new public link is generated and unmasked
        cy.findByText('********************************').should('not.exist');
    });

    it('MM-T1775 - Maximum Login Attempts field resets to default after saving invalid value', () => {
        cy.visit('/admin_console/authentication/password');

        cy.findByPlaceholderText('E.g.: "10"', {timeout: TIMEOUTS.ONE_MIN}).clear().type('ten');

        cy.uiSave();

        // * Ensure error appears when saving a password outside of the limits
        cy.findByPlaceholderText('E.g.: "10"').invoke('val').should('equal', '10');

        // * Verify that the config remain the same
        cy.apiGetConfig().then(({config}) => {
            expect(config.ServiceSettings.MaximumLoginAttempts).to.equal(10);
        });
    });

    it('MM-T1776 - Maximum Login Attempts field successfully saves valid change', () => {
        cy.visit('/admin_console/authentication/password');

        cy.findByPlaceholderText('E.g.: "10"', {timeout: TIMEOUTS.ONE_MIN}).clear().type('2');

        cy.uiSaveConfig();

        // * Ensure error appears when saving a password outside of the limits
        cy.findByPlaceholderText('E.g.: "10"').invoke('val').should('equal', '2');

        // * Verify that the config have changed
        cy.apiGetConfig().then(({config}) => {
            expect(config.ServiceSettings.MaximumLoginAttempts).to.equal(2);
        });
    });
});

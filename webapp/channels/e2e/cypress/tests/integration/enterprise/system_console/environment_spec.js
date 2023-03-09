// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @enterprise @not_cloud

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Environment', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiInitSetup();
    });

    it('MM-T994 - Fields editable when enabled, but not saveable until validated', () => {
        // * Check if server has license for Elasticsearch
        cy.apiRequireLicenseForFeature('Elasticsearch');

        cy.visit('/admin_console/environment/elasticsearch');

        // * Verify the ElasticSearch fields are disabled
        cy.findByTestId('connectionUrlinput').should('be.disabled');
        cy.findByTestId('skipTLSVerificationfalse').should('be.disabled');
        cy.findByTestId('usernameinput').should('be.disabled');
        cy.findByTestId('passwordinput').should('be.disabled');
        cy.findByTestId('snifftrue').should('be.disabled');
        cy.findByTestId('snifffalse').should('be.disabled');
        cy.findByTestId('enableSearchingtrue').should('be.disabled');
        cy.findByTestId('enableSearchingfalse').should('be.disabled');
        cy.findByTestId('enableAutocompletetrue').should('be.disabled');
        cy.findByTestId('enableAutocompletefalse').should('be.disabled');

        cy.visit('/admin_console/environment/elasticsearch');

        // # Enable Elasticsearch
        cy.findByTestId('enableIndexingtrue').check();

        // * Verify the ElasticSearch fields are enabled
        cy.findByTestId('connectionUrlinput').should('not.be.disabled');
        cy.findByTestId('skipTLSVerificationfalse').should('not.be.disabled');
        cy.findByTestId('usernameinput').should('not.be.disabled');
        cy.findByTestId('passwordinput').should('not.be.disabled');
        cy.findByTestId('snifftrue').should('not.be.disabled');
        cy.findByTestId('snifffalse').should('not.be.disabled');

        cy.get('.sidebar-section').first().click();

        // * Verify the behavior when Yes, Discard button in the confirmation message is clicked
        cy.get('#confirmModalButton').should('be.visible').and('have.text', 'Yes, Discard').click().wait(TIMEOUTS.HALF_SEC);
        cy.get('.confirmModal').should('not.exist');
    });
});

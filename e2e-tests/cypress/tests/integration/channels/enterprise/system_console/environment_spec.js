// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @not_cloud

import * as TIMEOUTS from '@/fixtures/timeouts';

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
        cy.get('[data-testid="admin.setting:connectionUrl--group"] [data-testid="admin.setting.value--textbox"]').should('be.disabled');
        cy.get('[data-testid="admin.setting:skipTLSVerification--group"] [data-testid="admin.setting.false--radio"]').should('be.disabled');
        cy.get('[data-testid="admin.setting:username--group"] [data-testid="admin.setting.value--textbox"]').should('be.disabled');
        cy.get('[data-testid="admin.setting:password--group"] [data-testid="admin.setting.value--textbox"]').should('be.disabled');
        cy.get('[data-testid="admin.setting:sniff--group"] [data-testid="admin.setting.true--radio"]').should('be.disabled');
        cy.get('[data-testid="admin.setting:sniff--group"] [data-testid="admin.setting.false--radio"]').should('be.disabled');
        cy.get('[data-testid="admin.setting:enableSearching--group"] [data-testid="admin.setting.true--radio"]').should('be.disabled');
        cy.get('[data-testid="admin.setting:enableSearching--group"] [data-testid="admin.setting.false--radio"]').should('be.disabled');
        cy.get('[data-testid="admin.setting:enableAutocomplete--group"] [data-testid="admin.setting.true--radio"]').should('be.disabled');
        cy.get('[data-testid="admin.setting:enableAutocomplete--group"] [data-testid="admin.setting.false--radio"]').should('be.disabled');

        cy.visit('/admin_console/environment/elasticsearch');

        // # Enable Elasticsearch
        cy.get('[data-testid="admin.setting:enableIndexing--group"] [data-testid="admin.setting.true--radio"]').check();

        // * Verify the ElasticSearch fields are enabled
        cy.get('[data-testid="admin.setting:connectionUrl--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:skipTLSVerification--group"] [data-testid="admin.setting.false--radio"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:username--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:password--group"] [data-testid="admin.setting.value--textbox"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:sniff--group"] [data-testid="admin.setting.true--radio"]').should('not.be.disabled');
        cy.get('[data-testid="admin.setting:sniff--group"] [data-testid="admin.setting.false--radio"]').should('not.be.disabled');

        cy.get('.sidebar-section').first().click();

        // * Verify the behavior when Yes, Discard button in the confirmation message is clicked
        cy.get('#confirmModalButton').should('be.visible').and('have.text', 'Yes, Discard').click().wait(TIMEOUTS.HALF_SEC);
        cy.get('.confirmModal').should('not.exist');
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @elasticsearch @autocomplete @not_cloud

import * as TIMEOUTS from '../../../../fixtures/timeouts';

describe('Elasticsearch system console', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();

        // # Check if server has license for Elasticsearch
        cy.apiRequireLicenseForFeature('Elasticsearch');

        // # Enable Elasticsearch
        cy.apiUpdateConfig({
            ElasticsearchSettings: {
                EnableAutocomplete: true,
                EnableIndexing: true,
                EnableSearching: true,
                Sniff: false,
            },
        });

        // # Visit the Elasticsearch settings page
        cy.visit('/admin_console/environment/elasticsearch');

        // * Verify that we can connect to Elasticsearch
        cy.get('#testConfig').find('button').click();
        cy.get('.alert-success').should('have.text', 'Test successful. Configuration saved.');
    });

    it('MM-T2519 can purge indexes', () => {
        cy.get('#purgeIndexesSection').within(() => {
            // # Click Purge Indexes button
            cy.contains('button', 'Purge Indexes').click();

            // * We should see a message saying we are successful
            cy.get('.alert-success').should('have.text', 'Indexes purged successfully.');
        });
    });

    it('MM-T2520 Can perform a bulk index', () => {
        // # Click the Index Now button to start the index
        cy.contains('button', 'Index Now').click();

        // # Small wait to ensure new row is added
        cy.wait(TIMEOUTS.HALF_SEC);

        // # Get the first row
        cy.get('.job-table__table').
            find('tbody > tr').
            eq(0).
            as('firstRow');

        // * First row update to say Success
        cy.waitUntil(() => {
            return cy.get('@firstRow').then((el) => {
                return el.find('.status-icon-success').length > 0;
            });
        }
        , {
            timeout: TIMEOUTS.FIVE_MIN,
            interval: TIMEOUTS.TWO_SEC,
            errorMsg: 'Reindex did not succeed in time',
        });

        cy.get('@firstRow').
            find('.status-icon-success').
            should('be.visible').
            and('have.text', 'Success');
    });

    it('MM-T2521 Elasticsearch for autocomplete queries can be disabled', () => {
        //  Check the false checkbox for enable autocomplete
        cy.get('#enableAutocompletefalse').check().should('be.checked');

        // # Save the settings
        cy.get('#saveSetting').click().wait(TIMEOUTS.TWO_SEC);

        // * Get config from API and verify that EnableAutocomplete setting is false
        cy.apiGetConfig().then(({config}) => {
            expect(config.ElasticsearchSettings.EnableAutocomplete).to.be.false;
        });
    });
});

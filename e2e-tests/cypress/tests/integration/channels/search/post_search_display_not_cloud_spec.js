// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @search @not_cloud

import * as TIMEOUTS from '@/fixtures/timeouts';

describe('Search', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();

        cy.apiUpdateConfig({
            ServiceSettings: {
                EnableTesting: true,
            },
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T2286 - Clicking a hashtag from a message opens messages with that hashtag on RHS', () => {
        const testSearch = '/test url test-search';

        // # Post message
        cy.postMessage(testSearch);

        // # Expand the test-search message
        cy.get('#showMoreButton').click().wait(TIMEOUTS.HALF_SEC);

        // # Click the #hello on the test-search message
        cy.get('[data-hashtag="#hello"]').first().click().wait(TIMEOUTS.HALF_SEC);

        // # RHS should be visible with search results
        cy.get('#search-items-container').should('be.visible');

        // * Assert search results are present and correct
        cy.get('[data-testid="search-item-container"]').should('be.visible').should('contain.text', '#hello');
    });
});

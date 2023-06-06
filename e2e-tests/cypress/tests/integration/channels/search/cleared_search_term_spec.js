// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @search

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Search', () => {
    const term = 'London';

    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
            cy.postMessage(term);
            cy.uiWaitUntilMessagePostedIncludes(term);
        });
    });

    it('MM-T352 - Cleared search term should not reappear as RHS is opened and closed', () => {
        // # Place the focus on the search box and search for something
        cy.uiGetSearchContainer().should('be.visible').click();
        cy.uiGetSearchBox().
            type(`${term}{enter}`).
            wait(TIMEOUTS.ONE_SEC).
            clear();
        cy.get('#searchbar-help-popup').should('be.visible');
        cy.uiGetSearchContainer().type('{esc}');

        // # Verify the Search side bar opens up
        cy.uiGetRHS().should('contain', 'Search Results');

        // # Close the search sidebar
        // * Verify it is closed
        cy.uiCloseRHS();
        cy.uiGetRHS({visible: false});

        // # Verify that the cleared search text does not appear on the search box
        cy.uiGetSearchBox().should('be.empty');

        // # Click the pin icon to open the pinned posts RHS
        cy.uiGetChannelPinButton().click();
        cy.uiGetRHS().should('contain', 'Pinned Posts');

        // # Verify that the Search term input box is still cleared and search term does not reappear when RHS opens
        cy.uiGetSearchBox().and('be.empty');
    });
});

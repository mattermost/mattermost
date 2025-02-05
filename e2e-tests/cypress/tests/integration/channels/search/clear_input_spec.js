// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @search

import * as TIMEOUTS from '../../../fixtures/timeouts';
import * as MESSAGES from '../../../fixtures/messages';

describe('Search', () => {
    before(() => {
        // # Login as test user and visit off-topic
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            cy.visit(offTopicUrl);
        });
    });

    it('QuickInput clear X', () => {
        // * X should not be visible on empty input
        cy.uiGetSearchContainer().find('.input-clear-x').should('not.exist');
        cy.uiGetSearchContainer().click();

        // # Write something on the input
        cy.uiGetSearchBox().first().clear().wait(TIMEOUTS.HALF_SEC).type('abc').wait(TIMEOUTS.HALF_SEC).type('{enter}');

        cy.uiGetSearchContainer().click();

        // * The input should contain what we wrote
        cy.uiGetSearchBox().should('have.value', 'abc');
        cy.get('#searchBox .icon-close').click();

        // * The X should be visible
        // # Then click X to clear the input field
        cy.uiGetSearchContainer().
            find('.input-clear-x').
            should('be.visible').
            click({force: true});

        // * The X should not be visible since the input is cleared
        cy.uiGetSearchContainer().find('.input-clear-x').should('not.exist');

        // * The value of the input is empty
        cy.uiGetSearchContainer().click();
        cy.uiGetSearchBox().should('have.value', '');
    });

    it('MM-T368 - Text in search box should not clear when Pinned or Saved posts icon is clicked', () => {
        const searchText = MESSAGES.SMALL;

        // * Verify search input field exists and not search button, as inputs contains placeholder not buttons/icons
        // and then type in a search text
        cy.uiGetSearchContainer().click();
        cy.uiGetSearchBox().first().clear().wait(TIMEOUTS.HALF_SEC).type(searchText + '{enter}').wait(TIMEOUTS.HALF_SEC);

        // # Now click on the saved post button from the header
        cy.uiGetSavedPostButton().click();

        // * Verify the pinned post RHS is open
        cy.uiGetRHS().should('contain', 'Saved messages');
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @search

import * as TIMEOUTS from '@/fixtures/timeouts';

describe('Search', () => {
    let testTeam;

    before(() => {
        // Initialize a user.
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();

        // Visit town square as an admin
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T1450 - Autocomplete behaviour', () => {
        // # Post message in town-square
        cy.postMessage('hello');

        // # Click on searchbox
        cy.uiGetSearchContainer().should('be.visible').click();

        // * Check the contents in search options
        assertSearchHintFilesOrMessages();

        // # Search for search term in:
        cy.uiGetSearchBox().type('in:');

        // # Select option from suggestion list
        cy.get('.suggestion-list__item').first().click({force: true});

        // * Assert suggestions are not present after selecting item
        cy.get('.suggestion-list__item').should('not.exist');

        // # Clear search box
        cy.get('.input-clear-x').first().click({force: true}).wait(TIMEOUTS.HALF_SEC);

        // # Search for search term in:town-square{space}
        cy.uiGetSearchBox().type('in:town-square ').wait(TIMEOUTS.HALF_SEC);

        // * Check the hint contents are now visible
        assertSearchHint();

        // # Clear search box
        cy.uiGetSearchBox().get('.input-clear-x').click({force: true}).wait(TIMEOUTS.HALF_SEC);

        // # Search for search term in:town-square{enter}
        cy.uiGetSearchBox().type('in:town-square').wait(TIMEOUTS.HALF_SEC);

        // * Assert that channel name displays appropriately
        cy.get('.suggestion-list__item').first().should('contain.text', 'Town Square~town-square');

        // # Press enter to register search term
        cy.uiGetSearchBox().type('{enter}');

        // * Check the hint contents are now visible
        assertSearchHint();

        // * Assert that searchBox now includes a trailing space
        cy.uiGetSearchBox().should('have.value', 'in:town-square ');

        // # Perform the search
        cy.uiGetSearchBox().type('{enter}').wait(TIMEOUTS.HALF_SEC);

        // * Assert autocomplete list is gone
        cy.get('.suggestion-list__item').should('not.exist');
    });

    it('MM-T2291 - Wildcard Search', () => {
        const testMessage = 'Hello World!!!';

        // # Post message
        cy.postMessage(testMessage);

        cy.uiGetSearchContainer().click();

        // # Search for `Hell*`
        cy.uiGetSearchBox().type('Hell*{enter}').wait(TIMEOUTS.HALF_SEC);

        // # RHS should be visible with search results
        cy.get('#search-items-container').should('be.visible');

        // * Assert search results are present and correct
        cy.get('[data-testid="search-item-container"]').should('be.visible');
        cy.get('.search-highlight').first().should('contain.text', 'Hell');
    });
});

const assertSearchHintFilesOrMessages = () => {
    cy.get('#searchHints').should('be.visible');
};

const assertSearchHint = () => {
    cy.get('#searchHints').should('be.visible');
};

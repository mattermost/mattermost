// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @autocomplete @search

describe('Autocomplete in the search box - scrolling', () => {
    const usersCount = 15;
    const timestamp = Date.now();

    before(() => {
        // # Create new team for tests
        cy.apiCreateTeam(`search-${timestamp}`, `search-${timestamp}`).then(({team}) => {
            // # Create pool of users for tests
            for (let i = 0; i < usersCount; i++) {
                cy.apiCreateUser().then(({user}) => {
                    cy.apiAddUserToTeam(team.id, user.id);
                });
            }
            cy.visit(`/${team.name}/channels/off-topic`);

            // # Post a new message to ensure page fully rendered before acting into the searchBox
            cy.postMessage('hello');
        });
    });

    it('MM-T4084 correctly scrolls when the user navigates through options with the keyboard', () => {
        // # Type into the searchBox to show list of users
        cy.get('#searchBox').type('from:');

        cy.get('#search-autocomplete__popover .suggestion-list__item').first().as('firstItem');
        cy.get('#search-autocomplete__popover .suggestion-list__item').last().as('lastItem');

        // * Check that list is scrolled to top
        cy.get('@firstItem').should('be.visible');
        cy.get('@lastItem').should('not.be.visible');

        // # Move to bottom of the list using keyboard
        cy.get('body').type('{downarrow}'.repeat(usersCount));

        // * Check that list is scrolled to bottom
        cy.get('@firstItem').should('not.be.visible');
        cy.get('@lastItem').should('be.visible');

        // # Move to top of the list using keyboard
        cy.get('body').type('{uparrow}'.repeat(usersCount));

        // * Check that list is scrolled to top
        cy.get('@firstItem').should('be.visible');
        cy.get('@lastItem').should('not.be.visible');
    });
});

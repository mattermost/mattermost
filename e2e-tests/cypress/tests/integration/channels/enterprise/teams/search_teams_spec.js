// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console

import {v4 as uuidv4} from 'uuid';
const PAGE_SIZE = 10;

describe('Search teams', () => {
    before(() => {
        // * Check if server has license
        cy.apiRequireLicense();
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.visit('/admin_console/user_management/teams');
    });

    it('loads with no search text', () => {
        // * Check the search input is empty.
        cy.findByPlaceholderText('Search').should('be.visible').and('have.text', '');
    });

    it('returns results', () => {
        const displayName = uuidv4();

        // # Create a new team.
        cy.apiCreateTeam('team-search', displayName);

        // # Search for the new team.
        cy.findByPlaceholderText('Search').type(displayName + '{enter}');

        // * Check that the search results contain the team.
        cy.findAllByTestId('team-display-name').contains(displayName);
    });

    it('results are paginated', () => {
        const displayName = uuidv4();

        // # Create enough new teams with common name prefixes to get multiple pages of search results.
        Cypress._.times(PAGE_SIZE + 2, (i) => {
            cy.apiCreateTeam('team-search-paged-' + i, displayName + ' ' + i);
        });

        // # Search using the common team name prefix.
        cy.findByPlaceholderText('Search').type(displayName + '{enter}');

        // * Check that the first page of results is full.
        cy.findAllByTestId('team-display-name').should('have.length', PAGE_SIZE);

        // # Click the next pagination arrow.
        cy.findByTitle('Next Icon').parent().should('be.enabled').click();

        // * Check that the 2nd page of results has the expected amount.
        cy.findAllByTestId('team-display-name').should('have.length', 2);
    });

    it('clears the results when "x" is clicked', () => {
        const displayName = uuidv4();

        // # Create a new team.
        cy.apiCreateTeam('team-search', displayName);

        // # Search for the team.
        cy.findByPlaceholderText('Search').as('searchInput').type(displayName + '{enter}');

        // * Check that the list of teams is in search results mode.
        cy.findAllByTestId('team-display-name').should('have.length', 1);

        // # Click the x in the search input.
        cy.findByTestId('clear-search').click();

        // * Check that the search input text is cleared.
        cy.get('@searchInput').should('be.visible').and('have.text', '');

        // * Check that the search results are reset to the default page-load list.
        cy.findAllByTestId('team-display-name').should('have.length', PAGE_SIZE);
    });

    it('clears the results when the search term is deleted with backspace', () => {
        const displayName = uuidv4();

        // # Create a team.
        cy.apiCreateTeam('team-search', displayName);

        // # Search for the team.
        cy.findByPlaceholderText('Search').as('searchInput').type(displayName + '{enter}');

        // * Check that the list of teams is in search results mode.
        cy.findAllByTestId('team-display-name').should('have.length', 1);

        // # Clear the search input by deleting the search text.
        cy.get('@searchInput').type('{selectall}{del}');

        // * Check that the search results are reset to the default page-load list.
        cy.findAllByTestId('team-display-name').should('have.length', PAGE_SIZE);
    });
});

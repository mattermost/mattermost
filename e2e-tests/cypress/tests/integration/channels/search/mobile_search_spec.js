// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @search

function openSidebarMenu() {
    // # Open the sidebar menu
    cy.get('button.menu-toggle').click();

    // * Verify the sidebar menu is open
    cy.get('#sidebar-menu').should('be.visible');
}

function verifyLoadingSpinnerIsGone() {
    // * Verify that the RHS is open
    cy.get('#sidebar-right').should('be.visible');

    // * Verify that the loading spinner is eventually gone
    cy.get('#loadingSpinner').should('not.exist');
}

describe('Mobile Search', () => {
    let townsquareLink;

    before(() => {
        // # Login as test user
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            townsquareLink = `/${team.name}/channels/town-square`;
        });
    });

    beforeEach(() => {
        // # Resize window to mobile view
        cy.viewport('iphone-6');

        // # Visit town-square
        cy.visit(townsquareLink);
    });

    it('Opening the Recent Mentions eventually loads the results', () => {
        // # Open the sidebar menu
        openSidebarMenu();

        // # Click the Recent Mentions button
        cy.get('#recentMentions').click();

        // * Verify that the loading spinner is eventually gone
        verifyLoadingSpinnerIsGone();
    });

    it('Opening the Saved Posts eventually loads the results', () => {
        // # Open the sidebar menu
        openSidebarMenu();

        // # Click the Saved Posts button
        cy.get('#flaggedPosts').click();

        // * Verify that the loading spinner is eventually gone
        verifyLoadingSpinnerIsGone();
    });

    it('Searching eventually loads the results', () => {
        // * Open the search box
        cy.get('button.navbar-search').click();

        // * Verify that the search box is open
        cy.get('#sbrSearchBox').should('be.visible');

        // # Type any string and hit Enter
        cy.get('#sbrSearchBox').type('test').type('{enter}');

        // * Verify that the loading spinner is eventually gone
        verifyLoadingSpinnerIsGone();
    });
});

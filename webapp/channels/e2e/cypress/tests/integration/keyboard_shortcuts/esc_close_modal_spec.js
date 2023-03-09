// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @keyboard_shortcuts

describe('Keyboard Shortcuts', () => {
    let channelUrl;

    before(() => {
        cy.apiInitSetup({loginAfter: true}).then(({offTopicUrl}) => {
            channelUrl = offTopicUrl;
            cy.visit(channelUrl);
        });
    });

    it('MM-T1244 CTRL/CMD+K - Esc closes modal', () => {
        const searchTerm = 'test' + Date.now();

        // # Open Channel switcher modal by click on the button
        cy.findByRole('button', {name: 'Find Channels'}).click();

        // # Type in the quick switch input box
        cy.get('#quickSwitchInput').typeWithForce(searchTerm);

        // * Verify that the no search result test is displayed
        cy.get('.no-results__title').should('be.visible').and('have.text', 'No results for "' + searchTerm + '"');

        // # Press escape key
        cy.get('#quickSwitchInput').typeWithForce('{esc}');

        // * Verify that the modal is closed
        cy.get('.modal-content').should('not.exist');

        // * Verify that the user does not leave the off-topic channel
        cy.url().should('contain', channelUrl);
    });
});

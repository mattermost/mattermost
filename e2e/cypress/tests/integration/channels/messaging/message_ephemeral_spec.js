// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @messaging

describe('Hide ephemeral message on refresh', () => {
    let offtopiclink;

    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({team}) => {
            offtopiclink = `/${team.name}/channels/off-topic`;
            cy.visit(offtopiclink);
        });
    });

    it('MM-T2197 Ephemeral message disappears in center after refresh', () => {
        // # Got to a test channel on the side bar
        cy.get('#sidebarItem_off-topic').click({force: true});

        // * Validate if the channel has been opened
        cy.url().should('include', offtopiclink);

        // # Set initial status to online
        cy.apiUpdateUserStatus('online');

        // # Cause an ephemeral message to appear
        cy.postMessage('/offline ');

        // # Get last post ID
        cy.getLastPostId().then((postID) => {
            // * Assert message presence
            cy.get(`#postMessageText_${postID}`).should('have.text', 'You are now offline');

            // # Refresh the page
            cy.reload();
            cy.visit(offtopiclink);

            // * Assert message disappearing
            cy.get(`#postMessageText_${postID}`).should('not.exist');
        });
    });
});

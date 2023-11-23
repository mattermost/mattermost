// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @dm_category

describe('DM on sidebar', () => {
    let testUser;
    let otherUser;

    before(() => {
        cy.apiCreateUser().then(({user}) => {
            otherUser = user;
        });

        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true}).then(({user, townSquareUrl}) => {
            testUser = user;

            cy.visit(townSquareUrl);
        });
    });

    it('MM-T3832 DMs/GMs should not be removed from the sidebar when only viewed (no message)', () => {
        // # Create DM with other user
        cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(({channel}) => {
            // # Post a message as the new user
            cy.postMessageAs({
                sender: otherUser,
                message: `Hey ${testUser.username}`,
                channelId: channel.id,
            });

            // # Click on the new DM channel to mark it read
            cy.get(`#sidebarItem_${channel.name}`).should('be.visible').click();

            // # Click on Town Square
            cy.get('.SidebarLink:contains(Town Square)').should('be.visible').click();

            // * Verify we're on Town Square
            cy.url().should('contain', 'town-square');

            // # Refresh the page
            cy.visit('/');

            // * Verify that the DM we just read remains in the sidebar
            cy.get(`#sidebarItem_${channel.name}`).should('be.visible');
        });
    });
});

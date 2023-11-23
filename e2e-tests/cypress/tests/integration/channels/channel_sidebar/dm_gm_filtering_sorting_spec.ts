// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @dm_category

import * as MESSAGES from '../../../fixtures/messages';

describe('DM/GM filtering and sorting', () => {
    let testUser;

    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({user, townSquareUrl}) => {
            testUser = user;
            cy.visit(townSquareUrl);
        });
    });

    it('MM-T2003 Number of direct messages to show', () => {
        const receivingUser = testUser;

        cy.intercept('**/api/v4/users/status/ids**').as('userStatus');

        // * Verify that we can see the sidebar
        cy.uiGetLHSHeader();

        // # Collapse the DM category (so that we can check all unread DMs quickly without the sidebar scrolling being an issue)
        cy.get('button.SidebarChannelGroupHeader_groupButton:contains(DIRECT MESSAGES)').should('be.visible').click();

        // # Create 41 DMs (ie. one over the max displayable read limit)
        for (let i = 0; i < 41; i++) {
            // # Create a new user to have a DM with
            cy.apiCreateUser().then(({user}) => {
                cy.apiCreateDirectChannel([receivingUser.id, user.id]).then(({channel}) => {
                    // # Post a message as the new user
                    cy.postMessageAs({
                        sender: user,
                        message: MESSAGES.TINY,
                        channelId: channel.id,
                    });

                    cy.wait('@userStatus');

                    // * Verify that the DM count is now correct
                    cy.get('.SidebarChannelGroup:contains(DIRECT MESSAGES) a[id^="sidebarItem"]').should('be.visible').should('have.length', Math.min(i + 1, 2));

                    // # Click on the new DM channel to mark it read
                    cy.get(`#sidebarItem_${channel.name}`).should('be.visible').click();
                });
            });
        }

        // # Expand the DM category (so that we can check all unread DMs quickly without the sidebar scrolling being an issue)
        cy.get('button.SidebarChannelGroupHeader_groupButton:contains(DIRECT MESSAGES)').should('be.visible').click();

        // * Verify that there are 40 DMs shown in the sidebar
        cy.get('.SidebarChannelGroup:contains(DIRECT MESSAGES) a[id^="sidebarItem"]').should('have.length', 40);

        // # Go to Sidebar Settings
        cy.uiOpenSettingsModal('Sidebar');

        // * Verify that the default setting for DMs shown is 40
        cy.get('#limitVisibleGMsDMsDesc').should('be.visible').should('contain', '40');

        // # Click Edit
        cy.get('#limitVisibleGMsDMsEdit').should('be.visible').click();

        // # Change the value to All Direct Messages
        cy.get('#limitVisibleGMsDMs').should('be.visible').click();
        cy.get('.react-select__option:contains(All Direct Messages)').should('be.visible').click();

        // # Save and close Settings
        cy.uiSaveAndClose();

        // * Verify that there are 41 DMs shown in the sidebar
        cy.get('.SidebarChannelGroup:contains(DIRECT MESSAGES) a[id^="sidebarItem"]').should('have.length', 41);

        // # Go to Sidebar Settings
        cy.uiOpenSettingsModal('Sidebar');

        // # Click Edit
        cy.get('#limitVisibleGMsDMsEdit').should('be.visible').click();

        // # Change the value to 10
        cy.get('#limitVisibleGMsDMs').should('be.visible').click();
        cy.get('.react-select__option:contains(10)').should('be.visible').click();

        // # Save and close Settings
        cy.uiSaveAndClose();

        // * Verify that there are 10 DMs shown in the sidebar
        cy.get('.SidebarChannelGroup:contains(DIRECT MESSAGES) a[id^="sidebarItem"]').should('have.length', 10);
    });
});

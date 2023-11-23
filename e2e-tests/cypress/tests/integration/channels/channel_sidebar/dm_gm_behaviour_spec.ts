// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @dm_category

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('DM category', () => {
    let testUser;

    before(() => {
        // # Login as test user and visit town-square
        cy.apiInitSetup({loginAfter: true, promoteNewUserAsAdmin: true}).then(({team, user}) => {
            testUser = user;
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    it('MM-T2016_1 Opening a new DM should make sure the DM appears in the sidebar', () => {
        // # Create a new user to start a DM with
        cy.apiCreateUser().then(({user}) => {
            // * Verify that we can see the sidebar
            cy.uiGetLHSHeader();

            // # Click the + button next to the DM category
            clickOnNewDMButton();

            // # Search for the new user's username
            cy.get('#selectItems input').
                typeWithForce(user.username).
                wait(TIMEOUTS.HALF_SEC);

            // # Select the user you searched for
            cy.get(`#displayedUserName${user.username}`).click().wait(TIMEOUTS.HALF_SEC);

            // # Click Go
            cy.findByTestId('saveSetting').should('be.visible').click();

            // * Verify that a DM channel shows up in the sidebar
            cy.get(`.SidebarLink:contains(${user.username})`).should('be.visible');
        });
    });

    it('MM-T2016_2 Opening a new DM with a bot should make sure the DM appears in the sidebar, and the bot icon should be present', () => {
        // # Create a new user to start a DM with
        cy.apiCreateBot().then(({bot}) => {
            // * Verify that we can see the sidebar
            cy.uiGetLHSHeader();

            // * Verify that a DM channel shows up in the sidebar
            cy.get(`.SidebarLink:contains(${bot.username})`).should('be.visible');

            // * Verify bot icon appears
            cy.get(`.SidebarLink:contains(${bot.username})`).find('.Avatar').should('exist').
                and('have.attr', 'src').
                then((avatar) => cy.request({url: avatar.attr('src'), encoding: 'binary'})).
                should(({body}) => {
                    // * Verify it matches default bot avatar
                    cy.fixture('bot-default-avatar.png', 'binary').should('deep.equal', body);
                });
        });
    });

    it('MM-T2016_3 Receiving a DM from a user should show the DM in the sidebar', () => {
        // # Create a new user to start a DM with
        cy.apiCreateUser().then(({user}) => {
            cy.apiCreateDirectChannel([testUser.id, user.id]).then(({channel}) => {
                // * Verify that we can see the sidebar
                cy.uiGetLHSHeader();

                // # Post a message as the new user
                cy.postMessageAs({
                    sender: user,
                    message: `Hey ${testUser.username}`,
                    channelId: channel.id,
                });

                // * Verify that a DM channel shows up in the sidebar
                cy.get(`.SidebarLink:contains(${user.username})`).should('be.visible').click();

                // # Close the new DM
                cy.uiOpenChannelMenu('Close Direct Message');

                // * Verify that the DM channel disappears
                cy.get(`.SidebarLink:contains(${user.username})`).should('not.exist');

                // # Post a message as the new user again
                cy.postMessageAs({
                    sender: user,
                    message: `Hello ${testUser.username}`,
                    channelId: channel.id,
                });

                // * Verify that the DM channel re-appears in the sidebar
                cy.get(`.SidebarLink:contains(${user.username})`).should('be.visible');
            });
        });
    });

    it('MM-T2017_1 Opening a new GM should make sure the GM appears in the sidebar', () => {
        // # Create 2 new users to start a GM with
        cy.apiCreateUser().then(({user}) => {
            cy.apiCreateUser().then(({user: user2}) => {
                // * Verify that we can see the sidebar
                cy.uiGetLHSHeader();

                // # Click the + button next to the DM category
                clickOnNewDMButton();

                // # Search for the new user's username
                cy.get('#selectItems input').
                    typeWithForce(user.username).
                    wait(TIMEOUTS.HALF_SEC);

                // # Select the user you searched for
                cy.get(`#displayedUserName${user.username}`).click().wait(TIMEOUTS.HALF_SEC);

                // # Search for the 2nd user's username
                cy.get('#selectItems input').
                    typeWithForce(user2.username).
                    wait(TIMEOUTS.HALF_SEC);

                // # Select the user you searched for
                cy.get(`#displayedUserName${user2.username}`).click().wait(TIMEOUTS.HALF_SEC);

                // # Click Go
                cy.findByTestId('saveSetting').should('be.visible').click();

                // * Verify that a GM channel shows up in the sidebar
                cy.get(`.SidebarLink:contains(${user.username})`).should('contain', user2.username).should('be.visible');
            });
        });
    });

    it('MM-T2017_2 Receiving a DM from a user should show the DM in the sidebar', () => {
        // # Create 2 new users to start a GM with
        cy.apiCreateUser().then(({user}) => {
            cy.apiCreateUser().then(({user: user2}) => {
                cy.apiCreateGroupChannel([testUser.id, user.id, user2.id]).then(({channel}) => {
                    // * Verify that we can see the sidebar
                    cy.uiGetLHSHeader();

                    // # Post a message as the new user
                    cy.postMessageAs({
                        sender: user,
                        message: `Hey ${testUser.username}`,
                        channelId: channel.id,
                    });

                    // * Verify that a GM channel shows up in the sidebar
                    cy.get(`#sidebarItem_${channel.name}`).should('be.visible').click();

                    // # Close the new GM
                    cy.uiOpenChannelMenu('Close Group Message');

                    // * Verify that the GM channel disappears
                    cy.get(`.SidebarLink:contains(${user.username})`).should('not.exist');

                    // # Post a message as the new user again
                    cy.postMessageAs({
                        sender: user,
                        message: `Hello ${testUser.username}`,
                        channelId: channel.id,
                    });

                    // * Verify that the DM channel re-appears in the sidebar
                    cy.get(`#sidebarItem_${channel.name}`).should('be.visible');
                });
            });
        });
    });

    it('MM-T2017_3 Should not double already open GMs in a custom category', () => {
        // # Create 2 new users to start a GM with
        cy.apiCreateUser().then(({user}) => {
            cy.apiCreateUser().then(({user: user2}) => {
                cy.apiCreateGroupChannel([testUser.id, user.id, user2.id]).then(({channel}) => {
                    // * Verify that we can see the sidebar
                    cy.uiGetLHSHeader();

                    // # Post a message as the new user
                    cy.postMessageAs({
                        sender: user,
                        message: `Hey ${testUser.username}`,
                        channelId: channel.id,
                    });

                    // * Verify that a GM channel shows up in the sidebar
                    cy.get(`#sidebarItem_${channel.name}`).should('be.visible').click();

                    // # Move the GM to a custom category and enter new category name and Save
                    cy.uiMoveChannelToCategory(channel.name, `Category ${user.username}`, true, true);

                    // * Verify that the GM has moved to a new category
                    cy.get(`.SidebarChannelGroup:contains(Category ${user.username})`).find(`#sidebarItem_${channel.name}`).should('be.visible');

                    // # Go to Town Square
                    cy.get('#sidebarItem_town-square').should('be.visible').click();

                    // * Verify we are now in town square
                    cy.url().should('include', '/channels/town-square');

                    // # Click the + button next to the DM category
                    clickOnNewDMButton();

                    // # Search for the new user's username
                    cy.get('#selectItems input').
                        typeWithForce(user.username).
                        wait(TIMEOUTS.HALF_SEC);

                    // # Select the user you searched for
                    cy.get(`#displayedUserName${user.username}`).click().wait(TIMEOUTS.HALF_SEC);

                    // # Search for the 2nd user's username
                    cy.get('#selectItems input').
                        typeWithForce(user2.username).
                        wait(TIMEOUTS.HALF_SEC);

                    // # Select the user you searched for
                    cy.get(`#displayedUserName${user2.username}`).click().wait(TIMEOUTS.HALF_SEC);

                    // # Click Go
                    cy.findByTestId('saveSetting').should('be.visible').click();

                    // * Verify that the GM is in the original category and that it hasn't duplicated in the DM category
                    cy.get(`.SidebarChannelGroup:contains(Category ${user.username})`).find(`#sidebarItem_${channel.name}`).should('be.visible');
                    cy.get('.SidebarChannelGroup:contains(DIRECT MESSAGES)').find(`#sidebarItem_${channel.name}`).should('not.exist');

                    // * Verify that we switched to the GM
                    cy.url().should('include', `/messages/${channel.name}`);
                });
            });
        });
    });
});

function clickOnNewDMButton() {
    cy.uiGetLHS().within(() => {
        cy.findByText('DIRECT MESSAGES').should('be.visible').parents('.SidebarChannelGroupHeader').within(() => {
            cy.findByLabelText('Write a direct message').should('be.visible').click();
        });
    });
}

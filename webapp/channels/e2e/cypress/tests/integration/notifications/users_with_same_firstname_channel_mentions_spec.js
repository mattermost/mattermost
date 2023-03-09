// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***********************************************************  ****

// Stage: @prod
// Group: @notifications

import * as TIMEOUTS from '../../fixtures/timeouts';
import {getRandomId} from '../../utils';

describe('Notifications', () => {
    let testTeam;
    let firstUser;
    let secondUser;

    before(() => {
        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            // # Create two users with same first name in username
            const firstUsername = `test${getRandomId()}`;
            cy.apiCreateUser({user: generateTestUser(firstUsername)}).then(({user: user1}) => {
                firstUser = user1;
                cy.apiAddUserToTeam(testTeam.id, firstUser.id);
            });

            const secondUsername = `${firstUsername}.one`;
            cy.apiCreateUser({user: generateTestUser(secondUsername)}).then(({user: user2}) => {
                secondUser = user2;
                cy.apiAddUserToTeam(testTeam.id, secondUser.id);
            });
        });
    });

    it('MM-T486 Users with the same firstname in their username should not get a mention when one of them leaves a channel', () => {
        // # Login as first user
        cy.apiLogin(firstUser);

        cy.apiCreateChannel(testTeam.id, 'test_channel', 'Test Channel').then(({channel}) => {
            // # Visit the newly created channel as the first user and invite the second user
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
            cy.apiAddUserToChannel(channel.id, secondUser.id);

            // # Go to the 'Off Topic' channel and logout
            cy.get('#sidebarItem_off-topic', {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').click();
            cy.apiLogout();

            // # Login as the second user and go to the team site
            cy.apiLogin(secondUser);
            cy.visit(`/${testTeam.name}`);

            // * Verify that the channel that the first created is visible and that there is one unread mention (for being invited)
            cy.get(`#sidebarItem_${channel.name}`, {timeout: TIMEOUTS.HALF_MIN}).should('be.visible').within(() => {
                cy.findByText(channel.display_name).should('be.visible');
                cy.get('#unreadMentions').should('have.text', '1');
            });

            // # Go to the test channel
            cy.get(`#sidebarItem_${channel.name}`).click();

            // # Verify that the mention does not exist anymore
            checkUnreadMentions(channel);

            // # Leave the test channel and logout
            cy.uiOpenChannelMenu('Leave Channel');
            cy.apiLogout();

            // # Login as first user and visit town square
            cy.apiLogin(firstUser);
            cy.visit(`/${testTeam.name}/channels/town-square`);

            // * Check that the display name of the team the user was invited to is being correctly displayed
            cy.uiOpenUserMenu().findByText(`@${firstUser.username}`);

            // # Close the user menu
            cy.uiGetSetStatusButton().click();

            // * Check that 'Town Square' is currently being selected
            cy.get('.active').within(() => {
                cy.get('#sidebarItem_town-square').should('exist');
            });

            // * Verify that the first user did not get a mention from the test channel when the second user left
            checkUnreadMentions(channel);
        });
    });

    // Function to check that the unread mentions badge does not exist (the user was not mentioned in the test channel)
    function checkUnreadMentions(testChannel) {
        cy.get(`#sidebarItem_${testChannel.name}`).within(() => {
            cy.get('#unreadMentions').should('not.exist');
        });
    }

    // Function to generate a test user with a random username
    function generateTestUser(username) {
        const randomId = getRandomId();

        return {
            email: `${username}${randomId}@sample.mattermost.com`,
            username,
            password: 'passwd',
            first_name: `First${randomId}`,
            last_name: `Last${randomId}`,
            nickname: `Nickname${randomId}`,
        };
    }
});

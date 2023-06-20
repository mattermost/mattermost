// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Stage: @prod
// Group: @channels @multi_team_and_dm

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Direct messages: redirections', () => {
    let testUser;
    let secondDMUser;
    let firstDMUser;
    let testTeam;
    let offTopicChannelUrl;

    before(() => {
        // # Create a new team
        cy.apiInitSetup().then(({team, user}) => {
            testUser = user;
            testTeam = team;

            offTopicChannelUrl = `/${testTeam.name}/channels/off-topic`;

            cy.apiCreateUser().then(({user: createdUser}) => {
                firstDMUser = createdUser;
                cy.apiAddUserToTeam(testTeam.id, firstDMUser.id);
            });

            // # Create a second test user
            cy.apiCreateUser().then(({user: createdUser}) => {
                secondDMUser = createdUser;
                cy.apiAddUserToTeam(testTeam.id, secondDMUser.id);
            });

            // # Login as test user
            cy.apiLogin(testUser);

            // # View 'off-topic' channel
            cy.visit(offTopicChannelUrl);
        });
    });

    it('MM-T453_1 Closing a direct message should redirect to town square channel', () => {
        // # From the 'Direct Messages' menu, find a specific user and send 'hi'
        sendDirectMessageToUser(firstDMUser, 'hi');

        // # Close the direct message via 'x' button right of the username in the direct messages' list
        closeDirectMessage(testUser, firstDMUser, testTeam);

        // * Expect to be redirected to town square channel, check channel title and url
        expectActiveChannelToBe('Town Square', `/${testTeam.name}/channels/town-square`);

        // # From the 'Direct Messages' menu, find the same user as before and send 'hi'
        sendDirectMessageToUser(firstDMUser, 'hi again');

        // # Open channel menu and click Close Direct Message
        cy.uiOpenChannelMenu('Close Direct Message');

        // * Expect to be redirected to town square channel, check channel title and url
        expectActiveChannelToBe('Town Square', `/${testTeam.name}/channels/town-square`);
    });

    it('MM-T453_2 Closing a different direct message should not affect active direct message', () => {
        // # Send a direct message to a first user
        sendDirectMessageToUser(firstDMUser, 'hi first');

        // # Send a message to a second user
        sendDirectMessageToUser(secondDMUser, 'hi second');

        // # Close the direct message previously opened with the first user
        closeDirectMessage(testUser, firstDMUser, testTeam);

        // * Expect channel title and url to secondDMUser's username
        expectActiveChannelToBe(secondDMUser.username, `/messages/@${secondDMUser.username}`);
    });

    it('MM-T453_3 Changing URL to root url when viewing a direct message should redirect to direct message', () => {
        // # Send a direct message to a first user
        sendDirectMessageToUser(firstDMUser, 'hi');

        // # Visit root url
        cy.visit('/');

        // * Expect channel title and url to firstDMUser's username
        expectActiveChannelToBe(firstDMUser.username, `/messages/@${firstDMUser.username}`);
    });
});

const expectActiveChannelToBe = (title, url) => {
    // * Expect channel title to match title passed in argument
    cy.get('#channelHeaderTitle').
        should('be.visible').
        and('contain.text', title);

    // * Expect url to match url passed in argument
    cy.url().should('contain', url);
};

const sendDirectMessageToUser = (user, message) => {
    // # Open a new direct message with firstDMUser
    cy.uiAddDirectMessage().click();

    // # Type username
    cy.get('#selectItems input').should('be.enabled').typeWithForce(`@${user.username}`).wait(TIMEOUTS.ONE_SEC);

    // * Expect user count in the list to be 1
    cy.get('#multiSelectList').
        should('be.visible').
        children().
        should('have.length', 1);

    // # Select first user in the list
    cy.get('body').
        type('{downArrow}').
        type('{enter}');

    // # Click on "Go" in the group message's dialog to begin the conversation
    cy.get('#saveItems').click();

    // * Expect the channel title to be the user's username
    // In the channel header, it seems there is a space after the username, justifying the use of contains.text instead of have.text
    cy.get('#channelHeaderTitle').should('be.visible').and('contain.text', user.username);

    // # Type message and send it to the user
    cy.uiGetPostTextBox().
        type(message).
        type('{enter}');
};

const closeDirectMessage = (sender, recipient, team) => {
    // # Find the username in the 'Direct Messages' list and trigger the 'x' button to appear (hover over the username)
    cy.apiGetChannelsForUser(sender.id, team.id).then(({channels}) => {
        // Get the name of the channel to build the CSS selector for that specific DM link in the sidebar
        const channelDmWithFirstUser = channels.find((channel) =>
            channel.type === 'D' && channel.name.includes(recipient.id),
        );

        // # Close the DM via sidebar channel menu
        cy.uiGetChannelSidebarMenu(channelDmWithFirstUser.name, true).within(() => {
            cy.findByText('Close Conversation').click();
        });
    });
};

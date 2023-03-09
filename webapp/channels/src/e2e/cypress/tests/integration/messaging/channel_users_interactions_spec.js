// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @messaging

describe('Channel users interactions', () => {
    let testTeam;
    let testChannel;
    let receiver;
    let sender;

    before(() => {
        // # Login as test user
        cy.apiInitSetup().then(({team, channel, user}) => {
            receiver = user;
            testTeam = team;
            testChannel = channel;

            cy.apiCreateUser().then(({user: user1}) => {
                sender = user1;
                cy.apiAddUserToTeam(testTeam.id, sender.id).then(() => {
                    cy.apiAddUserToChannel(testChannel.id, sender.id);
                });
            });

            cy.apiLogin(receiver);

            // # Visit a test channel and post a message
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
            cy.postMessage('Hello');
        });
    });

    it('MM-T216 Scroll to bottom when sending a message', () => {
        // # Go to off-topic channel via LHS
        cy.get('#sidebarItem_off-topic').click({force: true});

        // # Post a message in test channel by another user
        const message = `I\'m messaging!${'\n2'.repeat(30)}`; // eslint-disable-line no-useless-escape
        cy.postMessageAs({sender, message, channelId: testChannel.id});

        // # Post any message to off-topic channel
        const hello = 'Hello';
        cy.postMessage(hello);
        cy.uiWaitUntilMessagePostedIncludes(hello);

        // # Go to test channel where the message is posted
        cy.get(`#sidebarItem_${testChannel.name}`).click({force: true});

        // * Check that the new message separator is visible
        cy.findByTestId('NotificationSeparator').
            find('span').
            should('be.visible').
            and('have.text', 'New Messages');

        // # Post a message on current channel
        cy.uiGetPostTextBox().clear().type('message123{enter}');

        // * Verify that last posted message is visible
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).should('have.text', 'message123');
        });
    });
});

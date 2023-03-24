// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notifications

import {spyNotificationAs} from '../../../support/notification';

import {changeDesktopNotificationAs} from './helper';

describe('Desktop notifications', () => {
    let testTeam;
    let testChannel;
    let testUser;
    let otherUser;

    before(() => {
        cy.apiCreateUser().then(({user}) => {
            otherUser = user;
        });

        // Initialize a user
        cy.apiInitSetup().then(({team, channel, user, offTopicUrl}) => {
            testUser = user;
            testTeam = team;
            testChannel = channel;

            cy.apiAddUserToTeam(testTeam.id, otherUser.id).then(() => {
                cy.apiAddUserToChannel(testChannel.id, otherUser.id);
            });

            // Login then visit off-topic
            cy.apiLogin(testUser);
            cy.visit(offTopicUrl);
        });
    });

    it('MM-T885 Channel notifications: Desktop notifications mentions only', () => {
        // # Ensure notifications are set up to fire a desktop notification
        changeDesktopNotificationAs('#desktopNotificationAllActivity');

        const messageWithNotification = `random message with mention @${testUser.username}`;
        const expected = `@${otherUser.username}: ${messageWithNotification}`;

        // # Go to test channel
        cy.uiClickSidebarItem(testChannel.name);

        // # Set channel notifications to show on mention only
        cy.uiOpenChannelMenu('Notification Preferences');
        cy.findByText('Send desktop notifications').click();
        cy.findByRole('radio', {name: 'Only for mentions'}).click();
        cy.uiSaveAndClose();

        // # Visit off-topic
        cy.uiClickSidebarItem('off-topic');
        spyNotificationAs('withNotification', 'granted');

        // Have another user send a post with no mention
        cy.postMessageAs({sender: otherUser, message: 'random message no mention', channelId: testChannel.id});

        // * Desktop notification is not received
        cy.get('@withNotification').should('not.have.been.called');

        // Have another user send a post with a mention
        cy.postMessageAs({sender: otherUser, message: messageWithNotification, channelId: testChannel.id});

        // * Desktop notification is received
        cy.get('@withNotification').should('have.been.calledWithMatch', testChannel.display_name, (args) => {
            expect(args.body, `Notification body: "${args.body}" should match: "${expected}"`).to.equal(expected);
            return true;
        });

        // * Notification badge is aligned to the right of LHS
        cy.uiGetSidebarItem(testChannel.name).find('.badge').should('exist').and('have.css', 'margin', '0px 4px');
    });
});

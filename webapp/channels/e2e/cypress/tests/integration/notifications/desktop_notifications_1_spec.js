// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @notifications

import * as MESSAGES from '../../fixtures/messages';
import * as TIMEOUTS from '../../fixtures/timeouts';
import {spyNotificationAs} from '../../support/notification';

import {
    changeDesktopNotificationAs,
    changeTeammateNameDisplayAs,
} from './helper';

describe('Desktop notifications', () => {
    let testTeam;
    let testUser;
    let otherUser;

    before(() => {
        // Initialise a user
        cy.apiInitSetup().then(({team, user}) => {
            otherUser = user;
            testTeam = team;
        });
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiCreateUser().then(({user}) => {
            testUser = user;
            cy.apiAddUserToTeam(testTeam.id, testUser.id);
            cy.apiLogin(testUser);

            // Visit town-square.
            cy.visit(`/${testTeam.name}/channels/town-square`);
        });
    });

    it('MM-T482 Desktop Notifications - (at) here not rec\'d when logged off', () => {
        spyNotificationAs('withoutNotification', 'granted');

        // # Ensure notifications are set up to fire a desktop notification if are mentioned.
        changeDesktopNotificationAs('#desktopNotificationMentions');

        cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
            // # Logout the user
            cy.uiLogout();

            // Have another user send a post.
            cy.postMessageAs({sender: otherUser, message: '@here', channelId: channel.id});
        });

        // # Login with the user and visit town-square
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // * Desktop notification is not received.
        cy.get('@withoutNotification').should('not.have.been.called');

        // * Should not have unread mentions indicator.
        cy.get('#sidebarItem_off-topic').
            scrollIntoView().
            find('#unreadMentions').
            should('not.exist');

        // # Verify that off-topic channel is unread and then click.
        cy.findByLabelText('off-topic public channel unread').
            should('exist').
            click();

        // # Get last post message text
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).as('postMessageText');
        });

        // * Verify message has @here mention and it is highlighted.
        cy.get('@postMessageText').
            find('[data-mention="here"]').
            should('exist');

        // * Verify no email notification received for the mention.
        cy.getRecentEmail(testUser).then((data) => {
            // # Verify that the email subject is about joining.
            expect(data.subject).to.contain('You joined');
        });
    });

    it('MM-T487 Desktop Notifications - For all activity with apostrophe, emoji, and markdown in notification', () => {
        spyNotificationAs('withNotification', 'granted');

        const actualMsg = '*I\'m* [hungry](http://example.com) :taco: ![Mattermost](https://mattermost.com/wp-content/uploads/2022/02/logoHorizontal.png)';
        const expected = '@' + otherUser.username + ': I\'m hungry :taco: Mattermost';

        // # Ensure notifications are set up to fire a desktop notification if are mentioned.
        changeDesktopNotificationAs('#desktopNotificationAllActivity');

        cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
            // # Have another user send a post.
            cy.postMessageAs({sender: otherUser, message: actualMsg, channelId: channel.id});

            // * Desktop notification should be received with expected body.
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.get('@withNotification').should('have.been.calledWithMatch', 'Off-Topic', (args) => {
                expect(args.body, `Notification body: "${args.body}" should match: "${expected}"`).to.equal(expected);
                return true;
            });
        });
    });

    it('MM-T495 Desktop Notifications - Can set to DND and no notification fires on DM', () => {
        cy.apiCreateDirectChannel([otherUser.id, testUser.id]).then(({channel}) => {
            // # Ensure notifications are set up to fire a desktop notification if you receive a DM
            cy.apiPatchUser(testUser.id, {notify_props: {...testUser.notify_props, desktop: 'all'}});

            spyNotificationAs('withoutNotification', 'granted');

            // # Post the following: /dnd
            cy.uiGetPostTextBox().clear().type('/dnd{enter}');

            // # Have another user send you a DM
            cy.postMessageAs({sender: otherUser, message: MESSAGES.TINY, channelId: channel.id});

            // * Desktop notification is not received
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.get('@withoutNotification').should('not.have.been.called');

            // * Verify that the status indicator next to your name has changed to "Do Not Disturb"
            cy.uiGetSetStatusButton().
                find('.icon-minus-circle').
                should('be.visible');
        });
    });

    it('MM-T497 Desktop Notifications for empty string without mention badge', () => {
        // # Visit the MM webapp with the notification API stubbed
        spyNotificationAs('withNotification', 'granted');

        const actualMsg = '---';
        const expected = '@' + otherUser.username + ' did something new';

        // # Ensure notifications are set up to fire a desktop notification for all activity.
        changeDesktopNotificationAs('#desktopNotificationAllActivity');

        cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
            // # Have another user send a post.
            cy.postMessageAs({sender: otherUser, message: actualMsg, channelId: channel.id});

            // * Desktop notification should be received with expected body.
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.get('@withNotification').should('have.been.calledWithMatch', 'Off-Topic', (args) => {
                expect(args.body, `Notification body: "${args.body}" should match: "${expected}"`).to.equal(expected);
                return true;
            });

            // * Verify that the channel is now unread without a mention badge
            cy.get(`#sidebarItem_${channel.name} .badge`).should('not.exist');
        });
    });

    it('MM-T488 Desktop Notifications - Teammate name display set to username', () => {
        spyNotificationAs('withNotification', 'granted');

        // # Ensure notifications are set up to fire a desktop notification if are mentioned
        changeDesktopNotificationAs('#desktopNotificationMentions');

        // # Ensure display settings are set to "Show username"
        changeTeammateNameDisplayAs('#name_formatFormatA');

        const actualMsg = `@${testUser.username} How are things?`;
        const expected = `@${otherUser.username}: @${testUser.username} How are things?`;

        cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
            // # Have another user send a post.
            cy.postMessageAs({sender: otherUser, message: actualMsg, channelId: channel.id});

            // * Desktop notification should be received with expected body.
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.get('@withNotification').should('have.been.calledWithMatch', 'Off-Topic', (args) => {
                expect(args.body, `Notification body: "${args.body}" should match: "${expected}"`).to.equal(expected);
                return true;
            });
        });
    });

    it('MM-T490 Desktop Notifications - Teammate name display set to first and last name', () => {
        spyNotificationAs('withNotification', 'granted');

        // # Ensure notifications are set up to fire a desktop notification if are mentioned
        changeDesktopNotificationAs('#desktopNotificationMentions');

        // # Ensure display settings are set to "Show first and last name"
        changeTeammateNameDisplayAs('#name_formatFormatC');

        const actualMsg = `@${testUser.username} How are things?`;
        const expected = `@${otherUser.first_name} ${otherUser.last_name}: @${testUser.username} How are things?`;

        cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
            // # Have another user send a post.
            cy.postMessageAs({sender: otherUser, message: actualMsg, channelId: channel.id});

            // * Desktop notification should be received with expected body.
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.get('@withNotification').should('have.been.calledWithMatch', 'Off-Topic', (args) => {
                expect(args.body, `Notification body: "${args.body}" should match: "${expected}"`).to.equal(expected);
                return true;
            });
        });
    });

    it('MM-T491 - Channel notifications: No desktop notification when in focus', () => {
        cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
            const message = '/echo test 3';

            // # Go to test channel
            cy.visit(`/${testTeam.name}/channels/${channel.name}`);
            spyNotificationAs('withNotification', 'granted');

            // # Have another user send a post with delay
            cy.postMessageAs({sender: otherUser, message, channelId: channel.id});

            // * Desktop notification is not received
            cy.get('@withNotification').should('not.have.been.called');
        });
    });

    it('MM-T494 - Channel notifications: Send Desktop Notifications - Only mentions and DMs', () => {
        spyNotificationAs('withNotification', 'granted');

        // # Ensure notifications are set up to fire a desktop notification
        changeDesktopNotificationAs('#desktopNotificationMentions');

        cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
            const messageWithoutNotification = 'message without notification';
            const messageWithNotification = `random message with mention @${testUser.username}`;
            const expected = `@${otherUser.username}: ${messageWithNotification}`;

            // # Have another user send a post with no mention
            cy.postMessageAs({sender: otherUser, message: messageWithoutNotification, channelId: channel.id});

            // * Desktop notification is not received
            cy.get('@withNotification').should('not.have.been.called');

            // Have another user send a post with a mention
            cy.postMessageAs({sender: otherUser, message: messageWithNotification, channelId: channel.id});

            // * Desktop notification is received
            cy.get('@withNotification').should('have.been.calledWithMatch', 'Off-Topic', (args) => {
                expect(args.body, `Notification body: "${args.body}" should match: "${expected}"`).to.equal(expected);
                return true;
            });

            // # Have another user post a direct message
            cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(({channel: dmChannel}) => {
                cy.postMessageAs({sender: otherUser, message: 'hi', channelId: dmChannel.id});

                // * DM notification is received
                cy.get('@withNotification').should('have.been.called');
            });
        });
    });

    it('MM-T496 - Channel notifications: Send Desktop Notifications - Never', () => {
        spyNotificationAs('withNotification', 'granted');

        // # Ensure notifications are set up to never fire a desktop notification
        changeDesktopNotificationAs('#desktopNotificationNever');

        cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
            const messageWithNotification = `random message with mention @${testUser.username}`;

            // Have another user send a post with a mention
            cy.postMessageAs({sender: otherUser, message: messageWithNotification, channelId: channel.id});

            // * Desktop notification is not received
            cy.get('@withNotification').should('not.have.been.called');

            // # Have another user post a direct message
            cy.apiCreateDirectChannel([testUser.id, otherUser.id]).then(({channel: dmChannel}) => {
                cy.postMessageAs({sender: otherUser, message: 'hi', channelId: dmChannel.id});

                // * DM notification is not received
                cy.get('@withNotification').should('not.have.been.called');
            });
        });
    });

    it('MM-T499 - Channel notifications: Desktop Notification Sounds OFF', () => {
        spyNotificationAs('withNotification', 'granted');

        // # Open settings modal
        cy.uiOpenSettingsModal().within(() => {
            // # Click "Desktop"
            cy.findByText('Desktop Notifications').should('be.visible').click();

            // # Select sound off.
            cy.get('#soundOff').check();

            // # Ensure sound dropdown is not visible
            cy.get('#displaySoundNotification').should('not.exist');

            // # Click "Save" and close the modal
            cy.uiSaveAndClose();
        });

        cy.apiGetChannelByName(testTeam.name, 'Off-Topic').then(({channel}) => {
            const messageWithNotification = `random message with mention @${testUser.username}`;

            // # Have another user send a post with a mention
            cy.postMessageAs({sender: otherUser, message: messageWithNotification, channelId: channel.id});

            // * Desktop notification is received without sound
            cy.get('@withNotification').should('have.been.calledWithMatch', 'Off-Topic', (args) => {
                expect(args.silent).to.equal(true);
                return true;
            });
        });
    });
});

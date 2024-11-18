// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @collapsed_reply_threads

import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';
import {PostMessageResp} from '../../../support/task_commands';
import {spyNotificationAs} from '../../../support/notification';

describe('CRT Desktop notifications', () => {
    let testTeam: Team;
    let testChannelUrl: string;
    let testChannelId: string;
    let testChannelName: string;
    let receiver: UserProfile;
    let sender: UserProfile;

    before(() => {
        cy.apiUpdateConfig({
            ServiceSettings: {
                ThreadAutoFollow: true,
                CollapsedThreads: 'default_on',
            },
        });

        cy.apiCreateUser().then(({user}) => {
            sender = user;
        });

        cy.apiInitSetup().then(({team, channel, user, channelUrl}) => {
            testTeam = team;
            receiver = user;
            testChannelUrl = channelUrl;
            testChannelId = channel.id;
            testChannelName = channel.display_name;

            cy.apiAddUserToTeam(testTeam.id, sender.id).then(() => {
                cy.apiAddUserToChannel(testChannelId, sender.id);
            });

            // # Login as receiver
            cy.apiLogin(receiver);
        });
    });

    it('MM-T4417_1 Trigger notifications on all replies when channel setting is checked', () => {
        // # Visit channel
        cy.visit(testChannelUrl);

        cy.uiOpenChannelMenu('Notification Preferences');

        // # Click on Mute Channel to Unmute Channel
        cy.findByText('Mute channel').should('be.visible').click({force: true});

        // * Verify that channel is muted alert is visible
        cy.findByText('This channel is muted').should('be.visible');

        // # Save the changes
        cy.findByText('Save').should('be.visible').click();

        // Setup notification spy
        spyNotificationAs('notifySpy', 'granted');

        // # Set users notification settings
        cy.uiOpenChannelMenu('Notification Preferences');

        // # Click on Mute Channel to Unmute Channel
        cy.findByText('Mute channel').should('be.visible').click({force: true});

        // # Click "Desktop Notifications"
        cy.findByText('Desktop Notifications').should('be.visible');

        cy.get('.channel-notifications-settings-modal__body').scrollTo('center').get('#desktopNotification-all').should('be.visible').click();
        cy.get('.channel-notifications-settings-modal__body').get('#desktopNotification-all').should('be.checked');

        cy.get('#desktopNotification-mention').should('be.visible').click().then(() => {
            cy.get('[data-testid="desktopReplyThreads"]').should('be.checked');
            cy.get('[data-testid="desktopReplyThreads"]').should('be.visible').click();
            cy.get('[data-testid="desktopReplyThreads"]').should('not.be.checked');
        });
        cy.get('.channel-notifications-settings-modal__body').scrollTo('center').get('#desktopNotification-mention').should('be.checked');

        cy.get('.channel-notifications-settings-modal__body').scrollTo('center').get('#desktopNotification-none').should('be.visible').click();
        cy.get('.channel-notifications-settings-modal__body').get('#desktopNotification-none').should('be.checked');

        // # Save the changes
        cy.findByText('Save').should('be.visible').click();

        // # Set users notification settings
        cy.uiOpenChannelMenu('Notification Preferences');
        cy.get('.channel-notifications-settings-modal__body').scrollTo('center').get('#desktopNotification-none').should('be.checked');
        cy.get('.channel-notifications-settings-modal__body').get('#desktopNotification-all').scrollIntoView().should('be.visible').click();

        // # Save the changes
        cy.findByText('Save').should('be.visible').click();

        // # Post a root message as other user
        cy.postMessageAs({sender, message: 'This is a not followed root message', channelId: testChannelId, rootId: ''}).then(({id: postId}) => {
            // # Switch to town-square so that unread notifications in test channel may be triggered
            cy.uiClickSidebarItem('town-square');

            // # Post a message in unfollowed thread as another user
            cy.postMessageAs({sender, message: 'This is a reply to the unfollowed thread', channelId: testChannelId, rootId: postId});

            // * Verify stub was not called for unfollowed thread
            cy.get('@notifySpy').should('not.be.called');
        });

        // # Visit channel
        cy.visit(testChannelUrl);

        // Setup notification spy
        spyNotificationAs('notifySpy', 'granted');

        // # Post a message
        cy.postMessage('Hi there, this is a root message');

        // # Get post id of message
        cy.getLastPostId().then((postId) => {
            // # Switch to town-square so that unread notifications in test channel may be triggered
            cy.uiClickSidebarItem('town-square');

            // # Post a message in original thread as another user
            const message = 'This is a reply to the root post';
            cy.postMessageAs({sender, message, channelId: testChannelId, rootId: postId});

            // * Verify stub was called with correct title and body
            cy.get('@notifySpy').should('have.been.calledWithMatch', `Reply in ${testChannelName}`, (args) => {
                expect(args.body, `Notification body: "${args.body}" should match: "${message}"`).to.equal(`@${sender.username}: ${message}`);
                return true;
            });

            // # Cleanup
            cy.apiDeletePost(postId);
        });
    });

    it('MM-T4417_2 Click on sameMobileSettingsDesktop and check if additional settings still appears', () => {
        cy.visit(testChannelUrl);

        // # Open channel's notification preferences
        cy.uiOpenChannelMenu('Notification Preferences');

        // * As per previous conditions the mobile and desktop settings should be the same
        cy.get('[data-testid="sameMobileSettingsDesktop"]').scrollIntoView().should('be.checked');

        // * Verify that Notify me about section of mobile settings is not visible
        cy.get('[data-testid="mobile-notify-me-radio-section"]').should('not.exist');

        // # Now uncheck the sameMobileSettingsDesktop so that mobile and desktop settings are different
        cy.get('[data-testid="sameMobileSettingsDesktop"]').scrollIntoView().should('be.visible').click();

        // * Verify that Notify me about section of mobile settings is visible
        cy.get('[data-testid="mobile-notify-me-radio-section"]').should('be.visible').scrollIntoView().within(() => {
            cy.findByText('Notify me about…').should('be.visible');

            // # Click on mentions option
            cy.get('[data-testid="MobileNotification-mention"]').should('be.visible').click();
        });

        // * Verify that Thread reply notifications section of mobile settings is visible
        cy.get('[data-testid="mobile-reply-threads-checkbox-section"]').should('be.visible').scrollIntoView().within(() => {
            cy.findByText('Notify me about replies to threads I’m following').should('be.visible');
        });

        // # Close the modal
        cy.get('body').type('{esc}');
    });

    it('MM-T4417_3 Trigger notifications only on mention replies when channel setting is unchecked', () => {
        // # Visit the test channel
        cy.visit(testChannelUrl);

        // # Setup notification spy
        spyNotificationAs('notifySpy1', 'granted');

        // # Open channel's notification preferences for test channel
        cy.uiOpenChannelMenu('Notification Preferences');

        // # Select "Mentions, direct messages, and keywords only" as notify me about option
        cy.get('#desktopNotification-mention').scrollIntoView().should('be.visible').click();

        // # Unselect "Notify me about replies to threads I’m following"
        cy.get('[data-testid="desktopReplyThreads"]').scrollIntoView().should('be.visible').then(($el) => {
            if ($el.is(':checked')) {
                cy.wrap($el).click();
            }
        });

        // # Select notification checkbox active
        cy.get('[data-testid="desktopNotificationSoundsCheckbox"]').scrollIntoView().should('be.visible').then(($el) => {
            if (!$el.is(':checked')) {
                cy.wrap($el).click();
            }
        });

        // # Select a notification sound from dropdown
        cy.get('#desktopNotificationSoundsSelect').scrollIntoView().should('be.visible').click();
        cy.findByText('Crackle').should('be.visible').click();

        // # Save the changes
        cy.findByText('Save').should('be.visible').click();

        // # Go to the town-square channel
        cy.visit(`/${testTeam.name}/channels/town-square`);

        // # Post a root message as other user in the test channel
        cy.postMessageAs({sender, message: 'This is the root message which will not have a at-mention in thread', channelId: testChannelId, rootId: ''}).then(({id: postId}) => {
            // # Post a message in the thread without at-mention
            cy.postMessageAs({sender, message: 'Reply without at-mention', channelId: testChannelId, rootId: postId}).then(() => {
                // * Verify Notification stub was not called for threads which does not have at-mention as per channel settings
                cy.get('@notifySpy1').should('not.be.called');
            });

            // # Cleanup
            cy.apiDeletePost(postId);
        });

        // Setup another notification spy
        spyNotificationAs('notifySpy2', 'granted');

        // # Post another message in the test channel
        cy.postMessageAs({sender, message: 'This is another root message which will have a at-mention in thread', channelId: testChannelId, rootId: ''}).then(({id: postId}) => {
            const message = `Reply with at-mention @${receiver.username}`;

            // # Post a message in the thread with at-mention
            cy.postMessageAs({sender, message, channelId: testChannelId, rootId: postId});

            // * Verify Notification stub was called with correct title and body with at-mention as per channel settings
            cy.get('@notifySpy2').should('have.been.calledWithMatch', `Reply in ${testChannelName}`, (args) => {
                expect(args.body, `Notification body: "${args.body}" should match: "${message}"`).to.equal(`@${sender.username}: ${message}`);
                return true;
            });

            // # Cleanup
            cy.apiDeletePost(postId);
        });
    });

    it('When a reply is deleted in open channel, the notification should be cleared', () => {
        // # Visit channel
        cy.visit(testChannelUrl);

        // # Post a root message as other user
        cy.postMessageAs({sender, message: 'a thread', channelId: testChannelId, rootId: ''});

        // # Get post id of message
        cy.getLastPostId().then((postId) => {
            // # Post a reply to the thread, which will trigger a follow
            cy.postMessageAs({sender: receiver, message: 'following the thread', channelId: testChannelId, rootId: postId});

            // # Post a reply to the thread
            cy.postMessageAs({sender, message: 'a reply', channelId: testChannelId, rootId: postId}).as('reply');

            // # Post a mention reply to the thread
            cy.postMessageAs({sender, message: `@${receiver.username} mention reply`, channelId: testChannelId, rootId: postId}).
                as('replyMention');

            // * Verify there is a notification
            cy.get('#sidebarItem_threads #unreadMentions').should('exist').and('have.text', '1');

            // # Delete the replies
            const replies = ['@reply', '@replyMention'];
            for (const reply of replies) {
                cy.get<PostMessageResp>(reply).then(({id}) => {
                    cy.apiDeletePost(id);
                });
            }

            // * Verify there is no notification
            cy.get('#sidebarItem_threads #unreadMentions').should('not.exist');

            // # Cleanup
            cy.apiDeletePost(postId);
        });
    });

    it('When a reply is deleted in DM channel, the notification should be cleared', () => {
        cy.apiCreateDirectChannel([receiver.id, sender.id]).then(({channel: dmChannel}) => {
            // # Visit channel
            cy.visit(`/${testTeam.name}/messages/@${sender.username}`);

            // # Post a root message as other user
            cy.postMessageAs({sender, message: 'a thread', channelId: dmChannel.id, rootId: ''}).as('rootPost');

            // # Get post id of message
            cy.get<PostMessageResp>('@rootPost').then(({id: rootId}) => {
                // # Post a reply to the thread, which will trigger a follow
                cy.postMessageAs({sender: receiver, message: 'following the thread', channelId: dmChannel.id, rootId});

                // # Post a reply to the thread
                cy.postMessageAs({sender, message: 'a reply', channelId: dmChannel.id, rootId}).as('reply');

                // # Post a mention reply to the thread
                cy.postMessageAs({sender, message: `@${receiver.username} mention reply`, channelId: dmChannel.id, rootId}).
                    as('replyMention');

                // * Verify there is a notification
                cy.get('#sidebarItem_threads #unreadMentions').should('exist');

                // # Delete the replies
                const replies = ['@reply', '@replyMention'];
                for (const reply of replies) {
                    cy.get<PostMessageResp>(reply).then(({id}) => {
                        cy.apiDeletePost(id);
                    });
                }

                // * Verify there is no notification
                cy.get('#sidebarItem_threads #unreadMentions').should('not.exist');

                // # Cleanup
                cy.apiDeletePost(rootId);
            });
        });
    });
});

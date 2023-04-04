// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @collapsed_reply_threads

import {spyNotificationAs} from '../../../support/notification';

describe('CRT Desktop notifications', () => {
    let testTeam;
    let testChannelUrl;
    let testChannelId;
    let testChannelName;
    let receiver;
    let sender;

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
        cy.get('[data-testid="muteChannel"]').click().then(() => {
            cy.get('.AlertBanner--app').should('be.visible');
        });
        cy.get('.channel-notifications-settings-modal__save-btn').should('be.visible').click();

        // Setup notification spy
        spyNotificationAs('notifySpy', 'granted');

        // # Set users notification settings
        cy.uiOpenChannelMenu('Notification Preferences');

        // # click on Mute Channel to Unmute Channel
        cy.get('[data-testid="muteChannel"]').click();

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

        // # click on Save button
        cy.get('.channel-notifications-settings-modal__save-btn').should('be.visible').click();

        // # Set users notification settings
        cy.uiOpenChannelMenu('Notification Preferences');
        cy.get('.channel-notifications-settings-modal__body').scrollTo('center').get('#desktopNotification-none').should('be.checked');
        cy.get('.channel-notifications-settings-modal__body').scrollTo('center').get('#desktopNotification-all').should('be.visible').click();

        cy.get('.channel-notifications-settings-modal__save-btn').should('be.visible').click();

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
        });
    });

    it('MM-T4417_2 Click on sameMobileSettingsDesktop and check if additional settings still appears', () => {
        cy.visit(testChannelUrl);
        cy.uiOpenChannelMenu('Notification Preferences');
        cy.get('.channel-notifications-settings-modal__body').scrollTo('center').get('#desktopNotification-mention').should('be.visible').click().then(() => {
            cy.get('[data-testid="desktopReplyThreads"]').should('be.visible').click();
        });
        cy.get('.channel-notifications-settings-modal__body').scrollTo('center').get('[data-testid="desktopReplyThreads"]').should('be.visible').click();
        cy.get('.channel-notifications-settings-modal__body').scrollTo('bottom').get('[data-testid="sameMobileSettingsDesktop"]').should('be.checked').then(() => {
            cy.findByText('Notify me about…').should('not.be.visible');
        });

        // check the box to see if the additional settings appears
        cy.get('.channel-notifications-settings-modal__body').scrollTo('bottom').get('[data-testid="sameMobileSettingsDesktop"]').click();

        cy.get('.mm-modal-generic-section-item__title').should('be.visible').and('contain', 'Notify me about');

        cy.get('#MobileNotification-all').should('be.visible').click();
        cy.get('#MobileNotification-mention').should('be.visible').click().then(() => {
            cy.get('[data-testid="mobileReplyThreads"]').should('be.visible').click();
        });
        cy.get('#MobileNotification-none').should('be.visible').click();

        cy.get('[data-testid="autoFollowThreads"]').should('be.visible').click();

        // # click on Save button
        cy.get('.channel-notifications-settings-modal__save-btn').should('be.visible').click();
    });

    it('MM-T4417_3 Trigger notifications only on mention replies when channel setting is unchecked', () => {
        cy.visit(testChannelUrl);

        // Setup notification spy
        spyNotificationAs('notifySpy', 'granted');

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
            cy.postMessageAs({sender, message: 'This is a reply to the root post', channelId: testChannelId, rootId: postId});

            // * Verify stub was not called
            cy.get('@notifySpy').should('not.be.called');

            // # Post a mention message in original thread as another user
            const message = `@${receiver.username} this is a mention to receiver`;

            cy.postMessageAs({sender, message, channelId: testChannelId, rootId: postId});

            // * Verify stub was called with correct title and body
            cy.get('@notifySpy').should('have.been.calledWithMatch', `Reply in ${testChannelName}`, (args) => {
                expect(args.body, `Notification body: "${args.body}" should match: "${message}"`).to.equal(`@${sender.username}: ${message}`);
                return true;
            });
        });
    });
});

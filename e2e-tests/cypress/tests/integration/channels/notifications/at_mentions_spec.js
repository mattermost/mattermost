// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @notification

import {getAdminAccount} from '../../../support/env';
import {spyNotificationAs} from '../../../support/notification';

describe('Notifications', () => {
    const admin = getAdminAccount();
    let testTeam;
    let testChannel;
    let otherChannel;
    let receiver;
    let sender;

    before(() => {
        cy.apiInitSetup({userPrefix: 'receiver'}).then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            receiver = user;
            return cy.apiCreateChannel(team.id, 'test', 'Test');
        }).then(({channel}) => {
            otherChannel = channel;
            return cy.apiCreateUser({prefix: 'sender'});
        }).then(({user}) => {
            sender = user;
            return cy.apiAddUserToTeam(testTeam.id, sender.id);
        }).then(() => {
            cy.apiAddUserToChannel(testChannel.id, sender.id);
            cy.apiAddUserToChannel(otherChannel.id, sender.id);
            return cy.apiAddUserToChannel(otherChannel.id, receiver.id);
        }).then(() => {
            // # Login as receiver and visit off-topic channel
            cy.apiLogin(receiver);
            cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);

            // # Wait for the page to fully load before continuing
            cy.get('#channelHeaderDropdownButton').should('be.visible').and('have.text', testChannel.display_name);

            cy.get(`#sidebarItem_${otherChannel.name}`).click();
            cy.get('#sidebarItem_off-topic').click();
        });
    });

    it('MM-T547 still triggers notification if username is not listed in words that trigger mentions', () => {
        // # Set Notification settings
        setNotificationSettings({first: false, username: true, shouts: true, custom: true}, 'off-topic');

        const message = `@${receiver.username} I'm messaging you! ${Date.now()}`;

        // # Use another account to post a message @-mentioning our receiver
        cy.postMessageAs({sender, message, channelId: otherChannel.id});

        const body = `@${sender.username}: ${message}`;

        cy.get('@notifySpy').should('have.been.calledWithMatch', otherChannel.display_name, (args) => {
            expect(args.body, `Notification body: "${args.body}" should match: "${body}"`).to.equal(body);
            expect(args.tag, `Notification tag: "${args.tag}" should match: "${body}"`).to.equal(body);
            return true;
        });

        cy.get('@notifySpy').should('have.been.calledWithMatch',
            otherChannel.display_name, {body, tag: body, requireInteraction: false, silent: false});

        // * Verify unread mentions badge
        cy.get(`#sidebarItem_${otherChannel.name}`).
            scrollIntoView().
            find('#unreadMentions').
            should('be.visible').
            and('have.text', '1');

        // * Go to that channel
        cy.get(`#sidebarItem_${otherChannel.name}`).click({force: true});

        // # Get last post message text
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).as('postMessageText');
        });

        // * Verify entire message
        cy.get('@postMessageText').
            should('be.visible').
            and('have.text', message);

        // * Verify highlight of username
        cy.get('@postMessageText').
            find(`[data-mention=${receiver.username}]`).
            should('be.visible').
            and('have.text', `@${receiver.username}`);
    });

    it('MM-T545 does not trigger notifications with "Your non case-sensitive username" unchecked', () => {
        // # Set Notification settings
        setNotificationSettings({first: false, username: false, shouts: true, custom: true}, 'off-topic');

        const message = `Hey ${receiver.username}! I'm messaging you! ${Date.now()}`;

        // # Use another account to post a message @-mentioning our receiver
        cy.postMessageAs({sender, message, channelId: otherChannel.id});

        // * Verify stub was not called
        cy.get('@notifySpy').should('be.not.called');

        // * Verify unread mentions badge does not exist
        cy.get(`#sidebarItem_${otherChannel.name}`).
            scrollIntoView().
            find('#unreadMentions').
            should('not.exist');

        // # Go to the channel where you were messaged
        cy.get(`#sidebarItem_${otherChannel.name}`).click({force: true});

        // # Get last post message text
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).as('postMessageText');
        });

        // * Verify message contents
        cy.get('@postMessageText').
            should('be.visible').
            and('have.text', message);

        // * Verify it's not highlighted
        cy.get('@postMessageText').
            find(`[data-mention=${receiver.username}]`).
            should('not.exist');
    });

    it('MM-T548 does not trigger notifications with "channel-wide mentions" unchecked', () => {
        // # Set Notification settings
        setNotificationSettings({first: false, username: false, shouts: false, custom: true}, 'off-topic');

        const channelMentions = ['@here', '@all', '@channel'];

        channelMentions.forEach((mention) => {
            const message = `Hey ${mention} I'm message you all! ${Date.now()}`;

            // # Use another account to post a message @-mentioning our receiver
            cy.postMessageAs({sender, message, channelId: otherChannel.id});

            // * Verify stub was not called
            cy.get('@notifySpy').should('be.not.called');

            // * Verify unread mentions badge does not exist
            cy.get(`#sidebarItem_${otherChannel.name}`).
                find('#unreadMentions').
                should('not.exist');

            // # Go to the channel where you were messaged
            cy.get(`#sidebarItem_${otherChannel.name}`).click({force: true});

            // # Get last post message text
            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`).as('postMessageText');
            });

            // * Verify message contents
            cy.get('@postMessageText').
                should('be.visible').
                and('have.text', message);

            // * Verify it's not highlighted
            cy.get('@postMessageText').
                find(`[data-mention=${receiver.username}]`).
                should('not.exist');
        });
    });

    it('MM-T184 Words that trigger mentions support Chinese', () => {
        var customText = '番茄';

        // # Set Notification settings
        setNotificationSettings({first: false, username: false, shouts: false, custom: true, customText}, 'off-topic');
        const message = '番茄 I\'m messaging you!';
        const message2 = '我爱吃番茄炒饭 I\'m messaging you!';

        // # Use another account to post a message @-mentioning our receiver
        cy.postMessageAs({sender, message, channelId: otherChannel.id});

        // # Check mention on other channel
        // * Verify unread mentions badge
        cy.get(`#sidebarItem_${otherChannel.name}`).
            scrollIntoView().
            find('#unreadMentions').
            should('be.visible').
            and('have.text', '1');

        // * Go to that channel
        cy.get(`#sidebarItem_${otherChannel.name}`).click({force: true});

        // # Get last post message text
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).as('postMessageText');
        });

        // * Verify entire message
        cy.get('@postMessageText').
            should('be.visible').
            and('have.text', message);

        // * Verify highlight of username
        cy.get('@postMessageText').
            find('.mention--highlight').
            should('be.visible').
            and('have.text', '番茄');

        // # Check mention on test channel
        cy.postMessageAs({sender: admin, message: message2, channelId: testChannel.id});

        // * Verify unread mentions badge
        cy.get(`#sidebarItem_${testChannel.name}`).
            scrollIntoView().
            find('#unreadMentions').
            should('be.visible').
            and('have.text', '1');

        // * Go to that channel
        cy.get(`#sidebarItem_${testChannel.name}`).click({force: true});

        // # Get last post message text
        cy.getLastPostId().then((postId) => {
            cy.get(`#postMessageText_${postId}`).as('postMessageText');
        });

        // * Verify entire message
        cy.get('@postMessageText').
            should('be.visible').
            and('have.text', message2);

        // * Verify highlight of username
        cy.get('@postMessageText').
            find('.mention--highlight').
            should('be.visible').
            and('have.text', '番茄');
    });
});

function setNotificationSettings(desiredSettings = {first: true, username: true, shouts: true, custom: true, customText: '@'}, channelName) {
    // Navigate to settings modal
    cy.uiOpenSettingsModal();

    // # Click on notifications tab
    cy.findByRoleExtended('tab', {name: 'Notifications'}).
        should('be.visible').
        click();

    // Notifications header should be visible
    cy.findAllByText('Notifications').should('be.visible');

    // Open up 'Words that trigger mentions' sub-section
    cy.findByText('Keywords that trigger notifications').
        scrollIntoView().
        click();

    const settings = [
        {key: 'first', selector: '#notificationTriggerFirst'},
        {key: 'username', selector: '#notificationTriggerUsername'},
        {key: 'shouts', selector: '#notificationTriggerShouts'},
        {key: 'custom', selector: '#notificationTriggerCustom'},
    ];

    // Set check boxes to desired state
    settings.forEach((setting) => {
        const checkbox = desiredSettings[setting.key] ? {state: 'check', verify: 'be.checked'} : {state: 'uncheck', verify: 'not.be.checked'};
        cy.get(setting.selector)[checkbox.state]().should(checkbox.verify);
    });

    // Set Custom field
    if (desiredSettings.custom && desiredSettings.customText) {
        cy.get('#notificationTriggerCustomText').
            type(desiredSettings.customText, {force: true}).
            tab();
    }

    // Click “Save” and close modal
    cy.uiSaveAndClose();

    // Setup notification spy
    spyNotificationAs('notifySpy', 'granted');

    // # Navigate to a channel we are NOT going to post to
    cy.get(`#sidebarItem_${channelName}`).scrollIntoView().click({force: true});
    cy.get('#loadingSpinner').should('not.exist');
}

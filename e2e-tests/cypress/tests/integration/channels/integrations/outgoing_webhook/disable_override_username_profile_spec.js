// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @outgoing_webhook

import * as TIMEOUTS from '../../../../fixtures/timeouts';

import {
    enableUsernameAndIconOverrideInt,
    enableUsernameAndIconOverride,
} from '../incoming_webhook/helpers';

describe('Outgoing webhook', () => {
    const triggerWord = 'text';
    const messageWithTriggerWord = 'text with some more text';
    const callbackUrl = `${Cypress.env().webhookBaseUrl}/post_outgoing_webhook`;
    const noChannelSelectionOption = '--- Select a channel ---';
    const overrideIconUrl = 'http://via.placeholder.com/150/00F/888';
    const defaultUsername = 'webhook';
    const overriddenUsername = 'user-overridden';
    const defaultIcon = 'webhook_icon.jpg';
    const overriddenIcon = 'webhook_override_icon.png';

    let sysadmin;
    let testTeam;
    let testChannel;
    let testUser;
    let otherUser;
    let siteName;
    let offTopicUrl;
    let testChannelUrl;

    before(() => {
        cy.apiGetConfig().then(({config}) => {
            siteName = config.TeamSettings.SiteName;
        });
        cy.apiGetMe().then(({user}) => {
            sysadmin = user;
        });
        cy.requireWebhookServer();
    });

    beforeEach(() => {
        cy.apiAdminLogin();
        cy.apiUpdateConfig({
            ServiceSettings: {
                EnablePostUsernameOverride: false,
                EnablePostIconOverride: false,
            },
        });

        cy.apiInitSetup().then((out) => {
            testTeam = out.team;
            testChannel = out.channel;
            testUser = out.user;
            offTopicUrl = out.offTopicUrl;
            testChannelUrl = out.channelUrl;
        });

        cy.apiCreateUser().then(({user: user1}) => {
            otherUser = user1;
            cy.apiAddUserToTeam(testTeam.id, otherUser.id);
        });
    });

    it('MM-T584 default username and profile pic Trigger = posting anything in the specified channel', () => {
        // # Enable user name and icon overrides
        cy.apiAdminLogin();
        enableUsernameAndIconOverride(true);

        // # Visit test channel and post a message
        cy.visit(testChannelUrl);
        cy.postMessage('hello');

        // # Set outgoing webhook
        setOutgoingWebhook(testTeam.name, siteName, {callbackUrl, channelSelect: testChannel.display_name});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Post any message in a channel as testUser
        postMessageInChannel(testUser, testChannelUrl, Date.now());

        // * Verify default profile name and icon of posted webhook message
        verifyProfileNameAndIcon({username: defaultUsername, userIcon: defaultIcon});

        // # Post any message in a channel as otherUser
        postMessageInChannel(testUser, testChannelUrl, Date.now());

        // * Verify default profile name and icon of posted webhook message
        verifyProfileNameAndIcon({username: defaultUsername, userIcon: defaultIcon});
    });

    it('MM-T2035 default username and overridden profile pic (using command) Trigger = posting a trigger word in any channel', () => {
        // # Visit test channel and post a message
        cy.visit(testChannelUrl);
        cy.postMessage('hello');

        // # Set outgoing webhook
        setOutgoingWebhook(testTeam.name, siteName, {callbackUrl, triggerWord, channelSelect: testChannel.display_name});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Enable user icon override only
        cy.apiAdminLogin();
        enableUsernameAndIconOverrideInt(false, true);

        // # Visit test channel
        cy.visit(testChannelUrl);

        // # Edit outgoing webhook
        editOutgoingWebhook(testTeam.name, siteName, {iconUrl: overrideIconUrl, channelSelect: noChannelSelectionOption});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Post a message in test channel as testUser
        postMessageInChannel(testUser, testChannelUrl, messageWithTriggerWord);

        // * Verify default profile name and overridden icon of posted webhook message
        verifyProfileNameAndIcon({username: sysadmin.username, userIcon: overriddenIcon});

        // # Visit off-topic channel
        cy.visit(offTopicUrl);

        // # Post a message in off-topic channel as testUser
        postMessageInChannel(testUser, offTopicUrl, messageWithTriggerWord);

        // * Verify default profile name and overridden icon of posted webhook message
        verifyProfileNameAndIcon({username: sysadmin.username, userIcon: overriddenIcon});
    });

    it('MM-T2036 overridden username and profile pic (using Mattermost UI)', () => {
        // # Go to test channel and post a message
        cy.visit(testChannelUrl);
        cy.postMessage('hello');

        // # Set outgoing webhook
        setOutgoingWebhook(testTeam.name, siteName, {callbackUrl, triggerWord});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Enable user name and icon overrides
        cy.apiAdminLogin();
        enableUsernameAndIconOverride(true);

        // # Visit test channel
        cy.visit(testChannelUrl);

        // # Edit outgoing webhook
        editOutgoingWebhook(testTeam.name, siteName, {username: overriddenUsername, iconUrl: overrideIconUrl});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Post a message in off-topic channel as testUser
        postMessageInChannel(testUser, offTopicUrl, messageWithTriggerWord);

        // * Verify default profile name and overridden icon of posted webhook message
        verifyProfileNameAndIcon({username: overriddenUsername, userIcon: overriddenIcon});
    });

    it('MM-T2037 Outgoing Webhooks - overridden username and profile pic from webhook', () => {
        const usernameFromWebhook = 'user_from_webhook';
        const newCallbackUrl = callbackUrl + '?override_username=' + usernameFromWebhook + '&override_icon_url=' + overrideIconUrl;

        // # Visit test channel and post a message
        cy.visit(testChannelUrl);
        cy.postMessage('hello');

        // # Set outgoing webhook
        setOutgoingWebhook(testTeam.name, siteName, {callbackUrl: newCallbackUrl, triggerWord});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Enable user name and icon overrides
        cy.apiAdminLogin();
        enableUsernameAndIconOverride(true);

        // # Visit test channel
        cy.visit(testChannelUrl);

        // # Edit outgoing webhook
        editOutgoingWebhook(testTeam.name, siteName, {callbackUrl: newCallbackUrl, withConfirmation: true});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Post a message in off-topic as testUser
        postMessageInChannel(testUser, offTopicUrl, messageWithTriggerWord);

        // # Verify overridden profile name and icon from posted webhook message
        verifyProfileNameAndIcon({username: usernameFromWebhook, userIcon: overriddenIcon});

        // # Post a message in test channel as otherUser
        postMessageInChannel(otherUser, testChannelUrl, messageWithTriggerWord);

        // # Verify overridden profile name and icon from posted webhook message
        verifyProfileNameAndIcon({username: usernameFromWebhook, userIcon: overriddenIcon});
    });

    it('MM-T2038 Bot posts as a comment/reply', () => {
        const newCallbackUrl = callbackUrl + '?response_type=comment';

        // # Visit test channel and post a message
        cy.visit(testChannelUrl);
        cy.postMessage('hello');

        // # Set outgoing webhook
        setOutgoingWebhook(testTeam.name, siteName, {callbackUrl: newCallbackUrl, triggerWord});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Edit outgoing webhook
        editOutgoingWebhook(testTeam.name, siteName, {callbackUrl: newCallbackUrl, withConfirmation: true});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Post a message in off-topic as testUser
        postMessageInChannel(testUser, offTopicUrl, messageWithTriggerWord);

        cy.getLastPost().should('contain', 'comment');
    });

    it('MM-T2039 Outgoing Webhooks - Reply to bot post', () => {
        const secondMessage = 'some text';

        // # Visit test channel and post a message
        cy.visit(testChannelUrl);
        cy.postMessage('hello');

        // # Set outgoing webhook
        setOutgoingWebhook(testTeam.name, siteName, {callbackUrl, triggerWord});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        // # Post a message in off-topic as testUser
        postMessageInChannel(testUser, offTopicUrl, messageWithTriggerWord);
        cy.postMessage(secondMessage);

        // # Post a reply on RHS to the webhook post
        cy.getNthPostId(-2).then((postId) => {
            cy.clickPostCommentIcon(postId);
            cy.uiGetRHS();
            cy.postMessageReplyInRHS('A reply to the webhook post');
            cy.wait(TIMEOUTS.HALF_SEC);
        });

        cy.uiGetPostHeader().contains('Commented on ' + sysadmin.username + '\'s message: #### Outgoing Webhook Payload');
    });

    it('MM-T2040 Disable overriding username and profile pic in System Console', () => {
        // # Visit test channel and post a message
        cy.visit(testChannelUrl);
        cy.postMessage('hello');

        // # Set outgoing webhook
        setOutgoingWebhook(testTeam.name, siteName, {callbackUrl, triggerWord});

        // * Verify it redirects to test channel
        cy.url().should('include', testChannelUrl);

        cy.apiAdminLogin();

        // # Enable user name and icon overrides
        enableUsernameAndIconOverride(true);

        // # Disable user name and icon overrides
        enableUsernameAndIconOverride(false);

        // # Post a message in off-topic as testUser
        postMessageInChannel(testUser, offTopicUrl, messageWithTriggerWord);

        // # Verify creator's profile name and icon from posted webhook message
        verifyProfileNameAndIcon({username: sysadmin.username, userId: sysadmin.id});
    });
});

function postMessageInChannel(user, channelUrl, message) {
    cy.apiLogin(user);
    cy.visit(channelUrl);
    cy.postMessage(message);
    cy.uiWaitUntilMessagePostedIncludes('#### Outgoing Webhook Payload');
}

function setOutgoingWebhook(teamName, siteName, {callbackUrl, channelSelect, triggerWord}) {
    cy.uiOpenProductMenu('Integrations');

    // * Verify that it redirects to integrations URL. Then, click "Outgoing Webhooks"
    cy.url().should('include', `${teamName}/integrations`);
    cy.get('.backstage-sidebar').should('be.visible').findByText('Outgoing Webhooks').click();

    // * Verify that it redirects to outgoing webhooks URL. Then, click "Add Outgoing Webhook"
    cy.url().should('include', `${teamName}/integrations/outgoing_webhooks`);
    cy.findByText('Add Outgoing Webhook').click();

    // * Verify that it redirects to where it can add outgoing webhook
    cy.url().should('include', `${teamName}/integrations/outgoing_webhooks/add`);

    // # Enter webhook details such as title, description and channel, then save
    cy.get('.backstage-form').should('be.visible').within(() => {
        cy.get('#displayName').type('Webhook Title');
        cy.get('#description').type('Webhook Description');

        if (triggerWord) {
            cy.get('#triggerWords').type(triggerWord);
        }
        if (channelSelect) {
            cy.get('#channelSelect').select(channelSelect);
        }
        cy.get('#callbackUrls').type(callbackUrl);
        cy.findByText('Save').scrollIntoView().should('be.visible').click();
    });

    // # Click "Done" and verify that it redirects to incoming webhooks URL
    cy.findByText('Done').click();
    cy.url().should('include', `${teamName}/integrations/outgoing_webhooks`);

    // # Click back to site name and verify that it redirects to test team/channel
    cy.findByText(`Back to ${siteName}`).click();
}

function editOutgoingWebhook(teamName, siteName, {username, iconUrl, callbackUrl, channelSelect, withConfirmation}) {
    cy.uiOpenProductMenu('Integrations');

    // * click "Outgoing Webhooks"
    cy.get('.backstage-sidebar').should('be.visible').findByText('Outgoing Webhooks').click();

    // * click "Edit"
    cy.get('.item-actions > a > span').click();

    // * Verify that it redirects to where it can add outgoing webhook
    cy.url().should('include', `${teamName}/integrations/outgoing_webhooks/edit`);

    // # Change the profile pic for the outgoing webhook
    cy.get('.backstage-form').should('be.visible').within(() => {
        if (username) {
            cy.get('#username').type(username);
        }
        if (iconUrl) {
            cy.get('#iconURL').scrollIntoView().type(iconUrl);
        }
        if (channelSelect) {
            cy.get('#channelSelect').select(channelSelect);
        }
        if (callbackUrl) {
            cy.get('#callbackUrls').type(callbackUrl);
        }

        cy.get('#saveWebhook').click().wait(TIMEOUTS.ONE_SEC);
    });

    if (withConfirmation) {
        cy.get('#confirmModalButton').should('be.visible').click();
    }

    // # Click back to site name and verify that it redirects to test team/channel
    cy.findByText(`Back to ${siteName}`).click();
}

function verifyProfileNameAndIcon({username, userIcon, userId}) {
    // * Verify the username
    cy.uiGetPostHeader().findByText(username);

    // * Verify the overridden user profile icon
    if (userIcon) {
        cy.uiGetPostProfileImage().
            find('img').
            invoke('attr', 'src').
            then((url) => cy.request({url, encoding: 'base64'})).
            then(({status, body}) => {
                cy.fixture(userIcon).then((imageData) => {
                    expect(status).to.equal(200);
                    expect(body).to.eq(imageData);
                });
            });
    }

    // * Verify the user profile icon
    if (userId) {
        cy.uiGetPostProfileImage().
            find('img').
            should('have.attr', 'src').
            and('include', `/api/v4/users/${userId}/image?_=`);
    }
}

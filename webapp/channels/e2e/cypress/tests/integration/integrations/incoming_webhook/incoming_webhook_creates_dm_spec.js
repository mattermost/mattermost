// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Stage: @dev
// Group: @incoming_webhook

import {enableUsernameAndIconOverride} from './helpers';

describe('Incoming webhook', () => {
    const incomingWebhookText = 'This is a message to a newly created direct message channel';
    let incomingWebhookConfiguration;
    let incomingWebhook;
    let generatedTeam;
    let generatedChannel;
    let generatedUser;

    before(() => {
        // # Enable username override
        enableUsernameAndIconOverride(true, false);

        // # Create a new user, their team, and a channel to tie the webhook to
        cy.apiInitSetup({userPrefix: 'mm-t639-'}).then(({team, channel, user}) => {
            generatedTeam = team;
            generatedChannel = channel;
            generatedUser = user;
            incomingWebhookConfiguration = {
                channel_id: channel.id,
                channel_locked: false,
                display_name: 'webhook',
            };
            cy.apiCreateWebhook(incomingWebhookConfiguration).then((hook) => {
                incomingWebhook = hook;
            });
        }).then(() => {
            // # Send webhook notification
            const webhookPayload = {channel: `@${generatedUser.username}`, text: incomingWebhookText};
            cy.postIncomingWebhook({url: incomingWebhook.url, data: webhookPayload});
        }).then(() => {
            // # Open any page to get to the sidebar
            cy.visit(`/${generatedTeam.name}/channels/${generatedChannel.name}`);
        });
    });

    it('MM-T639 🚀 incoming Webhook creates DM', () => {
        // # Verify that the channel was created correctly with an unread message, and open it
        cy.uiGetLHS().
            contains(generatedUser.username).
            should('have.class', 'unread-title').
            click();
        cy.getLastPost().within(($post) => {
            cy.wrap($post).contains(incomingWebhookConfiguration.display_name).should('be.visible');
            cy.wrap($post).contains('BOT').should('be.visible');
            cy.wrap($post).contains(incomingWebhookText).should('be.visible');
        });
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @incoming_webhook

import {getRandomId} from '../../../../utils';
import * as TIMEOUTS from '../../../../fixtures/timeouts';

import {enableUsernameAndIconOverride} from './helpers';

describe('Incoming webhook', () => {
    let sysadmin;
    let testTeam;
    let testChannel;
    let testUser;
    let incomingWebhook;

    before(() => {
        cy.apiGetMe().then(({user}) => {
            sysadmin = user;
        });
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team;
            testChannel = channel;
            testUser = user;

            const newHook = {
                channel_id: testChannel.id,
                channel_locked: true,
                description: 'Incoming webhook - override',
                display_name: `incoming-override-${getRandomId()}`,
            };

            cy.apiCreateWebhook(newHook).then((hook) => {
                incomingWebhook = hook;
            });
        });
    });

    it('MM-T622 Disallow override of username and profile picture', () => {
        const iconUrl = 'https://mattermost.com/wp-content/uploads/2022/02/icon_WS.png';

        // # Enable username and icon override
        cy.apiAdminLogin();
        enableUsernameAndIconOverride(true);

        // # Login as test user, visit test channel and post any message
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', testChannel.display_name);
        cy.postMessage('a');

        // # Post an incoming webhook
        const payload1 = getPayload(testChannel, iconUrl);
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload1, waitFor: 'text'});

        cy.getLastPost().within(() => {
            // * Verify that the message is posted via incoming webhook
            cy.findByText(payload1.text).should('be.visible');

            // * Verify that the username is overridden per webhook payload
            cy.get('.post__header').find('.user-popover').should('have.text', payload1.username);

            // * Verify that the user icon is overridden per webhook payload
            const encodedIconUrl = encodeURIComponent(payload1.icon_url);
            cy.get('.profile-icon > img').should('have.attr', 'src', `${Cypress.config('baseUrl')}/api/v4/image?url=${encodedIconUrl}`);
        });

        // # Disable username and icon override
        cy.apiAdminLogin();
        enableUsernameAndIconOverride(false);

        // # Login as test user, visit test channel and post any message
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam.name}/channels/${testChannel.name}`);
        cy.get('#channelHeaderTitle', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').and('have.text', testChannel.display_name);
        cy.postMessage('b');

        // # Post another incoming webhook
        const payload2 = getPayload(testChannel, iconUrl);
        cy.postIncomingWebhook({url: incomingWebhook.url, data: payload2, waitFor: 'text'});

        cy.getLastPost().within(() => {
            // * Verify that another message is posted via incoming webhook
            cy.findByText(payload2.text).should('be.visible');

            // * Verify that the username shown is of the webhook creator and override is not allowed.
            cy.get('.post__header').find('.user-popover').should('have.text', sysadmin.username);

            // * Verify that the user icon shown is of the webhook creator and override is not allowed.
            cy.get('.profile-icon > img').should('have.attr', 'src', `${Cypress.config('baseUrl')}/api/v4/users/${sysadmin.id}/image?_=0`);
        });

        // * Verify previous webhook message if new setting is respected.
        cy.uiGetNthPost(-3).within(() => {
            // * Verify that the post is from previous webhook message.
            cy.findByText(payload1.text).should('be.visible');

            // * Verify that the username shown is updated as webhook creator and override didn't take effect.
            cy.get('.post__header').find('.user-popover').should('have.text', sysadmin.username);

            // * Verify that the user icon shown is updated as webhook creator and override didn't take effect.
            cy.get('.profile-icon > img').should('have.attr', 'src', `${Cypress.config('baseUrl')}/api/v4/users/${sysadmin.id}/image?_=0`);
        });
    });
});

function getPayload(channel, iconUrl) {
    return {
        channel: channel.name,
        username: 'user-overriden',
        icon_url: iconUrl,
        text: `${getRandomId()} - this is from incoming webhook.`,
    };
}

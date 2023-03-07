// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @incoming_webhook

import {getRandomId} from '../../../utils';
import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Incoming webhook', () => {
    let testTeam;
    let incomingWebhook;

    before(() => {
        // # Create and visit new channel and create incoming webhook
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;

            const newIncomingHook = {
                channel_id: channel.id,
                channel_locked: false,
                description: 'Incoming webhook - setting',
                display_name: 'webhook-setting',
            };

            cy.apiCreateWebhook(newIncomingHook).then((hook) => {
                incomingWebhook = hook;
            });
        });
    });

    it('MM-T623 Lock to this channel on webhook configuration works', () => {
        cy.apiCreateChannel(testTeam.id, 'other-channel', 'Other Channel').then(({channel}) => {
            // # Post the first incoming webhook
            const payload1 = getPayload(channel);
            cy.postIncomingWebhook({url: incomingWebhook.url, data: payload1});

            // # Switch to other channel and wait for the first webhook message to get posted successfully
            switchToChannel(testTeam.name, channel.name);
            waitUntilWebhookPosted(payload1.text);

            // # Edit webhook to lock into the test channel
            editIncomingWebhook(incomingWebhook.id, testTeam.name, true);

            const payload2 = getPayload(channel);

            // # Try to post a second incoming webhook
            cy.task('postIncomingWebhook', {url: incomingWebhook.url, data: payload2}).then((res) => {
                // * Verify that it failed to post
                expect(res.status).equal(403);
                expect(res.data.message).equal('This webhook is not permitted to post to the requested channel.');
            });

            // # Edit webhook to not lock into the test channel
            editIncomingWebhook(incomingWebhook.id, testTeam.name, false);

            // # Retry posting the second incoming webhook
            cy.postIncomingWebhook({url: incomingWebhook.url, data: payload2});

            // # Switch to other channel and wait for the second webhook message to get posted
            switchToChannel(testTeam.name, channel.name);
            waitUntilWebhookPosted(payload2.text);
        });
    });
});

function switchToChannel(teamName, channelName) {
    cy.visit(`/${teamName}/channels/town-square`);
    cy.get(`#sidebarItem_${channelName}`, {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').click({force: true});
}

function editIncomingWebhook(incomingWebhookId, teamName, lockToChannel) {
    cy.visit(`/${teamName}/integrations/incoming_webhooks/edit?id=${incomingWebhookId}`);
    cy.get('.backstage-header', {timeout: TIMEOUTS.ONE_MIN}).should('be.visible').within(() => {
        cy.findByText('Incoming Webhooks').should('be.visible');
        cy.findByText('Edit').should('be.visible');
    });

    // # Check or uncheck "Lock to this channel"
    cy.findByLabelText('Lock to this channel').should('exist').as('lockChannel');
    if (lockToChannel) {
        cy.get('@lockChannel').check();
    } else {
        cy.get('@lockChannel').uncheck();
    }

    // # Click update and verify it redirects to incoming webhook page
    cy.findByText('Update').click();
    cy.url().should('include', `/${teamName}/integrations/incoming_webhooks`).wait(TIMEOUTS.ONE_SEC);
}

function getPayload(channel) {
    return {
        channel: channel.name,
        text: `${getRandomId()} - this is from incoming webhook`,
    };
}

function waitUntilWebhookPosted(text) {
    cy.waitUntil(() => cy.getLastPost().then((el) => {
        const postedMessageEl = el.find('.post-message__text > p')[0];
        return Boolean(postedMessageEl && postedMessageEl.textContent.includes(text));
    }));
}

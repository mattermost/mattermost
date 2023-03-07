// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @integrations

import * as TIMEOUTS from '../../../fixtures/timeouts';

describe('Integrations', () => {
    let testTeam;
    let testChannel;
    let testUser;
    let outgoingWebhook;

    before(() => {
        const callbackUrl = `${Cypress.env().webhookBaseUrl}/post_outgoing_webhook`;

        cy.requireWebhookServer();

        // # Create test team, channel, and webhook
        cy.apiInitSetup().then(({team, channel, user}) => {
            testTeam = team.name;
            testChannel = channel.name;
            testUser = user;

            const newOutgoingHook = {
                team_id: team.id,
                display_name: 'New Outgoing Webhook',
                trigger_words: ['testing'],
                callback_urls: [callbackUrl],
            };

            cy.apiCreateWebhook(newOutgoingHook, false).then((hook) => {
                outgoingWebhook = hook;

                cy.apiGetOutgoingWebhook(outgoingWebhook.id).then(({webhook, status}) => {
                    expect(status).equal(200);
                    expect(webhook.id).equal(outgoingWebhook.id);
                });
            });

            cy.apiLogin(user);
        });
    });

    it('MM-T617 Delete outgoing webhook', () => {
        // # Confirm outgoing webhook is working
        cy.visit(`/${testTeam}/channels/${testChannel}`);
        cy.postMessage('testing');
        cy.uiWaitUntilMessagePostedIncludes('Outgoing Webhook Payload');

        // # Login as sysadmin
        cy.apiAdminLogin();

        // * Assert from API that outgoing webhook is active
        cy.apiGetOutgoingWebhook(outgoingWebhook.id).then(({status}) => {
            expect(status).equal(200);
        });

        // # Delete outgoing webhook
        cy.visit(`/${testTeam}/integrations/outgoing_webhooks`);
        cy.findAllByText('Delete', {timeout: TIMEOUTS.ONE_MIN}).click();
        cy.get('#confirmModalButton').click();

        // * Assert the webhook has been deleted
        cy.findByText('No outgoing webhooks found').should('exist');
        cy.apiGetOutgoingWebhook(outgoingWebhook.id).then(({status}) => {
            expect(status).equal(404);
        });

        // * Return to app and assert trigger word no longer works
        cy.apiLogin(testUser);
        cy.visit(`/${testTeam}/channels/${testChannel}`);
        cy.postMessage('testing');

        // * Assert bot message does not arrive
        cy.wait(TIMEOUTS.TWO_SEC);
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${lastPostId}_message`).should('not.contain', 'Outgoing Webhook Payload');
        });

        // * Verify from API that outgoing webhook has been deleted
        cy.apiAdminLogin();
        cy.apiGetOutgoingWebhook(outgoingWebhook.id).then(({status}) => {
            expect(status).equal(404);
        });
    });
});

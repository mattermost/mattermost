// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

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

            cy.apiLogin(testUser);
        });
    });

    it('MM-T613 Disable outgoing webhooks in System Console', () => {
        // # Confirm outgoing webhook is working with trigger word
        cy.visit(`/${testTeam}/channels/${testChannel}`);
        cy.postMessage('testing');
        cy.uiWaitUntilMessagePostedIncludes('Outgoing Webhook Payload');

        // # Login as sysadmin
        cy.apiAdminLogin();

        // * Assert from API that outgoing webhook is active
        cy.apiGetOutgoingWebhook(outgoingWebhook.id).then(({status}) => {
            expect(status).equal(200);
        });

        // # Disable outgoing webhooks from console
        cy.visit('/admin_console/integrations/integration_management');
        cy.findByTestId('ServiceSettings.EnableOutgoingWebhooksfalse').click().should('be.checked');
        cy.get('#saveSetting').click();
        cy.get('#saveSetting').should('be.disabled');

        // * Assert from API that outgoing webhook has been disabled
        cy.apiAdminLogin();
        cy.apiGetOutgoingWebhook(outgoingWebhook.id).then(({status}) => {
            expect(status).equal(501);
        });

        // # Login as regular user
        cy.apiLogin(testUser);

        // * Assert that trigger word no longer triggers webhook
        cy.visit(`/${testTeam}/channels/${testChannel}`);
        cy.postMessage('testing');
        cy.wait(TIMEOUTS.TWO_SEC);
        cy.getLastPostId().then((lastPostId) => {
            cy.get(`#${lastPostId}_message`).should('not.contain', 'Outgoing Webhook Payload');
        });

        // # Login as sysadmin
        cy.apiAdminLogin();

        // # Re-enable outgoing webhooks from console
        cy.visit('/admin_console/integrations/integration_management');
        cy.findByTestId('ServiceSettings.EnableOutgoingWebhookstrue').click().should('be.checked');
        cy.get('#saveSetting').click();

        // * Assert from API that outgoing webhook is active
        cy.apiGetOutgoingWebhook(outgoingWebhook.id).then(({status}) => {
            expect(status).equal(200);
        });

        // # Login as regular user
        cy.apiLogin(testUser);

        // * Assert outgoing webhook is working with trigger word
        cy.visit(`/${testTeam}/channels/${testChannel}`);
        cy.postMessage('testing');
        cy.uiWaitUntilMessagePostedIncludes('Outgoing Webhook Payload');
    });
});

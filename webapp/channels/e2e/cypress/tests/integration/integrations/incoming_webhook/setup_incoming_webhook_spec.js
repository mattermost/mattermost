// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @incoming_webhook

import {enableUsernameAndIconOverride} from './helpers';

describe('Incoming webhook', () => {
    let testTeam;
    let testChannel;
    let siteName;

    before(() => {
        cy.apiGetConfig().then(({config}) => {
            siteName = config.TeamSettings.SiteName;
        });
        cy.apiInitSetup().then(({team, channel}) => {
            testTeam = team;
            testChannel = channel;
        });
    });

    it('MM-T2029 Setup for incoming webhook', () => {
        // # Enable username and icon override at system console
        cy.apiAdminLogin();
        enableUsernameAndIconOverride(true);

        // # Go to test team/channel, open product menu and click "Integrations"
        cy.visit(`${testTeam.name}/channels/${testChannel.name}`);
        cy.uiOpenProductMenu('Integrations');

        // * Verify that it redirects to integrations URL. Then, click "Incoming Webhooks"
        cy.url().should('include', `${testTeam.name}/integrations`);
        cy.get('.backstage-sidebar').should('be.visible').findByText('Incoming Webhooks').click();

        // * Verify that it redirects to incoming webhooks URL. Then, click "Add Incoming Webhook"
        cy.url().should('include', `${testTeam.name}/integrations/incoming_webhooks`);
        cy.findByText('Add Incoming Webhook').click();

        // * Verify that it redirects to where it can add incoming webhook
        cy.url().should('include', `${testTeam.name}/integrations/incoming_webhooks/add`);

        // # Enter webhook details such as title, description and channel, then save
        cy.get('.backstage-form').should('be.visible').within(() => {
            cy.get('#displayName').type('Webhook Title');
            cy.get('#description').type('Webhook Description');
            cy.get('#channelSelect').select(testChannel.display_name);
            cy.findByText('Save').scrollIntoView().click();
        });

        // * Verify that it redirects to incoming webhook confirmation URL
        cy.url().should('include', `${testTeam.name}/integrations/confirm?type=incoming_webhooks&id=`).
            invoke('toString').then((hookConfirmationUrl) => {
                const hookId = hookConfirmationUrl.split('id=')[1];
                const hookUrl = `${Cypress.config('baseUrl')}/hooks/${hookId}`;

                // * Verify that the hook ID in the URL matches with the one shown in a page
                // * Verify that the copy link is shown.
                cy.findByText(hookUrl).should('be.visible').
                    parent().siblings('.fa-copy').should('be.visible');

                // # Click "Done" and verify that it redirects to incoming webhooks URL
                cy.findByText('Done').click();
                cy.url().should('include', `${testTeam.name}/integrations/incoming_webhooks`);

                // # Click back to site name and verify that it redirects to test team/channel
                cy.findByText(`Back to ${siteName}`).click();
                cy.url().should('include', `${testTeam.name}/channels/${testChannel.name}`);

                // # Post an incoming webhook and verify that it is posted in the channel
                const payload = {
                    channel: testChannel.name,
                    username: 'new-username',
                    text: 'Setup for incoming webhook.',
                };
                cy.postIncomingWebhook({url: hookUrl, data: payload, waitFor: 'text'});
            });
    });
});

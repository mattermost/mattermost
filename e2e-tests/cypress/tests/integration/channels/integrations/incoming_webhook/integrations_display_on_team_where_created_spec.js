// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @integrations

describe('Integrations', () => {
    let teamA;
    let teamB;
    let newIncomingHook;

    before(() => {
        // # Login, create incoming webhook for Team A
        cy.apiInitSetup().then(({team, channel}) => {
            teamA = team.name;
            newIncomingHook = {
                channel_id: channel.id,
                display_name: 'Team A Webhook',
            };

            //# Create a new webhook for Team A
            cy.apiCreateWebhook(newIncomingHook);
        });

        // # Login, create incoming webhook for Team B
        cy.apiInitSetup().then(({team, channel}) => {
            teamB = team.name;
            newIncomingHook = {
                channel_id: channel.id,
                display_name: 'Team B Webhook',
            };

            // # Create a new webhook for Team B
            cy.apiCreateWebhook(newIncomingHook);
        });
    });

    it('MM-T644 Integrations display on team where they were created', () => {
        // # Visit Test Team B Incoming Webhooks page
        cy.visit(`/${teamB}/integrations/incoming_webhooks`);

        // * Assert the page contains only Team B Outgoing Webhook
        cy.findByText('Team B Webhook').and('does.not.contain', 'Team A Webhook');

        // # Visit Team A Incoming Webhooks page
        cy.visit(`/${teamA}/integrations/incoming_webhooks`);

        // * Assert the page contains only Team A Outgoing Webhook
        cy.findByText('Team A Webhook').and('does.not.contain', 'Team B Webhook');
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @integrations

/**
* Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
*/

describe('Integrations', () => {
    let testTeam;
    let offTopicChannel;

    before(() => {
        cy.requireWebhookServer();

        cy.apiInitSetup().then(({team}) => {
            testTeam = team;

            cy.apiGetChannelByName(team.name, 'off-topic').then(({channel}) => {
                offTopicChannel = channel;
            });
        });
    });

    beforeEach(() => {
        // # Visit town-square
        cy.visit(`/${testTeam.name}/channels/town-square`);
    });

    it('MM-T706 Error Handling for Slash Commands', () => {
        const command = {
            auto_complete: false,
            description: 'Test for Slash Command',
            display_name: 'Send message to different channel via slash command',
            icon_url: '',
            method: 'P',
            team_id: testTeam.id,
            trigger: 'error_handling',
            url: `${Cypress.env().webhookBaseUrl}/send_message_to_channel?type=system_message&channel_id=${offTopicChannel.id}`,
            username: '',
        };

        // # Create a slash command
        cy.apiCreateCommand(command).then(({data: slashCommand}) => {
            // * Verify that off-topic channel is read
            cy.findByLabelText('off-topic public channel').should('exist');

            // # Post a slash command that sends message to off-topic channel
            cy.uiGetPostTextBox().
                clear().
                type(`/${slashCommand.trigger} {enter}`);

            // * Verify slash command error
            cy.findByText(`Command '${slashCommand.trigger}' failed to post response. Please contact your System Administrator.`).should('be.visible');

            // * Verify that off-topic channel is unread and then click
            cy.findByLabelText('off-topic public channel unread').
                should('exist').
                click();

            // * Verify that only "Hello World" is posted in off-topic channel
            cy.uiWaitUntilMessagePostedIncludes('Hello World');
            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`).should('be.visible').and('have.text', 'Hello World');
            });
            cy.getNthPostId(-2).then((postId) => {
                cy.get(`#postMessageText_${postId}`).should('be.visible').and('not.have.text', 'Extra response 2');
            });
        });
    });

    it('MM-T707 Send a message to a different channel than where the slash command was issued from', () => {
        const command = {
            auto_complete: false,
            description: 'Test for Slash Command',
            display_name: 'Send message to different channel via slash command',
            icon_url: '',
            method: 'P',
            team_id: testTeam.id,
            trigger: 'send_message_from_different_channel',
            url: `${Cypress.env().webhookBaseUrl}/send_message_to_channel?channel_id=${offTopicChannel.id}`,
            username: '',
        };

        // # Create a slash command
        cy.apiCreateCommand(command).then(({data: slashCommand}) => {
            // * Verify that off-topic channel is read
            cy.findByLabelText('off-topic public channel').should('exist');

            // # Post a slash command that sends message to off-topic channel
            cy.postMessage(`/${slashCommand.trigger} `);

            // * Verify that off-topic channel is unread and then click
            cy.findByLabelText('off-topic public channel unread').
                should('exist').
                click();

            // * Verify that both messages are posted in off-topic channel
            cy.uiWaitUntilMessagePostedIncludes('Hello World');
            cy.getLastPostId().then((postId) => {
                cy.get(`#postMessageText_${postId}`).should('be.visible').and('have.text', 'Hello World');
            });
            cy.getNthPostId(-2).then((postId) => {
                cy.get(`#postMessageText_${postId}`).should('be.visible').and('have.text', 'Extra response 2');
            });
        });
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as TIMEOUTS from '../../../fixtures/timeouts';

export function addNewCommand(team, trigger, url) {
    // # Open slash command page
    cy.visit(`/${team.name}/integrations/commands/installed`);

    // # Add new command
    cy.get('#addSlashCommand').click();

    // # Type a trigger word, url and display name
    cy.get('#trigger').type(trigger);
    cy.get('#displayName').type('Test Message');
    cy.apiGetChannelByName(team.name, 'town-square').then(({channel}) => {
        let urlToType = url;
        if (url === '') {
            urlToType = `${Cypress.env('webhookBaseUrl')}/send_message_to_channel?channel_id=${channel.id}`;
        }
        cy.get('#url').type(urlToType);

        // # Save
        cy.get('#saveCommand').click();

        // * Verify we are at setup successful URL
        cy.url().should('include', '/integrations/commands/confirm');

        // * Verify slash was successfully created
        cy.findByText('Setup Successful').should('exist').and('be.visible');

        // * Verify token was created
        cy.findByText('Token').should('exist').and('be.visible');
    });
}

/**
 * @param {*} linkToVisit : Channel / Group message / DM link to visit
 * @param {*} trigger : Slash command trigger
 */
export function runSlashCommand(linkToVisit, trigger) {
    // # Go back to home channel
    cy.visit(linkToVisit);

    // # Run slash command
    cy.uiGetPostTextBox().clear().type(`/${trigger}{enter}{enter}`);
    cy.wait(TIMEOUTS.TWO_SEC);

    // # Get last post message text
    cy.getLastPostId().then((postId) => {
        cy.get(`#post_${postId}`).get('.Tag').contains('BOT');
    });
}

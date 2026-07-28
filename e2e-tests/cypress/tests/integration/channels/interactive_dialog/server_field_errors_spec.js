// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @not_cloud @interactive_dialog

/**
 * Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
 *
 * Covers SubmitDialogResponse.errors from the integration (no top-level `error`
 * string) on the legacy Interactive Dialog → BlocksDialogShell path.
 */

const webhookUtils = require('../../../../utils/webhook_utils');

let createdCommand;
let serverFieldErrorsDialog;

describe('Interactive Dialog - server field errors', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.requireWebhookServer();

        cy.apiSaveTeammateNameDisplayPreference('username');

        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.expose().webhookBaseUrl;

            const command = {
                auto_complete: false,
                description: 'Test for server-returned dialog field errors',
                display_name: 'Server Field Errors Dialog',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'server_field_errors_dialog',
                url: `${webhookBaseUrl}/server_field_errors_dialog_request`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;
                serverFieldErrorsDialog = webhookUtils.getServerFieldErrorsDialog(createdCommand.id, webhookBaseUrl);
            });
        });
    });

    afterEach(() => {
        cy.reload();
    });

    it('MM-T6074 - Submit keeps dialog open and shows integration field errors', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify dialog opens with pre-filled values (client validation will pass)
        cy.get('#appsModal').should('be.visible').within(() => {
            cy.get('#appsModalLabel').should('have.text', serverFieldErrorsDialog.dialog.title);
            cy.get('#realname').should('have.value', 'Ada');
            cy.get('#someemail').should('have.value', 'ada@example.com');

            // # Submit — integration returns {errors: {...}} with no top-level error
            cy.get('#appsModalSubmit').click();

            // * Dialog stays open
            cy.root().should('be.visible');

            // * Per-field errors from the integration are shown
            cy.get('[data-testid="realname-error"]').
                should('be.visible').
                and('contain', 'Name was rejected by the integration');
            cy.get('[data-testid="someemail-error"]').
                should('be.visible').
                and('contain', 'Email was rejected by the integration');
        });
    });
});

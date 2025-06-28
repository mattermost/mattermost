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
*/

import * as TIMEOUTS from '../../../fixtures/timeouts';

const webhookUtils = require('../../../../utils/webhook_utils');

let createdCommand;
let simpleDialog;

describe('Interactive Dialog - Apps Form without element', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.requireWebhookServer();

        // # Ensure that teammate name display setting is set to default 'username'
        cy.apiSaveTeammateNameDisplayPreference('username');

        // # Create new team and create command on it
        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.env().webhookBaseUrl;

            const command = {
                auto_complete: false,
                description: 'Test for simple dialog - no element',
                display_name: 'Simple Dialog without element',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'simple_dialog',
                url: `${webhookBaseUrl}/simple_dialog_request`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;
                simpleDialog = webhookUtils.getSimpleDialog(createdCommand.id, webhookBaseUrl);
            });
        });
    });

    afterEach(() => {
        // # Reload current page after each test to close any dialogs left open
        cy.reload();
    });

    it('MM-T2500_1 UI check', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify that the header of modal contains icon URL, title and close button
            cy.get('.modal-header').should('be.visible').within(($elForm) => {
                cy.get('#appsModalIconUrl').should('be.visible').and('have.attr', 'src').and('not.be.empty');
                cy.get('#appsModalLabel').should('be.visible').and('have.text', simpleDialog.dialog.title);
                cy.wrap($elForm).find('button.close').should('be.visible').and('contain', '×').and('contain', 'Close');
            });

            // * Verify that the body exists but has no form fields (AppsForm always renders modal-body)
            cy.get('.modal-body').should('be.visible');
            cy.get('.modal-body').find('.form-group').should('not.exist');

            // * Verify that the footer contains cancel and submit buttons
            cy.get('.modal-footer').should('be.visible').within(($elForm) => {
                cy.wrap($elForm).find('#appsModalCancel').should('be.visible').and('have.text', 'Cancel');
                cy.wrap($elForm).find('#appsModalSubmit').should('be.visible').and('have.text', simpleDialog.dialog.submit_label);
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2500_2 "X" closes the dialog', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible');

        // # Click "X" button from the modal
        cy.get('.modal-header').should('be.visible').within(($elForm) => {
            cy.wrap($elForm).find('button.close').should('be.visible').click().wait(TIMEOUTS.FIVE_SEC);
        });

        // * Verify that the apps form modal is closed
        cy.get('#appsModal').should('not.exist');

        // * Verify that the last post states that the dialog is cancelled
        cy.getLastPost().should('contain', 'Dialog cancelled');
    });

    it('MM-T2500_3 Cancel button works', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible');

        // # Click cancel from the modal
        cy.get('#appsModalCancel').click().wait(TIMEOUTS.FIVE_SEC);

        // * Verify that the apps form modal is closed
        cy.get('#appsModal').should('not.exist');

        // * Verify that the last post states that the dialog is cancelled
        cy.getLastPost().should('contain', 'Dialog cancelled');
    });

    it('MM-T2500_4 Submit button works', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible');

        // # Click submit from the modal
        cy.get('#appsModalSubmit').click();

        // * Verify that the apps form modal is closed
        cy.get('#appsModal').should('not.exist');

        // * Verify that the last post states that the dialog is submitted
        cy.getLastPost().should('contain', 'Dialog submitted');
    });
});

function closeAppsFormModal() {
    cy.get('.modal-header').should('be.visible').within(($elForm) => {
        cy.wrap($elForm).find('button.close').should('be.visible').click();
    });
    cy.get('#appsModal').should('not.exist');
}

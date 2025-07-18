// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @interactive_dialog

/**
* Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
*/

const webhookUtils = require('../../../../utils/webhook_utils');

let createdCommand;
let simpleDialog;

describe('Interactive Dialog - Apps Form', () => {
    before(() => {
        // # Ensure that teammate name display setting is set to default 'username'
        cy.apiSaveTeammateNameDisplayPreference('username');

        cy.requireWebhookServer();

        // # Create new team and create command on it
        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.env().webhookBaseUrl;

            const command = {
                auto_complete: false,
                description: 'Test for boolean dialog',
                display_name: 'Simple Dialog with boolean element',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'boolean_dialog',
                url: `${webhookBaseUrl}/boolean_dialog_request`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;
                simpleDialog = webhookUtils.getBooleanDialog(createdCommand.id, webhookBaseUrl);
            });
        });
    });

    it('MM-T2502 - Boolean element check', () => {
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

            // * Verify that the body contains the boolean element
            cy.get('.modal-body').should('be.visible').children('.form-group').should('have.length', 1).each(($elForm, index) => {
                const element = simpleDialog.dialog.elements[index];
                expect(element.name).to.equal('boolean_input');

                cy.wrap($elForm).within(() => {
                    // Verify the label text includes display name
                    cy.get('label').first().scrollIntoView().should('be.visible').and('contain', element.display_name);

                    // Verify the checkbox structure
                    cy.get('.checkbox').should('be.visible').within(() => {
                        cy.get('input[type=\'checkbox\']').
                            should('be.visible').
                            and('be.checked');

                        cy.get('span').should('have.text', element.placeholder);
                    });

                    // Verify help text if present
                    if (element.help_text) {
                        cy.get('.help-text').should('be.visible').and('contain', element.help_text);
                    }
                });
            });

            // * Verify that the footer contains cancel and submit buttons
            cy.get('.modal-footer').should('be.visible').within(($elForm) => {
                cy.wrap($elForm).find('#appsModalCancel').should('be.visible').and('have.text', 'Cancel');
                cy.wrap($elForm).find('#appsModalSubmit').should('be.visible').and('have.text', simpleDialog.dialog.submit_label);
            });

            closeAppsFormModal();
        });
    });
});

function closeAppsFormModal() {
    cy.get('.modal-header').should('be.visible').within(($elForm) => {
        cy.wrap($elForm).find('button.close').should('be.visible').click();
    });
    cy.get('#appsModal').should('not.exist');
}

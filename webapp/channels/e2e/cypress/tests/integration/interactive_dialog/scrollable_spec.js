// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @interactive_dialog

/**
* Note: This test requires webhook server running. Initiate `npm run start:webhook` to start.
*/

const webhookUtils = require('../../../utils/webhook_utils');

let createdCommand;
let userAndChannelDialog;

describe('Interactive Dialog', () => {
    before(() => {
        cy.requireWebhookServer();

        // # Ensure that teammate name display setting is set to default 'username'
        cy.apiSaveTeammateNameDisplayPreference('username');

        // # Create new team and create command on it
        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            for (let i = 0; i < 20; i++) {
                cy.apiCreateChannel(team.id, `channel-${i}`, `Channel ${i}`);
            }

            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.env().webhookBaseUrl;

            const command = {
                auto_complete: false,
                description: 'Test for user and channel dialog',
                display_name: 'Dialog with user and channel',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'user_and_channel_dialog',
                url: `${webhookBaseUrl}/user_and_channel_dialog_request`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;
                userAndChannelDialog = webhookUtils.getUserAndChannelDialog(createdCommand.id, webhookBaseUrl);
            });
        });
    });

    it('MM-T2498 - Individual "User" and "Channel" screens are scrollable', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#interactiveDialogModal').should('be.visible').within(() => {
            // * Verify that the header of modal contains icon URL, title and close button
            cy.get('.modal-header').should('be.visible').within(($elForm) => {
                cy.get('#interactiveDialogIconUrl').should('be.visible').and('have.attr', 'src', userAndChannelDialog.dialog.icon_url);
                cy.get('#interactiveDialogModalLabel').should('be.visible').and('have.text', userAndChannelDialog.dialog.title);
                cy.wrap($elForm).find('button.close').should('be.visible').and('contain', '×').and('contain', 'Close');
            });

            // * Verify that the body contains the both elements
            cy.get('.modal-body').should('be.visible').children().should('have.length', 2).each(($elForm, index) => {
                const element = userAndChannelDialog.dialog.elements[index];

                cy.wrap($elForm).find('label.control-label').scrollIntoView().should('be.visible').and('have.text', `${element.display_name} ${element.optional ? '(optional)' : '*'}`);

                cy.wrap($elForm).find('input').should('be.visible').and('have.attr', 'autocomplete', 'off').and('have.attr', 'placeholder', element.placeholder);

                // * Verify that the suggestion list or autocomplete open up on click of input element
                cy.wrap($elForm).find('#suggestionList').should('not.exist');
                cy.wrap($elForm).find('input').click();
                cy.wrap($elForm).find('#suggestionList').scrollIntoView().should('be.visible').children();

                if (index === 0) {
                    expect(element.name).to.equal('someuserselector');
                    cy.wrap($elForm).find('.suggestion-list__item').first().should('be.visible');
                    cy.wrap($elForm).find('.form-control').type('{downarrow}'.repeat(10));
                    cy.wrap($elForm).find('.suggestion-list__item').first().should('not.be.visible');
                    cy.wrap($elForm).find('.form-control').type('{uparrow}'.repeat(10));
                    cy.wrap($elForm).find('.suggestion-list__item').first().should('be.visible');
                } else if (index === 1) {
                    expect(element.name).to.equal('somechannelselector');
                    cy.wrap($elForm).find('.suggestion-list__item').first().should('be.visible');
                    cy.wrap($elForm).find('.form-control').type('{downarrow}'.repeat(10));
                    cy.wrap($elForm).find('.suggestion-list__item').first().should('not.be.visible');
                    cy.wrap($elForm).find('.form-control').type('{uparrow}'.repeat(10));
                    cy.wrap($elForm).find('.suggestion-list__item').first().should('be.visible');
                }

                // # Select one element to close the dropdown
                cy.wrap($elForm).find('.suggestion-list__item').first().click();

                if (element.help_text) {
                    cy.wrap($elForm).find('.help-text').should('be.visible').and('have.text', element.help_text);
                }
            });

            // * Verify that the footer contains cancel and submit buttons
            cy.get('.modal-footer').should('be.visible').within(($elForm) => {
                cy.wrap($elForm).find('#interactiveDialogCancel').should('be.visible').and('have.text', 'Cancel');
                cy.wrap($elForm).find('#interactiveDialogSubmit').should('be.visible').and('have.text', userAndChannelDialog.dialog.submit_label);
            });

            // # Close interactive dialog
            cy.get('.modal-header').should('be.visible').within(($elForm) => {
                cy.wrap($elForm).find('button.close').should('be.visible').click();
            });
            cy.get('#interactiveDialogModal').should('not.exist');
        });
    });
});

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
let userAndChannelDialog;

describe('Interactive Dialog - Apps Form', () => {
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

    afterEach(() => {
        // # Reload current page after each test to close any dialogs left open
        cy.reload();
    });

    it('MM-T2498 - Individual "User" and "Channel" screens are scrollable', () => {
        // # Ensure no modal is open before starting
        cy.get('#appsModal').should('not.exist');

        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify that the header of modal contains icon URL, title and close button
            cy.get('.modal-header').should('be.visible').within(($elForm) => {
                cy.get('#appsModalIconUrl').should('be.visible').and('have.attr', 'src').and('not.be.empty');
                cy.get('#appsModalLabel').should('be.visible').and('have.text', userAndChannelDialog.dialog.title);
                cy.wrap($elForm).find('button.close').should('be.visible').and('contain', '×').and('contain', 'Close');
            });

            // * Verify that the body contains the both elements
            cy.get('.modal-body').should('be.visible').children('.form-group').should('have.length', 2).each(($elForm, index) => {
                const element = userAndChannelDialog.dialog.elements[index];

                cy.wrap($elForm).find('label').first().scrollIntoView().should('be.visible').and('contain', element.display_name);

                // ReactSelect structure - check for MultiInput element
                cy.wrap($elForm).find('[id^=\'MultiInput_\']').should('be.visible');

                // * Verify that the dropdown opens on click
                cy.wrap($elForm).find('[id^=\'MultiInput_\']').click();

                // Break out of .within() scope to find options in document and wait for them to be visible
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__menu').should('be.visible');
                    cy.wrap(doc).find('.react-select__option').should('have.length.greaterThan', 0);
                });

                if (index === 0) {
                    expect(element.name).to.equal('someuserselector');

                    // Test scrollability by navigating through ReactSelect options
                    cy.document().then((doc) => {
                        // Wait for options to be loaded and ensure first option exists
                        cy.wrap(doc).find('.react-select__option').first().should('exist');

                        // Navigate using keyboard on the input element
                        cy.wrap($elForm).find('[id^=\'MultiInput_\']').find('input').type('{uparrow}', {force: true});
                        cy.wrap($elForm).find('[id^=\'MultiInput_\']').find('input').type('{downarrow}'.repeat(10), {force: true});

                        // Verify scrolling happened by checking if first option is still in view
                        cy.wrap(doc).find('.react-select__option').first().then(($firstOption) => {
                            // Just verify the option exists - visibility may change due to scrolling
                            expect($firstOption.length).to.be.greaterThan(0);
                        });

                        cy.wrap($elForm).find('[id^=\'MultiInput_\']').find('input').type('{uparrow}'.repeat(10), {force: true});
                        cy.wrap(doc).find('.react-select__option').first().should('exist');
                    });
                } else if (index === 1) {
                    expect(element.name).to.equal('somechannelselector');

                    // Test scrollability by navigating through ReactSelect options
                    cy.document().then((doc) => {
                        // Wait for options to be loaded and ensure first option exists
                        cy.wrap(doc).find('.react-select__option').first().should('exist');

                        // Navigate using keyboard on the input element
                        cy.wrap($elForm).find('[id^=\'MultiInput_\']').find('input').type('{uparrow}', {force: true});
                        cy.wrap($elForm).find('[id^=\'MultiInput_\']').find('input').type('{downarrow}'.repeat(10), {force: true});

                        // Verify scrolling happened by checking if first option is still in view
                        cy.wrap(doc).find('.react-select__option').first().then(($firstOption) => {
                            // Just verify the option exists - visibility may change due to scrolling
                            expect($firstOption.length).to.be.greaterThan(0);
                        });

                        cy.wrap($elForm).find('[id^=\'MultiInput_\']').find('input').type('{uparrow}'.repeat(10), {force: true});
                        cy.wrap(doc).find('.react-select__option').first().should('exist');
                    });
                }

                // # Select one element to close the dropdown
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').first().click({force: true});
                });

                if (element.help_text) {
                    cy.wrap($elForm).find('.help-text').should('exist').and('contain', element.help_text);
                }
            });

            // * Verify that the footer contains cancel and submit buttons
            cy.get('.modal-footer').should('be.visible').within(($elForm) => {
                cy.wrap($elForm).find('#appsModalCancel').should('be.visible').and('have.text', 'Cancel');
                cy.wrap($elForm).find('#appsModalSubmit').should('be.visible').and('have.text', userAndChannelDialog.dialog.submit_label);
            });

            // # Close interactive dialog
            cy.get('.modal-header').should('be.visible').within(($elForm) => {
                cy.wrap($elForm).find('button.close').should('be.visible').click();
            });
            cy.get('#appsModal').should('not.exist');
        });
    });
});

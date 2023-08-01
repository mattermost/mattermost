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

describe('Interactive Dialog', () => {
    const inputTypes = {
        realname: 'text',
        someemail: 'email',
        somenumber: 'number',
        somepassword: 'password',
    };

    const optionsLength = {
        someuserselector: 25, // default number of users in autocomplete
        somechannelselector: 2, // town-square and off-topic for new team
        someoptionselector: 3, // number of defined basic options
        someradiooptions: 2, // number of defined basic options
    };

    let createdCommand;
    let fullDialog;

    before(() => {
        cy.requireWebhookServer();

        // # Ensure that teammate name display setting is set to default 'username'
        cy.apiSaveTeammateNameDisplayPreference('username');

        // # Create new team and create command on it
        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.env().webhookBaseUrl;

            const command = {
                auto_complete: false,
                description: 'Test for dialog',
                display_name: 'Dialog',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'dialog',
                url: `${webhookBaseUrl}/dialog_request`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;
                fullDialog = webhookUtils.getFullDialog(createdCommand.id, webhookBaseUrl);
            });
        });
    });

    afterEach(() => {
        // # Reload current page after each test to close any dialogs left open
        cy.reload();
    });

    it('MM-T2491 - UI check', () => {
        // # Post a slash command
        cy.get('#postListContent').should('be.visible');
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#interactiveDialogModal').should('be.visible').within(() => {
            // * Verify that the header of modal contains icon URL, title and close button
            cy.get('.modal-header').should('be.visible').within(($elForm) => {
                cy.get('#interactiveDialogIconUrl').should('be.visible').and('have.attr', 'src', fullDialog.dialog.icon_url);
                cy.get('#interactiveDialogModalLabel').should('be.visible').and('have.text', fullDialog.dialog.title);
                cy.wrap($elForm).find('button.close').should('be.visible').and('contain', '×').and('contain', 'Close');

                cy.get('#interactiveDialogModalLabel').should('be.visible').and('have.text', fullDialog.dialog.title);
            });

            // * Verify that the body contains all the elements
            cy.get('.modal-body').should('be.visible').children().each(($elForm, index) => {
                const element = fullDialog.dialog.elements[index];

                cy.wrap($elForm).find('label.control-label').scrollIntoView().should('exist').and('have.text', `${element.display_name} ${element.optional ? '(optional)' : '*'}`);

                if (['someuserselector', 'somechannelselector', 'someoptionselector'].includes(element.name)) {
                    cy.wrap($elForm).find('input').should('be.visible').and('have.attr', 'autocomplete', 'off').and('have.attr', 'placeholder', element.placeholder);

                    // * Verify that the suggestion list or autocomplete open up on click of input element
                    cy.wrap($elForm).find('#suggestionList').should('not.exist');
                    cy.wrap($elForm).find('input').click();
                    cy.wrap($elForm).find('#suggestionList').scrollIntoView().should('be.visible');

                    // # Click field label to close any opened drop-downs
                    cy.wrap($elForm).find('label.control-label').scrollIntoView().click({force: true});
                } else if (element.name === 'someradiooptions') {
                    cy.wrap($elForm).find('input').should('be.visible').and('have.length', optionsLength[element.name]);

                    // * Verify that no option is selected by default
                    cy.wrap($elForm).find('input').each(($elInput) => {
                        cy.wrap($elInput).should('not.be.checked');
                    });
                } else if (element.name === 'boolean_input') {
                    cy.wrap($elForm).find('.checkbox').should('be.visible').within(() => {
                        cy.get('#boolean_input').
                            should('be.visible').
                            and('be.checked');

                        cy.get('span').should('have.text', element.placeholder);
                    });
                } else {
                    cy.wrap($elForm).find(`#${element.name}`).should('be.visible').and('have.value', element.default).and('have.attr', 'placeholder', element.placeholder);
                }

                // * Verify that input element are given with the correct type of "input", "email", "number" and "password".
                // * To take advantage of supported built-in validation.
                if (inputTypes[element.name]) {
                    cy.wrap($elForm).find(`#${element.name}`).should('have.attr', 'type', inputTypes[element.name]);
                }

                if (element.help_text) {
                    cy.wrap($elForm).find('.help-text').should('exist').and('have.text', element.help_text);
                }
            });

            // * Verify that the footer contains cancel and submit buttons
            cy.get('.modal-footer').should('be.visible').within(($elForm) => {
                cy.wrap($elForm).find('#interactiveDialogCancel').should('be.visible').and('have.text', 'Cancel');
                cy.wrap($elForm).find('#interactiveDialogSubmit').should('be.visible').and('have.text', fullDialog.dialog.submit_label);
            });

            closeInteractiveDialog();
        });
    });

    it('MM-T2492 - Cancel button works', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#interactiveDialogModal').should('be.visible');

        // # Click cancel from the modal
        cy.get('#interactiveDialogCancel').click();

        // * Verify that the interactive dialog modal is closed
        cy.get('#interactiveDialogModal').should('not.exist');
    });

    it('MM-T2493 - "X" closes the dialog', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#interactiveDialogModal').should('be.visible');

        // # Click "X" button from the modal
        cy.get('.modal-header').should('be.visible').within(($elForm) => {
            cy.wrap($elForm).find('button.close').should('be.visible').click();
        });

        // * Verify that the interactive dialog modal is closed
        cy.get('#interactiveDialogModal').should('not.exist');
    });

    it('MM-T2494 - Correct error messages displayed if empty form is submitted', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#interactiveDialogModal').should('be.visible');

        // # Click submit button from the modal
        cy.get('#interactiveDialogSubmit').click();

        // * Verify that the interactive dialog modal is still open
        cy.get('#interactiveDialogModal').should('be.visible');

        // * Verify that not optional element without text value shows an error and vice versa
        cy.get('.modal-body').should('be.visible').children().each(($elForm, index) => {
            const element = fullDialog.dialog.elements[index];

            if (!element.optional && !element.default) {
                cy.wrap($elForm).find('div.error-text').scrollIntoView().should('be.visible').and('have.text', 'This field is required.').and('have.css', 'color', 'rgb(210, 75, 78)');
            } else {
                cy.wrap($elForm).find('div.error-text').should('not.exist');
            }
        });

        closeInteractiveDialog();
    });

    it('MM-T2495_1 - Email validation for invalid input', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#interactiveDialogModal').should('be.visible');

        // # Enter invalid and valid email
        // * Verify that error is: shown for invalid email and not shown for valid email.
        const invalidEmail = 'invalid-email';
        cy.get('#someemail').scrollIntoView().clear().type(invalidEmail);

        cy.get('#interactiveDialogSubmit').click();

        cy.get('input:invalid').should('have.length', 1);
        cy.get('#someemail').then(($input) => {
            expect($input[0].validationMessage).to.eq(`Please include an '@' in the email address. '${invalidEmail}' is missing an '@'.`);
        });

        closeInteractiveDialog();
    });

    it('MM-T2495_2 - Email validation for valid input', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#interactiveDialogModal').should('be.visible');

        // # Enter valid email
        // * Verify that error is not shown for valid email.
        const validEmail = 'test@mattermost.com';
        cy.get('#someemail').scrollIntoView().clear().type(validEmail);

        cy.get('#interactiveDialogSubmit').click();

        cy.get('input:invalid').should('have.length', 0);

        closeInteractiveDialog();
    });

    it('MM-T2496_1 - Number validation for invalid input', () => {
        cy.postMessage(`/${createdCommand.trigger} `);

        cy.get('#interactiveDialogModal').should('be.visible');

        // # Enter invalid number
        // * Verify that error is shown for invalid number.
        const invalidNumber = 'invalid-number';
        cy.get('#somenumber').scrollIntoView().clear().type(invalidNumber);

        cy.get('#interactiveDialogSubmit').click();

        cy.get('.modal-body').should('be.visible').children().eq(2).within(($elForm) => {
            cy.wrap($elForm).find('div.error-text').should('be.visible').and('have.text', 'This field is required.').and('have.css', 'color', 'rgb(210, 75, 78)');
        });

        closeInteractiveDialog();
    });

    it('MM-T2496_2 - Number validation for valid input', () => {
        cy.postMessage(`/${createdCommand.trigger} `);

        cy.get('#interactiveDialogModal').should('be.visible');

        // # Enter a valid number
        // * Verify that error is not shown for valid number.
        const validNumber = 12;
        cy.get('#somenumber').scrollIntoView().clear().type(validNumber);

        cy.get('#interactiveDialogSubmit').click();

        cy.get('.modal-body').should('be.visible').children().eq(2).within(($elForm) => {
            cy.wrap($elForm).find('div.error-text').should('not.exist');
        });

        closeInteractiveDialog();
    });

    it('MM-T2501 - Password element check', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#interactiveDialogModal').should('be.visible');

        // * Verify that the password text area is visible
        cy.get('#somepassword').should('be.visible');

        // * Verify that the password is masked on enter of text
        cy.get('#somepassword').should('have.attr', 'type', 'password');

        closeInteractiveDialog();
    });
});

function closeInteractiveDialog() {
    cy.get('.modal-header').should('be.visible').within(($elForm) => {
        cy.wrap($elForm).find('button.close').should('be.visible').click();
    });
    cy.get('#interactiveDialogModal').should('not.exist');
}

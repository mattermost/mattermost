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

describe('Interactive Dialog - Apps Form', () => {
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

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify that the header of modal contains icon URL, title and close button
            cy.get('.modal-header').should('be.visible').within(($elForm) => {
                cy.get('#appsModalIconUrl').should('be.visible').and('have.attr', 'src').and('not.be.empty');
                cy.get('#appsModalLabel').should('be.visible').and('have.text', fullDialog.dialog.title);
                cy.wrap($elForm).find('button.close').should('be.visible').and('contain', '×').and('contain', 'Close');

                cy.get('#appsModalLabel').should('be.visible').and('have.text', fullDialog.dialog.title);
            });

            // * Verify that the body contains all the elements
            cy.get('.modal-body').should('be.visible').children('.form-group').each(($elForm, index) => {
                const element = fullDialog.dialog.elements[index];

                // Skip if element is undefined (more DOM elements than expected)
                if (!element) {
                    return;
                }

                cy.wrap($elForm).within(() => {
                    cy.get('label').first().scrollIntoView().should('be.visible').and('contain', element.display_name);

                    if (['someuserselector', 'somechannelselector', 'someoptionselector'].includes(element.name)) {
                        // ReactSelect structure - check for MultiInput element
                        cy.get('[id^=\'MultiInput_\']').should('be.visible');

                        // * Verify that the dropdown opens on click
                        cy.get('[id^=\'MultiInput_\']').click();

                        // Break out of .within() scope to find options in document
                        cy.document().then((doc) => {
                            cy.wrap(doc).find('.react-select__menu').should('be.visible');
                        });

                        // # Click label to close any opened drop-downs
                        cy.get('label').first().click({force: true});
                    } else if (element.name === 'someradiooptions') {
                        cy.get('input').should('be.visible').and('have.length', optionsLength[element.name]);

                        // * Verify that no option is selected by default
                        cy.get('input').each(($elInput) => {
                            cy.wrap($elInput).should('not.be.checked');
                        });
                    } else if (element.name === 'boolean_input') {
                        cy.get('.checkbox').should('be.visible').within(() => {
                            cy.get('input[type=\'checkbox\']').
                                should('be.visible').
                                and('be.checked');

                            cy.get('span').should('have.text', element.placeholder);
                        });
                    } else {
                        cy.get(`#${element.name}`).should('be.visible').and('have.value', element.default || '').and('have.attr', 'placeholder', element.placeholder || '');
                    }

                    // * Verify that input element are given with the correct type of "input", "email", "number" and "password".
                    // * To take advantage of supported built-in validation.
                    if (inputTypes[element.name]) {
                        cy.get(`#${element.name}`).should('have.attr', 'type', inputTypes[element.name]);
                    }

                    if (element.help_text) {
                        cy.get('.help-text').should('exist').and('contain', element.help_text);
                    }
                });
            });

            // * Verify that the footer contains cancel and submit buttons
            cy.get('.modal-footer').should('be.visible').within(($elForm) => {
                cy.wrap($elForm).find('#appsModalCancel').should('be.visible').and('have.text', 'Cancel');
                cy.wrap($elForm).find('#appsModalSubmit').should('be.visible').and('have.text', fullDialog.dialog.submit_label);
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2492 - Cancel button works', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible');

        // # Click cancel from the modal
        cy.get('#appsModalCancel').click();

        // * Verify that the apps form modal is closed
        cy.get('#appsModal').should('not.exist');
    });

    it('MM-T2493 - "X" closes the dialog', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible');

        // # Click "X" button from the modal
        cy.get('.modal-header').should('be.visible').within(($elForm) => {
            cy.wrap($elForm).find('button.close').should('be.visible').click();
        });

        // * Verify that the apps form modal is closed
        cy.get('#appsModal').should('not.exist');
    });

    it('MM-T2494 - Correct error messages displayed if empty form is submitted', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible');

        // # Click submit button from the modal
        cy.get('#appsModalSubmit').click();

        // * Verify that the apps form modal is still open
        cy.get('#appsModal').should('be.visible');

        // * Verify that not optional element without text value shows an error and vice versa
        cy.get('.modal-body').should('be.visible').children('.form-group').each(($elForm, index) => {
            const element = fullDialog.dialog.elements[index];

            if (!element.optional && !element.default) {
                cy.wrap($elForm).find('div.error-text').should('exist').and('contain', 'This field is required.');
            } else {
                cy.wrap($elForm).find('div.error-text').should('not.exist');
            }
        });

        closeAppsFormModal();
    });

    it('MM-T2495_1 - Email validation for invalid input', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#appsModal').should('be.visible');

        // # Enter invalid and valid email
        // * Verify that error is: shown for invalid email and not shown for valid email.
        const invalidEmail = 'invalid-email';
        cy.get('#someemail').scrollIntoView().clear().type(invalidEmail);

        cy.get('#appsModalSubmit').click();

        cy.get('input:invalid').should('have.length', 1);
        cy.get('#someemail').then(($input) => {
            expect($input[0].validationMessage).to.eq(`Please include an '@' in the email address. '${invalidEmail}' is missing an '@'.`);
        });

        closeAppsFormModal();
    });

    it('MM-T2495_2 - Email validation for valid input', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the interactive dialog modal open up
        cy.get('#appsModal').should('be.visible');

        // # Enter valid email
        // * Verify that error is not shown for valid email.
        const validEmail = 'test@mattermost.com';
        cy.get('#someemail').scrollIntoView().clear().type(validEmail);

        cy.get('#appsModalSubmit').click();

        cy.get('input:invalid').should('have.length', 0);

        closeAppsFormModal();
    });

    it('MM-T2496_1 - Number validation for invalid input', () => {
        cy.postMessage(`/${createdCommand.trigger} `);

        cy.get('#appsModal').should('be.visible');

        // # Enter invalid number
        // * Verify that error is shown for invalid number.
        const invalidNumber = 'invalid-number';
        cy.get('#somenumber').scrollIntoView().clear().type(invalidNumber);

        cy.get('#appsModalSubmit').click();

        cy.get('.modal-body').should('be.visible').children('.form-group').eq(2).within(($elForm) => {
            cy.wrap($elForm).find('div.error-text').should('exist').and('contain', 'This field is required.');
        });

        closeAppsFormModal();
    });

    it('MM-T2496_2 - Number validation for valid input', () => {
        cy.postMessage(`/${createdCommand.trigger} `);

        cy.get('#appsModal').should('be.visible');

        // # Enter a valid number
        // * Verify that error is not shown for valid number.
        const validNumber = 12;
        cy.get('#somenumber').scrollIntoView().clear().type(validNumber);

        cy.get('#appsModalSubmit').click();

        cy.get('.modal-body').should('be.visible').children('.form-group').eq(2).within(($elForm) => {
            cy.wrap($elForm).find('div.error-text').should('not.exist');
        });

        closeAppsFormModal();
    });

    it('MM-T2501 - Password element check', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible');

        // * Verify that the password text area is visible
        cy.get('#somepassword').should('be.visible');

        // * Verify that the password is masked on enter of text
        cy.get('#somepassword').should('have.attr', 'type', 'password');

        closeAppsFormModal();
    });
});

function closeAppsFormModal() {
    cy.get('.modal-header').should('be.visible').within(($elForm) => {
        cy.wrap($elForm).find('button.close').should('be.visible').click();
    });
    cy.get('#appsModal').should('not.exist');
}

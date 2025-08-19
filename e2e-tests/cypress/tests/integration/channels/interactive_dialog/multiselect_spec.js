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

let createdCommandWithDefaults;
let createdCommandClean;
let multiSelectDialogWithDefaults;
let multiSelectDialogClean;

describe('Interactive Dialog - Multiselect', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.requireWebhookServer();

        // # Ensure that teammate name display setting is set to default 'username'
        cy.apiSaveTeammateNameDisplayPreference('username');

        // # Create new team and create commands on it
        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.env().webhookBaseUrl;

            // Create command for tests with defaults
            const commandWithDefaults = {
                auto_complete: false,
                description: 'Test for multiselect dialog elements with defaults',
                display_name: 'Multiselect Dialog Test (Defaults)',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'multiselect_dialog_defaults',
                url: `${webhookBaseUrl}/multiselect_dialog_request?includeDefaults=true`,
                username: '',
            };

            // Create command for clean tests (no defaults)
            const commandClean = {
                auto_complete: false,
                description: 'Test for multiselect dialog elements (clean)',
                display_name: 'Multiselect Dialog Test (Clean)',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'multiselect_dialog_clean',
                url: `${webhookBaseUrl}/multiselect_dialog_request?includeDefaults=false`,
                username: '',
            };

            cy.apiCreateCommand(commandWithDefaults).then(({data}) => {
                createdCommandWithDefaults = data;
                multiSelectDialogWithDefaults = webhookUtils.getMultiSelectDialog(createdCommandWithDefaults.id, webhookBaseUrl, true);
            });

            cy.apiCreateCommand(commandClean).then(({data}) => {
                createdCommandClean = data;
                multiSelectDialogClean = webhookUtils.getMultiSelectDialog(createdCommandClean.id, webhookBaseUrl, false);
            });
        });
    });

    afterEach(() => {
        // # Reload current page after each test to close any dialogs left open
        cy.reload();
    });

    it('MM-T2510A - Multiselect default values verification', () => {
        // # Post a slash command (with defaults)
        cy.postMessage(`/${createdCommandWithDefaults.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify that the header contains correct title
            cy.get('.modal-header').should('be.visible').within(() => {
                cy.get('#appsModalLabel').should('be.visible').and('have.text', multiSelectDialogWithDefaults.dialog.title);
            });

            // * Verify default values are preselected correctly
            cy.get('.modal-body').should('be.visible').children('.form-group').each(($elForm, index) => {
                const element = multiSelectDialogWithDefaults.dialog.elements[index];

                if (!element) {
                    return;
                }

                cy.wrap($elForm).within(() => {
                    if (element.name === 'multiselect_options') {
                        // * Verify multiselect options have default values (opt1,opt3 = Engineering, Marketing)
                        cy.get('.react-select__multi-value').should('have.length', 2);
                        cy.get('.react-select__multi-value').eq(0).should('contain', 'Engineering');
                        cy.get('.react-select__multi-value').eq(1).should('contain', 'Marketing');
                    } else if (element.name === 'multiselect_users') {
                        // * Verify multiselect users field has no default values
                        cy.get('.react-select__multi-value').should('not.exist');
                    } else if (element.name === 'single_select_options') {
                        // * Verify single select has default value (single2 = Single Option 2)
                        cy.get('.react-select__single-value').should('contain', 'Single Option 2');
                    }
                });
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2510B - Multiselect UI and functionality (clean)', () => {
        // # Post a slash command (clean, no defaults)
        cy.postMessage(`/${createdCommandClean.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify that the header of modal contains icon URL, title and close button
            cy.get('.modal-header').should('be.visible').within(($elForm) => {
                cy.get('#appsModalIconUrl').should('be.visible').and('have.attr', 'src').and('not.be.empty');
                cy.get('#appsModalLabel').should('be.visible').and('have.text', multiSelectDialogClean.dialog.title);
                cy.wrap($elForm).find('button.close').should('be.visible').and('contain', '×').and('contain', 'Close');
            });

            // * Verify that the body contains all multiselect elements
            cy.get('.modal-body').should('be.visible').children('.form-group').should('have.length', 3).each(($elForm, index) => {
                const element = multiSelectDialogClean.dialog.elements[index];

                // Skip if element is undefined (more DOM elements than expected)
                if (!element) {
                    return;
                }

                cy.wrap($elForm).within(() => {
                    // Verify the label text includes display name
                    cy.get('label').first().scrollIntoView().should('be.visible').and('contain', element.display_name);

                    if (element.name === 'multiselect_options') {
                        // * Verify multiselect options field starts empty
                        cy.get('[id^=\'MultiInput_\']').should('be.visible');
                        cy.get('.react-select__multi-value').should('not.exist');

                        // * Test adding multiple options
                        cy.get('[id^=\'MultiInput_\']').click();
                        cy.document().then((doc) => {
                            cy.wrap(doc).find('.react-select__option').contains('Engineering').click();
                        });

                        cy.get('[id^=\'MultiInput_\']').click();
                        cy.document().then((doc) => {
                            cy.wrap(doc).find('.react-select__option').contains('Sales').click();
                        });

                        // * Verify two options are now selected
                        cy.get('.react-select__multi-value').should('have.length', 2);
                        cy.get('.react-select__multi-value').eq(0).should('contain', 'Engineering');
                        cy.get('.react-select__multi-value').eq(1).should('contain', 'Sales');

                        // * Test removing an option
                        cy.get('.react-select__multi-value').eq(0).find('.react-select__multi-value__remove').click();

                        // * Verify only one option remains
                        cy.get('.react-select__multi-value').should('have.length', 1);
                        cy.get('.react-select__multi-value').eq(0).should('contain', 'Sales');
                    } else if (element.name === 'multiselect_users') {
                        // * Verify multiselect users field starts empty
                        cy.get('[id^=\'MultiInput_\']').should('be.visible');
                        cy.get('.react-select__multi-value').should('not.exist');

                        // * Test selecting multiple users
                        cy.get('[id^=\'MultiInput_\']').click();
                        cy.document().then((doc) => {
                            cy.wrap(doc).find('.react-select__option').should('have.length.at.least', 1);
                            cy.wrap(doc).find('.react-select__option').first().click();
                        });

                        cy.get('[id^=\'MultiInput_\']').click();
                        cy.document().then((doc) => {
                            cy.wrap(doc).find('.react-select__option').eq(1).click();
                        });

                        // * Verify two users are selected
                        cy.get('.react-select__multi-value').should('have.length', 2);
                    } else if (element.name === 'single_select_options') {
                        // * Verify single select field starts empty
                        cy.get('[id^=\'MultiInput_\']').should('be.visible');

                        // * Test selecting a single option
                        cy.get('[id^=\'MultiInput_\']').click();
                        cy.document().then((doc) => {
                            cy.wrap(doc).find('.react-select__option').contains('Single Option 3').click();
                        });

                        // * Verify single value was selected
                        cy.get('.react-select__single-value').should('contain', 'Single Option 3');
                    }

                    // * Verify help text if present
                    if (element.help_text) {
                        cy.get('.help-text').should('be.visible').and('contain', element.help_text);
                    }
                });
            });

            // * Verify that the footer contains cancel and submit buttons
            cy.get('.modal-footer').should('be.visible').within(($elForm) => {
                cy.wrap($elForm).find('#appsModalCancel').should('be.visible').and('have.text', 'Cancel');
                cy.wrap($elForm).find('#appsModalSubmit').should('be.visible').and('have.text', multiSelectDialogClean.dialog.submit_label);
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2511A - Multiselect form submission with defaults', () => {
        // # Post a slash command (with defaults)
        cy.postMessage(`/${createdCommandWithDefaults.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Select additional option in the multiselect field (defaults already present)
            cy.get('.form-group').eq(0).within(() => {
                // Keep default selections and add one more
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('Support').click();
            });

            // # Select multiple users
            cy.get('.form-group').eq(1).within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').first().click();
            });
            cy.get('.form-group').eq(1).within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').eq(1).click();
            });

            // # Submit the form
            cy.intercept('/api/v4/actions/dialogs/submit').as('submitAction');
            cy.get('#appsModalSubmit').click();
        });

        // * Verify that the apps form modal is closed
        cy.get('#appsModal').should('not.exist');

        // * Verify that submitted values contain array values for multiselect
        cy.wait('@submitAction').should('include.all.keys', ['request', 'response']).then((result) => {
            const {submission} = result.request.body;

            // * Verify multiselect options submitted as array with defaults + added option
            expect(submission.multiselect_options).to.be.an('array');
            expect(submission.multiselect_options).to.include.members(['opt1', 'opt3', 'opt4']); // Engineering, Marketing, Support

            // * Verify multiselect users submitted as array
            expect(submission.multiselect_users).to.be.an('array');
            expect(submission.multiselect_users).to.have.length(2);

            // * Verify single select submitted as string with default value
            expect(submission.single_select_options).to.be.a('string');
            expect(submission.single_select_options).to.equal('single2'); // Default value
        });

        // * Verify success message
        cy.getLastPost().should('contain', 'Dialog submitted');
    });

    it('MM-T2511B - Multiselect form submission (clean)', () => {
        // # Post a slash command (clean, no defaults)
        cy.postMessage(`/${createdCommandClean.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Select multiple options in the multiselect field (starting from empty)
            cy.get('.form-group').eq(0).within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('Engineering').click();
            });
            cy.get('.form-group').eq(0).within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('Sales').click();
            });

            // # Select multiple users
            cy.get('.form-group').eq(1).within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').first().click();
            });
            cy.get('.form-group').eq(1).within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').eq(1).click();
            });

            // # Select single option
            cy.get('.form-group').eq(2).within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('Single Option 1').click();
            });

            // # Submit the form
            cy.intercept('/api/v4/actions/dialogs/submit').as('submitAction');
            cy.get('#appsModalSubmit').click();
        });

        // * Verify that the apps form modal is closed
        cy.get('#appsModal').should('not.exist');

        // * Verify that submitted values contain array values for multiselect
        cy.wait('@submitAction').should('include.all.keys', ['request', 'response']).then((result) => {
            const {submission} = result.request.body;

            // * Verify multiselect options submitted as array
            expect(submission.multiselect_options).to.be.an('array');
            expect(submission.multiselect_options).to.include.members(['opt1', 'opt2']); // Engineering, Sales

            // * Verify multiselect users submitted as array
            expect(submission.multiselect_users).to.be.an('array');
            expect(submission.multiselect_users).to.have.length(2);

            // * Verify single select submitted as string
            expect(submission.single_select_options).to.be.a('string');
            expect(submission.single_select_options).to.equal('single1'); // Selected value
        });

        // * Verify success message
        cy.getLastPost().should('contain', 'Dialog submitted');
    });

    it('MM-T2512 - Multiselect validation error handling', () => {
        // # Post a slash command (clean, no defaults)
        cy.postMessage(`/${createdCommandClean.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Required multiselect field (multiselect_options) starts empty in clean dialog
            cy.get('.form-group').eq(0).within(() => {
                // Verify the field shows required indicator (*) or field name
                cy.get('label').should('contain', 'Multi Option Selector');

                // Verify field starts empty (no clearing needed in clean dialog)
                cy.get('.react-select__multi-value').should('not.exist');
            });

            cy.wait(TIMEOUTS.HALF_SEC); // Wait for potential validation to appear
            // # Try to submit the form with empty required multiselect
            cy.get('#appsModalSubmit').click();
        });

        // * Verify that the apps form modal is still open (validation failed)
        cy.get('#appsModal').should('be.visible');

        // * Verify error message appears for required field
        cy.get('#appsModal').within(() => {
            cy.get('.form-group').eq(0).within(() => {
                cy.get('.error-text').should('be.visible').and('contain', 'This field is required');
            });
        });

        closeAppsFormModal();
    });

    it('MM-T2513 - Multiselect with keyboard navigation', () => {
        // # Post a slash command (clean, no defaults)
        cy.postMessage(`/${createdCommandClean.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Test keyboard navigation in multiselect (starts clean, no defaults)
            cy.get('.form-group').eq(0).within(() => {
                // First selection: Use keyboard to select Sales option
                cy.get('[id^=\'MultiInput_\']').click().type('{downarrow}{downarrow}{enter}'); // Select Sales option

                // * Verify Sales was added
                cy.get('.react-select__multi-value').should('have.length', 1);
                cy.get('.react-select__multi-value').should('contain', 'Sales');

                // # Test typing to filter options (dropdown closes after selection, so click again)
                cy.get('[id^=\'MultiInput_\']').click().type('Prod{enter}'); // Type "Prod" to filter and select Product

                // * Verify Product was added
                cy.get('.react-select__multi-value').should('have.length', 2);
                cy.get('.react-select__multi-value').should('contain', 'Product');
                cy.wait(TIMEOUTS.HALF_SEC); // Wait for potential dropdown rendering

                // # Test removing option (click remove button)
                cy.get('.react-select__multi-value').contains('Product').parent().within(() => {
                    cy.get('.react-select__multi-value__remove').click();
                });

                // * Verify Product was removed
                cy.get('.react-select__multi-value').should('have.length', 1);
                cy.get('.react-select__multi-value').should('not.contain', 'Product');
            });
        });

        // * Verify dropdown is closed (no options visible)
        cy.get('body').then(($body) => {
            if ($body.find('.react-select__menu').length > 0) {
                cy.get('.react-select__menu').should('not.be.visible');
            }
        });

        closeAppsFormModal();
    });

    it('MM-T2514 - Multiselect accessibility check', () => {
        // # Post a slash command (clean, no defaults)
        cy.postMessage(`/${createdCommandClean.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify multiselect has basic accessibility elements (uses clean dialog)
            cy.get('.form-group').eq(0).within(() => {
                // * Verify label exists and is visible
                cy.get('label').should('be.visible').and('contain', 'Multi Option Selector');

                // * Verify multiselect input is present and accessible
                cy.get('[id^=\'MultiInput_\']').should('be.visible');

                // * Verify help text exists and is visible
                cy.get('.help-text').should('be.visible').and('contain', 'You can select multiple options');

                // * Test basic interaction accessibility - click to open/close
                cy.get('[id^=\'MultiInput_\']').click();

                // * Verify dropdown opens (options become available)
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').should('have.length.at.least', 1);
                });
            });

            // * Close dropdown by clicking elsewhere in the modal (force since dropdown options may cover the area)
            cy.get('.modal-body').click({force: true});
        });

        closeAppsFormModal();
    });
});

function closeAppsFormModal() {
    cy.get('.modal-header').should('be.visible').within(($elForm) => {
        cy.wrap($elForm).find('button.close').should('be.visible').click();
    });
    cy.get('#appsModal').should('not.exist');
}

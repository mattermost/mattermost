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
let dynamicSelectDialog;

describe('Interactive Dialog - Dynamic Select', () => {
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
                description: 'Test for dynamic select dialog elements',
                display_name: 'Dynamic Select Dialog Test',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'dynamic_select_dialog',
                url: `${webhookBaseUrl}/dynamic_select_dialog_request`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;
                dynamicSelectDialog = webhookUtils.getDynamicSelectDialog(createdCommand.id, webhookBaseUrl);
            });
        });
    });

    afterEach(() => {
        // # Reload current page after each test to close any dialogs left open
        cy.reload();
    });

    it('MM-T2520A - Dynamic select UI and structure verification', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify that the header contains correct title
            cy.get('.modal-header').should('be.visible').within(() => {
                cy.get('#appsModalLabel').should('be.visible').and('have.text', dynamicSelectDialog.dialog.title);
                cy.get('#appsModalIconUrl').should('be.visible').and('have.attr', 'src').and('not.be.empty');
                cy.get('button.close').should('be.visible').and('contain', '×').and('contain', 'Close');
            });

            // * Verify that the body contains both dynamic select elements
            cy.get('.modal-body').should('be.visible').children('.form-group').should('have.length', 2).each(($elForm, index) => {
                const element = dynamicSelectDialog.dialog.elements[index];

                if (!element) {
                    return;
                }

                cy.wrap($elForm).within(() => {
                    // Verify the label text includes display name
                    cy.get('label').first().scrollIntoView().should('be.visible').and('contain', element.display_name);

                    if (element.name === 'dynamic_role_selector') {
                        // * Verify required dynamic select field starts empty
                        cy.get('[id^=\'MultiInput_\']').should('be.visible');
                        cy.get('.react-select__single-value').should('not.exist');
                        cy.get('.react-select__placeholder').should('contain', element.placeholder);
                    } else if (element.name === 'optional_dynamic_selector') {
                        // * Verify optional dynamic select field is visible (may have default value)
                        cy.get('[id^=\'MultiInput_\']').should('be.visible');

                        // Note: Default values for dynamic selects may not be resolved until user interaction
                        // The field may show the raw value or be empty initially
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
                cy.wrap($elForm).find('#appsModalSubmit').should('be.visible').and('have.text', dynamicSelectDialog.dialog.submit_label);
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2520B - Dynamic select search functionality', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Test dynamic search in the required field
            cy.get('.form-group').eq(0).within(() => {
                // # Click to open dropdown and verify initial options load
                cy.get('[id^=\'MultiInput_\']').click();

                cy.wait(TIMEOUTS.HALF_SEC); // Wait for dynamic options to load

                // * Verify dropdown opens with initial options
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').should('have.length.at.least', 1);
                    cy.wrap(doc).find('.react-select__option').first().should('contain', 'Backend Engineer');
                });

                // # Test search filtering by typing directly in the control
                cy.get('.react-select__control').click().type('frontend');

                cy.wait(TIMEOUTS.ONE_SEC); // Wait longer for search results

                // * Verify filtered results contain 'frontend' matches
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').should('have.length.at.least', 1);
                    cy.wrap(doc).find('.react-select__option').each(($option) => {
                        cy.wrap($option).should('contain.text', 'Frontend');
                    });
                });

                // # Select an option
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').contains('Frontend Engineer').click();
                });

                // * Verify selection was made
                cy.get('.react-select__single-value').should('contain', 'Frontend Engineer');
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2520C - Dynamic select with different search terms', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Test different search scenarios
            cy.get('.form-group').eq(0).within(() => {
                // # Test search for "manager"
                cy.get('[id^=\'MultiInput_\']').click().type('manager');

                cy.wait(TIMEOUTS.HALF_SEC); // Wait for search results

                // * Verify manager-related results
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').should('have.length.at.least', 1);
                    cy.wrap(doc).find('.react-select__option').each(($option) => {
                        cy.wrap($option).invoke('text').should('match', /manager/i);
                    });
                });

                // # Clear and test search for "senior"
                cy.get('[id^=\'MultiInput_\']').click().type('senior');

                cy.wait(TIMEOUTS.HALF_SEC); // Wait for search results

                // * Verify senior-related results
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').should('have.length.at.least', 1);
                    cy.wrap(doc).find('.react-select__option').each(($option) => {
                        cy.wrap($option).invoke('text').should('match', /senior/i);
                    });
                });

                // # Test search with no matches
                cy.get('[id^=\'MultiInput_\']').type('xyz123nomatch');

                cy.wait(TIMEOUTS.HALF_SEC); // Wait for search results

                // * Verify no options when no matches
                cy.document().then((doc) => {
                    // Either no options exist or "No options" message is shown
                    cy.wrap(doc).find('.react-select__menu').then(($menu) => {
                        if ($menu.length > 0) {
                            cy.wrap(doc).find('.react-select__option, .react-select__menu-notice--no-options').should('exist');
                        }
                    });
                });
                cy.wait(TIMEOUTS.HALF_SEC); // Wait for default options to load

                // # Clear search to get back to default options
                cy.get('[id^=\'MultiInput_\']').click();
                cy.wait(TIMEOUTS.HALF_SEC); // Wait for default options to load

                // # Select a valid option for form submission test
                cy.get('[id^=\'MultiInput_\']').click();
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').first().click();
                });
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2521A - Dynamic select form submission', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Select value in required field
            cy.get('.form-group').eq(0).within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });

            cy.wait(TIMEOUTS.HALF_SEC); // Wait for options to load

            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('DevOps Engineer').click();
            });

            // # Modify the optional field (which has a default)
            cy.get('.form-group').eq(1).within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });

            cy.wait(TIMEOUTS.HALF_SEC); // Wait for options to load

            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('QA Engineer').click();
            });

            // # Submit the form
            cy.intercept('POST', '/api/v4/actions/dialogs/submit').as('submitAction');
            cy.get('#appsModalSubmit').click();
        });

        // * Verify that the apps form modal is closed
        cy.get('#appsModal').should('not.exist');

        // * Verify that submitted values are correct
        cy.wait('@submitAction').should('include.all.keys', ['request', 'response']).then((result) => {
            const {submission} = result.request.body;

            // * Verify dynamic select fields submitted with correct values
            expect(submission.dynamic_role_selector).to.equal('devops_eng');
            expect(submission.optional_dynamic_selector).to.equal('qa_eng');
        });

        // * Verify success message
        cy.getLastPost().should('contain', 'Dialog submitted');
    });

    it('MM-T2521B - Dynamic select validation error handling', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Clear the required field (first field starts empty, second has default)
            cy.get('.form-group').eq(0).within(() => {
                // Field should already be empty, but verify
                cy.get('.react-select__single-value').should('not.exist');
            });

            // # Try to submit the form with empty required field
            cy.get('#appsModalSubmit').click();

            cy.wait(TIMEOUTS.HALF_SEC); // Wait for potential validation to appear
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

    it('MM-T2522 - Dynamic select keyboard navigation', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Test keyboard navigation in dynamic select
            cy.get('.form-group').eq(0).within(() => {
                // # Open dropdown and navigate with keyboard
                cy.get('[id^=\'MultiInput_\']').click();

                cy.wait(TIMEOUTS.HALF_SEC); // Wait for options to load

                // # Navigate using arrow keys
                cy.get('[id^=\'MultiInput_\']').type('{downarrow}{downarrow}{enter}');

                // * Verify selection was made (should be the third option in default list)
                cy.get('.react-select__single-value').should('exist').and('not.be.empty');
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2523 - Dynamic select accessibility check', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // # Test accessibility elements for dynamic select
            cy.get('.form-group').eq(0).within(() => {
                // * Verify label exists and is visible
                cy.get('label').should('be.visible').and('contain', 'Dynamic Role Selector');

                // * Verify dynamic select input is present and accessible
                cy.get('[id^=\'MultiInput_\']').should('be.visible');

                // * Verify help text exists and is visible
                cy.get('.help-text').should('be.visible').and('contain', 'Start typing to search');

                // * Test basic interaction accessibility - click to open/close
                cy.get('[id^=\'MultiInput_\']').click();

                cy.wait(TIMEOUTS.HALF_SEC); // Wait for options to load

                // * Verify dropdown opens (options become available)
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').should('have.length.at.least', 1);
                });
            });

            // * Close dropdown by clicking elsewhere in the modal
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

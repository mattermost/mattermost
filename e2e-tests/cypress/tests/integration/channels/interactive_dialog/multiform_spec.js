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

let createdCommand;

describe('Interactive Dialog - Multiform (Step-by-step Form Submissions)', () => {
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
                description: 'Test for multiform functionality - step by step form submissions',
                display_name: 'Multiform Dialog Test',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'multiform_dialog',
                url: `${webhookBaseUrl}/dialog/multistep`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;
            });
        });
    });

    afterEach(() => {
        // # Reload current page after each test to close any dialogs left open
        cy.reload();
    });

    it('MM-T2550A - Multiform initial step (Step 1) UI verification', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up with Step 1
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify Step 1 dialog structure
            cy.get('#appsModalLabel').should('contain', 'Step 1 - Personal Info');
            cy.get('#appsModalSubmit').should('contain', 'Next Step');

            // * Verify Step 1 fields are present
            cy.get('.modal-body').within(() => {
                cy.contains('First Name').should('be.visible');
                cy.contains('Email').should('be.visible');
                cy.get('.form-group').should('have.length', 2);
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2550B - Complete multiform workflow: Step 1 → Step 2 → Step 3', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify Step 1 opens
        cy.get('#appsModal').should('be.visible').within(() => {
            cy.get('#appsModalLabel').should('contain', 'Step 1 - Personal Info');

            // # Fill out Step 1 form
            cy.get('input[placeholder*="first name"]').type('John');
            cy.get('input[placeholder*="email"]').type('john.doe@example.com');

            // # Submit Step 1 - this should create a new dialog (Step 2)
            cy.get('#appsModalSubmit').click();
        });

        // * Wait for Step 2 dialog to load (new form created via multiform)
        cy.wait(TIMEOUTS.ONE_SEC);
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify new dialog has Step 2 title (multiform created new form)
            cy.get('#appsModalLabel').should('contain', 'Step 2 - Work Info');
            cy.get('#appsModalSubmit').should('contain', 'Next Step');

            // * Verify Step 2 specific fields are present (different from Step 1)
            cy.get('.modal-body').within(() => {
                cy.contains('Department').should('be.visible');
                cy.contains('Experience Level').should('be.visible');

                // * Step 1 fields should not be present (this is a new dialog)
                cy.contains('First Name').should('not.exist');
                cy.contains('Email').should('not.exist');
            });

            // # Fill out Step 2 form
            cy.get('.form-group').contains('Department').parent().within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('Engineering').click();
            });

            // Select experience level (radio)
            cy.get('input[type="radio"][value="senior"]').click();

            // # Submit Step 2 - this should create Step 3 dialog
            cy.get('#appsModalSubmit').click();
        });

        // * Wait for Step 3 dialog to load (final step via multiform)
        cy.wait(TIMEOUTS.ONE_SEC);
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify new dialog has Step 3 title and final submit
            cy.get('#appsModalLabel').should('contain', 'Step 3 - Final Details');
            cy.get('#appsModalSubmit').should('contain', 'Complete Registration');

            // * Verify Step 3 specific fields
            cy.get('.modal-body').within(() => {
                cy.contains('Comments').should('be.visible');
                cy.contains('Terms & Conditions').should('be.visible');
            });

            // # Fill out Step 3 (final step)
            cy.get('textarea[placeholder*="comments"]').type('Multiform test completed successfully');
            cy.get('input[type="checkbox"]').check();

            // # Submit final step
            cy.get('#appsModalSubmit').click();
        });

        // * Verify multiform completed and dialog closed
        cy.get('#appsModal').should('not.exist');

        // * Verify completion message with accumulated data
        cy.getLastPost().should('contain', 'Multistep completed successfully');
        cy.getLastPost().should('contain', 'Final step values');
    });

    it('MM-T2550C - Multiform step progression validation', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify initial Step 1
        cy.get('#appsModal').should('be.visible').within(() => {
            cy.get('#appsModalLabel').should('contain', 'Step 1 - Personal Info');

            // # Submit empty form to test validation
            cy.get('#appsModalSubmit').click();
        });

        cy.wait(TIMEOUTS.HALF_SEC);

        // * Verify validation errors appear and we stay on Step 1
        cy.get('#appsModal').should('be.visible').within(() => {
            cy.get('#appsModalLabel').should('contain', 'Step 1 - Personal Info'); // Still on step 1

            // * Check for validation errors on required fields
            cy.get('.form-group').contains('First Name').parent().within(() => {
                cy.get('.error-text').should('be.visible');
            });
            cy.get('.form-group').contains('Email').parent().within(() => {
                cy.get('.error-text').should('be.visible');
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2550D - Multiform cancellation at different steps', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Test cancellation from Step 1
        cy.get('#appsModal').should('be.visible').within(() => {
            cy.get('#appsModalLabel').should('contain', 'Step 1 - Personal Info');
            cy.get('#appsModalCancel').click();
        });

        cy.get('#appsModal').should('not.exist');
        cy.getLastPost().should('contain', 'Dialog cancelled');

        // # Start multiform again and progress to Step 2
        cy.postMessage(`/${createdCommand.trigger} `);
        cy.get('#appsModal').should('be.visible').within(() => {
            cy.get('input[placeholder*="first name"]').type('Jane');
            cy.get('input[placeholder*="email"]').type('jane@test.com');
            cy.get('#appsModalSubmit').click();
        });

        // * Wait for Step 2 and cancel from there
        cy.wait(TIMEOUTS.ONE_SEC);
        cy.get('#appsModal').should('be.visible').within(() => {
            cy.get('#appsModalLabel').should('contain', 'Step 2 - Work Info');
            cy.get('#appsModalCancel').click();
        });

        cy.get('#appsModal').should('not.exist');
        cy.getLastPost().should('contain', 'Dialog cancelled');
    });

    it('MM-T2550E - Multiform maintains step-specific content', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify each step has distinct content that doesn't carry over
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Step 1 specific elements
            cy.get('#appsModalLabel').should('contain', 'Step 1 - Personal Info');
            cy.contains('First Name').should('be.visible');
            cy.contains('Email').should('be.visible');

            // # Fill and submit Step 1
            cy.get('input[placeholder*="first name"]').type('Bob');
            cy.get('input[placeholder*="email"]').type('bob@company.com');
            cy.get('#appsModalSubmit').click();
        });

        cy.wait(TIMEOUTS.ONE_SEC);
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Step 2 has completely different content
            cy.get('#appsModalLabel').should('contain', 'Step 2 - Work Info');
            cy.contains('Department').should('be.visible');
            cy.contains('Experience Level').should('be.visible');

            // * Step 1 content is not visible (new form)
            cy.contains('First Name').should('not.exist');
            cy.contains('Email').should('not.exist');

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


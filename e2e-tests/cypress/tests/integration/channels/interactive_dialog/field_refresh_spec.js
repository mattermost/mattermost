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

describe('Interactive Dialog - Field Refresh', () => {
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
                description: 'Test for field refresh functionality',
                display_name: 'Field Refresh Dialog Test',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'field_refresh_dialog',
                url: `${webhookBaseUrl}/dialog/field-refresh`,
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

    it('MM-T2540A - Field refresh changes form content within same modal', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the apps form modal opens up
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify initial state - Step 1 fields are visible
            cy.get('#appsModalLabel').should('contain', 'Field Refresh Demo'); // Modal title stays same during refresh

            cy.get('.modal-body').within(() => {
                // * Verify initial field refresh dialog fields are present
                cy.contains('Project Type').should('be.visible');
                cy.contains('Project Name').should('be.visible');
                cy.get('.form-group').should('have.length', 2); // project_type + project_name
            });

            // # Trigger field refresh by changing project type (refresh: true field)
            cy.get('.form-group').contains('Project Type').parent().within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });

            cy.wait(TIMEOUTS.HALF_SEC);
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('Web Application').click();
            });

            // * Wait for field refresh to complete
            cy.wait(TIMEOUTS.ONE_SEC);

            // * Verify modal title stays the same (field refresh, not form submission)
            cy.get('#appsModalLabel').should('contain', 'Field Refresh Demo');

            // * Verify form has dynamic fields based on project type
            cy.get('.modal-body').within(() => {
                // * Basic fields should still be visible
                cy.contains('Project Type').should('be.visible');
                cy.contains('Project Name').should('be.visible');

                // * Selection should be made
                cy.get('.react-select__single-value').should('contain', 'Web Application');

                // * New framework field should appear for web application
                cy.contains('Framework').should('be.visible');
                cy.get('.form-group').should('have.length', 3); // project_type + project_name + framework
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2540B - Field values preserved during refresh', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        cy.get('#appsModal').should('be.visible').within(() => {
            // # Fill in initial values
            cy.get('input[placeholder*="project name"]').type('My Test Project');

            // # Trigger refresh by selecting project type
            cy.get('.form-group').contains('Project Type').parent().within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('Mobile App').click();
            });
            cy.wait(TIMEOUTS.ONE_SEC);

            // * Verify project name value is preserved during refresh
            cy.get('input[placeholder*="project name"]').should('have.value', 'My Test Project');

            // * Verify project type selection is preserved
            cy.get('.react-select__single-value').should('contain', 'Mobile App');

            closeAppsFormModal();
        });
    });

    it('MM-T2540C - Multiple refresh cycles work correctly', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        cy.get('#appsModal').should('be.visible').within(() => {
            const projectTypes = [
                'Web Application',
                'Mobile App',
                'API Service',
                'Web Application',
            ];

            projectTypes.forEach((projectType) => {
                // # Select different project type
                cy.get('.form-group').contains('Project Type').parent().within(() => {
                    cy.get('[id^=\'MultiInput_\']').click();
                });
                cy.wait(TIMEOUTS.HALF_SEC);
                cy.document().then((doc) => {
                    cy.wrap(doc).find('.react-select__option').contains(projectType).click();
                });
                cy.wait(TIMEOUTS.ONE_SEC);

                // * Verify basic fields are always present
                cy.contains('Project Type').should('be.visible');
                cy.contains('Project Name').should('be.visible');

                // * Verify selection was made
                cy.get('.react-select__single-value').should('contain', projectType);

                // * Verify project-specific fields appear dynamically
                if (projectType === 'Web Application') {
                    cy.contains('Framework').should('be.visible');
                    cy.get('.form-group').should('have.length', 3);
                } else if (projectType === 'Mobile App') {
                    cy.contains('Platform').should('be.visible');
                    cy.get('.form-group').should('have.length', 3);
                } else if (projectType === 'API Service') {
                    cy.contains('Language').should('be.visible');
                    cy.get('.form-group').should('have.length', 3);
                }
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


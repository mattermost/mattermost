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
            // * Verify initial state - fields are visible in correct order
            cy.get('#appsModalLabel').should('contain', 'Field Refresh Demo'); // Modal title stays same during refresh

            cy.get('.modal-body').within(() => {
                // * Verify initial field refresh dialog fields are present in new order
                cy.contains('Project Name').should('be.visible');
                cy.contains('Project Type').should('be.visible');
                cy.get('.form-group').should('have.length', 2); // project_name + project_type
            });

            // # Enter project name first
            cy.get('input[placeholder*="project name"]').type('Web App Project');

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
                // * Basic fields should still be visible in correct order
                cy.contains('Project Name').should('be.visible');
                cy.contains('Project Type').should('be.visible');

                // * Project name value should be preserved
                cy.get('input[placeholder*="project name"]').should('have.value', 'Web App Project');

                // * Selection should be made
                cy.get('.react-select__single-value').should('contain', 'Web Application');

                // * New framework field should appear for web application
                cy.contains('Framework').should('be.visible');
                cy.get('.form-group').should('have.length', 3); // project_name + project_type + framework
            });

            closeAppsFormModal();
        });
    });

    it('MM-T2540B - Field values preserved during refresh and form submits successfully', () => {
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

            // * Verify platform field appeared for mobile app
            cy.contains('Platform').should('be.visible');

            // # Fill in the platform field and submit
            cy.get('.form-group').contains('Platform').parent().within(() => {
                cy.get('[id^=\'MultiInput_\']').click();
            });
            cy.wait(TIMEOUTS.HALF_SEC);
            cy.document().then((doc) => {
                cy.wrap(doc).find('.react-select__option').contains('React Native').click();
            });

            // # Submit the form
            cy.get('.modal-footer button').contains('Submit').click();
        });

        // * Verify form was submitted successfully with preserved values
        cy.get('.post__body').should('contain', 'Field refresh dialog submitted successfully!');
        cy.get('.post__body').should('contain', 'My Test Project');
        cy.get('.post__body').should('contain', 'mobile');
        cy.get('.post__body').should('contain', 'react-native');
    });

    it('MM-T2540C - Multiple refresh cycles work correctly', () => {
        // # Post a slash command
        cy.postMessage(`/${createdCommand.trigger} `);

        cy.get('#appsModal').should('be.visible').within(() => {
            // # Enter project name first
            cy.get('input[placeholder*="project name"]').type('Multi-Test Project');

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

                // * Verify basic fields are always present in correct order
                cy.contains('Project Name').should('be.visible');
                cy.contains('Project Type').should('be.visible');

                // * Verify project name is preserved through refresh cycles
                cy.get('input[placeholder*="project name"]').should('have.value', 'Multi-Test Project');

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


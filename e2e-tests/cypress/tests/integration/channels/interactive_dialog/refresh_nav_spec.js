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
 *
 * Demonstrates single-slot dialog navigation via field Refresh + source_url:
 * - One modal stays open the entire time (no stacking, no backdrops accumulating)
 * - Selecting a mission morphs the dialog title, intro text, and elements in-place
 * - Saving the detail form returns a fresh board with updated task counts
 */

let createdCommand;

describe('Interactive Dialog - Single-slot navigation via field Refresh + source_url', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.requireWebhookServer();

        cy.apiSaveTeammateNameDisplayPreference('username');

        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.expose().webhookBaseUrl;

            // # Restore the webhook's in-memory demo data
            cy.request('POST', `${webhookBaseUrl}/dialog/reset`).its('status').should('eq', 200);

            const command = {
                auto_complete: false,
                description: 'Test for single-slot dialog refresh navigation',
                display_name: 'Refresh Nav Dialog Test',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'refresh_nav_dialog',
                url: `${webhookBaseUrl}/dialog/refresh_nav`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                createdCommand = data;
            });
        });
    });

    afterEach(() => {
        cy.reload();
    });

    it('MM-T2570A - Board dialog opens with mission select and intro table', () => {
        cy.postMessage(`/${createdCommand.trigger} `);

        cy.get('#appsModal').should('be.visible').within(() => {
            // * Title is the board title
            cy.get('#appsModalLabel').should('contain', 'Mission Board');

            cy.get('.modal-body').within(() => {
                // * Intro table lists both missions
                cy.contains('M-1').should('be.visible');
                cy.contains('M-2').should('be.visible');
                cy.contains('Operation Falcon').should('be.visible');
                cy.contains('Operation Raven').should('be.visible');

                // * Mission radio buttons are present
                cy.contains('Mission').should('be.visible');
                cy.get('input[type="radio"]').should('have.length', 2);
            });

            cy.get('#appsModalSubmit').should('contain', 'Close');
        });

        // * Only one modal is open
        cy.get('[id="appsModal"]').should('have.length', 1);
    });

    it('MM-T2570B - Selecting a mission morphs the dialog to the mission detail in-place', () => {
        // Field refreshes and submits both go through the dialog submit API; the server
        // then calls the webhook's source_url / submit url, which the browser never sees.
        cy.intercept('POST', '/api/v4/actions/dialogs/submit').as('submitDialog');

        cy.postMessage(`/${createdCommand.trigger} `);
        cy.get('#appsModal').should('be.visible');
        cy.get('#appsModalLabel').should('contain', 'Mission Board');

        // # Click the radio button for the first mission
        cy.get('#appsModal').within(() => {
            cy.contains('label', 'M-1').click();
        });

        // # Wait for the field refresh to respond
        cy.wait('@submitDialog').its('response.statusCode').should('eq', 200);

        // * Dialog title morphed to the mission detail title
        cy.get('#appsModalLabel').should('contain', 'M-1');
        cy.get('#appsModalLabel').should('contain', 'Operation Falcon');

        // * Task checkboxes are now visible
        cy.contains('Secure perimeter').should('be.visible');
        cy.contains('Establish comms').should('be.visible');
        cy.contains('Deploy assets').should('be.visible');

        // * Submit label changed to reflect the detail action
        cy.get('#appsModalSubmit').should('contain', 'Save & Return to Board');

        // * Still only ONE modal (no stacking occurred)
        cy.get('[id="appsModal"]').should('have.length', 1);
    });

    it('MM-T2570C - Saving the detail form returns a refreshed board with updated task counts', () => {
        cy.intercept('POST', '/api/v4/actions/dialogs/submit').as('submitDialog');

        cy.postMessage(`/${createdCommand.trigger} `);
        cy.get('#appsModal').should('be.visible');

        // # Click the radio button for M-2 (all tasks start incomplete)
        cy.get('#appsModal').within(() => {
            cy.contains('label', 'M-2').click();
        });
        cy.wait('@submitDialog').its('response.statusCode').should('eq', 200);

        cy.get('#appsModalLabel').should('contain', 'M-2');

        // # Check one of the tasks
        cy.get('#appsModal').within(() => {
            cy.contains('Brief team').parent().find('input[type="checkbox"]').check({force: true});
        });

        // # Submit the detail form — handler detects mission_id in submission,
        // updates tasks, and returns a fresh board form ({type:'form'})
        cy.get('#appsModalSubmit').click();
        cy.wait('@submitDialog').its('response.statusCode').should('eq', 200);

        // * Dialog morphed back to the board (same modal, no close/reopen)
        cy.get('#appsModalLabel').should('contain', 'Mission Board');

        // * M-2 row in the intro table now shows 1/2 tasks
        cy.get('#appsModal .modal-body').should('contain', '1/2');

        // * Still only one modal
        cy.get('[id="appsModal"]').should('have.length', 1);
    });

    it('MM-T2570D - Selecting different missions shows their distinct task lists', () => {
        cy.intercept('POST', '/api/v4/actions/dialogs/submit').as('submitDialog');

        cy.postMessage(`/${createdCommand.trigger} `);
        cy.get('#appsModal').should('be.visible');

        // # Click the radio button for M-1
        cy.get('#appsModal').within(() => {
            cy.contains('label', 'M-1').click();
        });
        cy.wait('@submitDialog').its('response.statusCode').should('eq', 200);

        // * M-1 tasks visible; M-2 tasks not visible
        cy.contains('Secure perimeter').should('be.visible');
        cy.contains('Brief team').should('not.exist');

        // # Go back to board by cancelling, then reopen and select M-2
        cy.get('#appsModalCancel').click();

        // # The cancel notification (notify_on_cancel) also goes through the submit API
        cy.wait('@submitDialog').its('response.statusCode').should('eq', 200);
        cy.get('#appsModal').should('not.exist');

        cy.postMessage(`/${createdCommand.trigger} `);
        cy.get('#appsModal').should('be.visible');

        cy.get('#appsModal').within(() => {
            cy.contains('label', 'M-2').click();
        });
        cy.wait('@submitDialog').its('response.statusCode').should('eq', 200);

        // * M-2 tasks visible; M-1 tasks not visible
        cy.contains('Brief team').should('be.visible');
        cy.contains('Check equipment').should('be.visible');
        cy.contains('Secure perimeter').should('not.exist');
    });

    it('MM-T2570E - Close on the board without choosing a mission closes the dialog', () => {
        cy.intercept('POST', '/api/v4/actions/dialogs/submit').as('submitDialog');

        cy.postMessage(`/${createdCommand.trigger} `);
        cy.get('#appsModalLabel').should('contain', 'Mission Board');

        // # Click Close without selecting a mission
        cy.get('#appsModalSubmit').should('contain', 'Close').click();

        // * The board is submitted without a mission and the dialog closes
        cy.wait('@submitDialog').then(({request, response}) => {
            expect(request.body.callback_id).to.eq('refresh_nav_board');
            // An unselected radio is submitted as an empty value
            expect(request.body.submission.mission_id).to.not.be.ok;
            expect(response.statusCode).to.eq(200);
        });
        cy.get('#appsModal').should('not.exist');
    });
});

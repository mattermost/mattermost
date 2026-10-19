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

let createdCommand;

// Note on selectors: stacked interactive dialogs all render with id `appsModal`.
// cy.get('#appsModal') uses jQuery's getElementById optimization and returns only
// the first match, so the attribute selector `[id="appsModal"]` is used wherever
// BOTH stacked modals must be counted/queried (it falls back to querySelectorAll).
describe('Interactive Dialog - Stacked Dialogs via action_button elements', () => {
    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.requireWebhookServer();

        // # Ensure that teammate name display setting is set to default 'username'
        cy.apiSaveTeammateNameDisplayPreference('username');

        // # Create new team and create command on it
        cy.apiCreateTeam('test-team', 'Test Team').then(({team}) => {
            cy.visit(`/${team.name}`);

            const webhookBaseUrl = Cypress.expose().webhookBaseUrl;

            const command = {
                auto_complete: false,
                description: 'Test for stacked dialogs via action_button elements',
                display_name: 'Action Button Dialog Test',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'action_button_dialog',
                url: `${webhookBaseUrl}/dialog/action_button_request`,
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

    it('MM-T2560A - Parent dialog renders two distinct action_button elements', () => {
        // # Post slash command to open the parent dialog
        cy.postMessage(`/${createdCommand.trigger} `);

        // * Verify that the parent apps form modal opens
        cy.get('#appsModal').should('be.visible').within(() => {
            // * Verify the title is correct
            cy.get('#appsModalLabel').should('contain', 'Parent Dialog with Action Button');

            cy.get('.modal-body').within(() => {
                // * Verify the text field is rendered
                cy.contains('Your Name').should('be.visible');

                // * Verify BOTH action_button elements render as buttons
                cy.contains('button', 'Open Details').should('be.visible');
                cy.contains('button', 'Open Summary').should('be.visible');
            });

            // * Verify the standard submit and cancel buttons are present
            cy.get('#appsModalSubmit').should('be.visible');
            cy.get('#appsModalCancel').should('be.visible');
        });
    });

    it('MM-T2560B - "Open Details" button stacks a child dialog that reflects the Details source', () => {
        // # Intercept the execute API call triggered by the action_button click
        cy.intercept('POST', '/api/v4/actions/dialogs/execute').as('executeAction');

        // # Open the parent dialog
        cy.postMessage(`/${createdCommand.trigger} `);
        cy.get('#appsModal').should('be.visible');
        cy.get('#appsModalLabel').should('contain', 'Parent Dialog with Action Button');

        // # Click the "Open Details" action button
        cy.get('#appsModal').within(() => {
            cy.contains('button', 'Open Details').click();
        });
        cy.wait('@executeAction').its('response.statusCode').should('eq', 200);

        // * The child dialog reflects WHERE it was pressed: title + introduction.
        // Assert the title first — it is the real render synchronizer, so the modal
        // count below becomes an instant check instead of the retry driver.
        cy.contains('[id="appsModalLabel"]', 'Details Dialog').should('be.visible');
        cy.contains('This child dialog was opened from the "Details" action button.').should('be.visible');

        // * The child dialog stacks on top while the parent stays open (2 modals)
        cy.get('[id="appsModal"]').should('have.length', 2);

        // * The Summary child was NOT opened
        cy.contains('[id="appsModalLabel"]', 'Summary Dialog').should('not.exist');

        // * The parent dialog is still present underneath
        cy.contains('[id="appsModalLabel"]', 'Parent Dialog with Action Button').should('exist');
    });

    it('MM-T2560C - "Open Summary" button stacks a child dialog that reflects the Summary source', () => {
        // # Intercept the execute API call
        cy.intercept('POST', '/api/v4/actions/dialogs/execute').as('executeAction');

        // # Open the parent dialog
        cy.postMessage(`/${createdCommand.trigger} `);
        cy.get('#appsModal').should('be.visible');

        // # Click the "Open Summary" action button
        cy.get('#appsModal').within(() => {
            cy.contains('button', 'Open Summary').click();
        });
        cy.wait('@executeAction').its('response.statusCode').should('eq', 200);

        // * The child dialog reflects the Summary source — assert the title first as
        // the render synchronizer, proving the two buttons open distinct child dialogs.
        cy.contains('[id="appsModalLabel"]', 'Summary Dialog').should('be.visible');
        cy.contains('This child dialog was opened from the "Summary" action button.').should('be.visible');

        // * The child dialog stacks on top (2 modals)
        cy.get('[id="appsModal"]').should('have.length', 2);

        // * The Details child was NOT opened
        cy.contains('[id="appsModalLabel"]', 'Details Dialog').should('not.exist');

        // * The parent dialog is still present underneath
        cy.contains('[id="appsModalLabel"]', 'Parent Dialog with Action Button').should('exist');
    });

    it('MM-T2560D - Submitting the child dialog returns to the parent dialog', () => {
        // # Intercept the execute API call
        cy.intercept('POST', '/api/v4/actions/dialogs/execute').as('executeAction');

        // # Open the parent dialog and click an action button
        cy.postMessage(`/${createdCommand.trigger} `);
        cy.get('#appsModal').should('be.visible');
        cy.get('#appsModal').within(() => {
            cy.contains('button', 'Open Details').click();
        });
        cy.wait('@executeAction').its('response.statusCode').should('eq', 200);

        // * Wait for the child to render, then confirm both dialogs are stacked
        cy.contains('[id="appsModalLabel"]', 'Details Dialog').should('be.visible');
        cy.get('[id="appsModal"]').should('have.length', 2);

        // # Submit the child dialog (target its modal via the verified title)
        cy.contains('[id="appsModalLabel"]', 'Details Dialog').closest('[id="appsModal"]').within(() => {
            cy.get('#appsModalSubmit').click();
        });

        // * The child dialog is dismissed — only the parent remains
        cy.get('[id="appsModal"]').should('have.length', 1);
        cy.get('#appsModalLabel').should('contain', 'Parent Dialog with Action Button');
    });
});

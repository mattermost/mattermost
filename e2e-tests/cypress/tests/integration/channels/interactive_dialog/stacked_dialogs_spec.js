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
 * Covers stacked interactive dialogs (Mission → Cargo → Sortie schedule demo):
 * - An action button opens a child dialog on top; the parent stays mounted but hidden
 * - Closing the child shows the parent again; a parent with refresh_on_return re-fetches
 *   its form from source_url and keeps the values the user typed
 * - submit_buttons renders a select's options as separate submit buttons
 *
 * Note on selectors: stacked dialogs stay mounted, but only the visible one carries the
 * `appsModal*` ids (a hidden parent drops them so aria-labelledby resolves to the visible
 * dialog). `.apps-form-modal` matches every mounted dialog. `:visible` is kept on the top
 * dialog query because a closing child still has its ids during its fade-out.
 */

const MISSION_TITLE = 'M-1 — Operation Falcon';
const CARGO_TITLE = 'Cargo by Sortie — M-1';

let missionCommand;
let submitButtonsCommand;

// No assertion in this chain, so a following .find() retries the whole query while
// dialogs are switching.
function topDialog() {
    return cy.get('[id="appsModal"]:visible');
}

// Waits until the dialog with this title is the only visible one.
function expectTopDialog(title) {
    cy.contains('[id="appsModalLabel"]', title).should('be.visible');
    cy.get('[id="appsModal"]:visible').should('have.length', 1);
}

// The dialog submit API carries submits, cancel notifications and source_url
// refreshes; alias refreshes separately so tests can wait on each kind.
function interceptDialogApis() {
    cy.intercept('POST', '/api/v4/actions/dialogs/execute').as('executeAction');
    cy.intercept('POST', '/api/v4/actions/dialogs/submit', (req) => {
        req.alias = req.body.type === 'refresh' ? 'refreshDialog' : 'submitDialog';
    });
}

function openMissionDialog() {
    cy.postMessage(`/${missionCommand.trigger} `);
    expectTopDialog(MISSION_TITLE);
}

function openCargoDialog() {
    openMissionDialog();

    // # Click the Cargo action button on the Mission dialog
    topDialog().within(() => {
        cy.contains('button', 'Cargo').click();
    });
    cy.wait('@executeAction').its('response.statusCode').should('eq', 200);
    expectTopDialog(CARGO_TITLE);
}

// Returns the row (summary text + Schedule button) for a sortie in the Cargo dialog.
function sortieRow(sortieId) {
    return cy.contains('[id="appsModal"]:visible .apps-form-action-button', `${sortieId} ·`);
}

function sortieRowText(sortieId) {
    return sortieRow(sortieId).find('.apps-form-action-button__description');
}

describe('Interactive Dialog - Stacked dialogs', () => {
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
                description: 'Test for stacked interactive dialogs',
                display_name: 'Stacked Dialogs Test',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'mission_dialog',
                url: `${webhookBaseUrl}/dialog/mission`,
                username: '',
            };

            cy.apiCreateCommand(command).then(({data}) => {
                missionCommand = data;
            });

            cy.apiCreateCommand({
                ...command,
                description: 'Test for dialog submit_buttons',
                display_name: 'Submit Buttons Dialog Test',
                trigger: 'submit_buttons_dialog',
                url: `${webhookBaseUrl}/dialog/submit_buttons`,
            }).then(({data}) => {
                submitButtonsCommand = data;
            });
        });
    });

    afterEach(() => {
        cy.reload();
    });

    it('MM-T2580A - Action button opens a child dialog on top and hides the parent', () => {
        interceptDialogApis();

        // # Open the Mission dialog and click Cargo
        openCargoDialog();

        // * Both dialogs are mounted, but only the child is visible
        cy.get('.apps-form-modal').should('have.length', 2);
        cy.get('[id="appsModal"]:visible').should('have.length', 1);

        // * The parent Mission dialog is still in the DOM but hidden, without the dialog ids
        cy.contains('.apps-form-modal .modal-title', MISSION_TITLE).should('exist').and('not.be.visible').and('not.have.attr', 'id');

        // * Only the visible dialog has the title id that aria-labelledby points to
        cy.get('[id="appsModalLabel"]').should('have.length', 1).and('contain', CARGO_TITLE);
        cy.get('[id="appsModal"]').should('have.attr', 'aria-labelledby', 'appsModalLabel');

        // * Only one backdrop is shown
        // (Checked via computed display: Cypress treats a fixed backdrop covered by the modal as not visible.)
        cy.get('.modal-backdrop').
            filter((i, el) => Cypress.$(el).css('display') !== 'none').
            should('have.length', 1);

        // * The Cargo dialog shows a row with a Schedule button for each sortie
        topDialog().within(() => {
            cy.contains('Select a sortie to view its schedule.').should('be.visible');
            cy.get('#dispatcher_notes').should('be.visible');
            cy.contains('button', 'Schedule').should('be.visible');
        });
        ['S-101', 'S-102', 'S-103'].forEach((sortieId) => {
            sortieRow(sortieId).find('button').should('contain', 'Schedule');
        });
    });

    it('MM-T2580B - Saving a child schedule refreshes the parent Cargo dialog (refresh_on_return)', () => {
        interceptDialogApis();
        openCargoDialog();

        // # Read the current task progress for S-103
        sortieRowText('S-103').invoke('text').then((rowText) => {
            const [, doneBefore, total] = rowText.match(/tasks (\d+)\/(\d+)/);

            // # Open the S-103 schedule on top of the Cargo dialog
            sortieRow('S-103').find('button').click();
            cy.wait('@executeAction').its('response.statusCode').should('eq', 200);
            expectTopDialog('S-103 Schedule — KADW');

            // * Three dialogs are mounted, one is visible
            cy.get('.apps-form-modal').should('have.length', 3);
            cy.contains('.apps-form-modal .modal-title', CARGO_TITLE).should('not.be.visible');

            // # Toggle the first task
            topDialog().find('#task_0').then(($checkbox) => {
                const wasChecked = $checkbox.prop('checked');
                const expectedDone = Number(doneBefore) + (wasChecked ? -1 : 1);

                cy.wrap($checkbox).click();
                cy.wrap($checkbox).should(wasChecked ? 'not.be.checked' : 'be.checked');

                // # Save the schedule
                topDialog().find('#appsModalSubmit').click();

                // * The schedule submission carries the toggled task
                cy.wait('@submitDialog').then(({request, response}) => {
                    expect(request.body.callback_id).to.eq('mission_schedule');
                    expect(request.body.state).to.eq('S-103');
                    expect(String(request.body.submission.task_0)).to.eq(String(!wasChecked));
                    expect(response.statusCode).to.eq(200);
                });

                // * The Cargo dialog re-fetched its form from source_url when it became top again
                cy.wait('@refreshDialog').then(({request, response}) => {
                    expect(request.body.url).to.include('/dialog/mission/cargo_source');
                    expect(request.body.callback_id).to.eq('mission_cargo');
                    expect(response.statusCode).to.eq(200);
                });

                // * Cargo is visible again and shows the updated progress
                cy.get('.apps-form-modal').should('have.length', 2);
                expectTopDialog(CARGO_TITLE);
                sortieRowText('S-103').should('contain', `tasks ${expectedDone}/${total}`);
            });
        });
    });

    it('MM-T2580C - Values typed in the parent survive the child closing and the parent refreshing', () => {
        interceptDialogApis();
        openCargoDialog();

        const notes = `Fragile load ${Date.now()}`;

        // # Type into the Cargo dialog's Notes field
        topDialog().find('#dispatcher_notes').type(notes).should('have.value', notes);

        // # Open the S-102 schedule, then cancel it
        sortieRow('S-102').find('button').click();
        cy.wait('@executeAction').its('response.statusCode').should('eq', 200);
        expectTopDialog('S-102 Schedule — OKAS');
        topDialog().find('#appsModalCancel').click();

        // * The cancel notification is sent for the schedule dialog
        cy.wait('@submitDialog').its('request.body').should((body) => {
            expect(body.cancelled).to.eq(true);
            expect(body.callback_id).to.eq('mission_schedule');
        });

        // * The refresh request sends the typed value to source_url
        cy.wait('@refreshDialog').then(({request, response}) => {
            expect(request.body.submission.dispatcher_notes).to.eq(notes);
            expect(response.statusCode).to.eq(200);
        });

        // * Cargo is visible again with the typed value still in place
        expectTopDialog(CARGO_TITLE);
        topDialog().find('#dispatcher_notes').should('have.value', notes);
    });

    it('MM-T2580D - Cancelling the child dialog shows the parent dialog again', () => {
        interceptDialogApis();
        openCargoDialog();

        // # Cancel the Cargo dialog
        topDialog().find('#appsModalCancel').click();

        // * The cancel notification is sent for the Cargo dialog
        cy.wait('@submitDialog').its('request.body').should((body) => {
            expect(body.cancelled).to.eq(true);
            expect(body.callback_id).to.eq('mission_cargo');
        });

        // * Only the Mission dialog remains, and it is visible
        cy.get('.apps-form-modal').should('have.length', 1);
        expectTopDialog(MISSION_TITLE);
        cy.contains('.apps-form-modal .modal-title', CARGO_TITLE).should('not.exist');

        // # Close the Mission dialog
        topDialog().find('#appsModalSubmit').click();
        cy.wait('@submitDialog').its('request.body.callback_id').should('eq', 'mission_overview');

        // * No dialogs remain
        cy.get('.apps-form-modal').should('not.exist');
    });

    it('MM-T2580E - submit_buttons renders one submit button per option and submits its value', () => {
        interceptDialogApis();

        // # Open the submit buttons dialog
        cy.postMessage(`/${submitButtonsCommand.trigger} `);
        topDialog().within(() => {
            cy.get('#appsModalLabel').should('contain', 'Submit Buttons Demo');
            cy.contains('Notes added: 0').should('be.visible');

            // * Each option is rendered as its own submit button in place of the default one
            cy.get('#appsModalSubmitadd').should('be.visible').and('contain', 'Add Note');
            cy.get('#appsModalSubmitsave').should('be.visible').and('contain', 'Save & Close');
            cy.get('#appsModalSubmit').should('not.exist');

            // * The select element itself is not rendered as a field
            cy.get('.modal-body').should('not.contain', 'Action');

            // * Other fields are still rendered
            cy.get('#note').should('be.visible');

            // # Enter a note and click "Add Note"
            cy.get('#note').type('First note');
            cy.get('#appsModalSubmitadd').click();
        });

        // * The clicked option's value is submitted under the select's name
        cy.wait('@submitDialog').then(({request, response}) => {
            expect(request.body.callback_id).to.eq('submit_buttons_demo');
            expect(request.body.submission.action).to.eq('add');
            expect(request.body.submission.note).to.eq('First note');
            expect(response.statusCode).to.eq(200);
        });

        // * "add" returns a new form, so the dialog stays open with the updated content
        topDialog().within(() => {
            cy.contains('Notes added: 1').should('be.visible');
            cy.contains('Last note: First note').should('be.visible');
            cy.get('#appsModalSubmitsave').should('be.visible');

            // # Click "Save & Close"
            cy.get('#appsModalSubmitsave').click();
        });

        // * The "save" value is submitted and the dialog closes
        cy.wait('@submitDialog').then(({request, response}) => {
            expect(request.body.submission.action).to.eq('save');
            expect(response.statusCode).to.eq(200);
        });
        cy.get('.apps-form-modal').should('not.exist');
    });
});

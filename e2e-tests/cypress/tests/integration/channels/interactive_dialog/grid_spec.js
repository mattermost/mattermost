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

import * as TIMEOUTS from '@/fixtures/timeouts';

let createdCommand;

// The grid is a layout over ordinary dialog elements: every cell is a real
// element with a synthesized name (cell_r1_weight), the cells of one row are
// grouped in a collapsible, and those rows sit inside a container collapsible
// with subtype 'grid'. These tests are about that layout and the submission
// round trip, so they assert on table structure and on which cell an error
// lands in, not on the sample data itself.
describe('Interactive Dialog - Grid layout', () => {
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
                description: 'Test for grid layout in interactive dialogs',
                display_name: 'Grid Dialog Test',
                icon_url: '',
                method: 'P',
                team_id: team.id,
                trigger: 'grid_dialog',
                url: `${webhookBaseUrl}/dialog/grid`,
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

    it('MM-T5700A - Grid container renders child sections as table rows', () => {
        // # Post a slash command to open the grid dialog
        openGridDialog();

        cy.get('#appsModal').within(() => {
            cy.get('#appsModalLabel').should('contain', 'Order Queue');

            cy.get('.apps-form-grid table').within(() => {
                // * Column headers come from the first row, so each appears
                // once rather than once per row
                cy.get('thead th').should('have.length', 4);
                cy.get('thead th').eq(0).should('contain', 'Order #');
                cy.get('thead th').eq(1).should('contain', 'Weight (kg)');
                cy.get('thead th').eq(2).should('contain', 'Status');
                cy.get('thead th').eq(3).should('contain', 'Details');

                // * The first column header is the corner cell above the row
                // headers
                cy.get('thead th').eq(0).should('have.class', 'apps-form-grid__corner');

                // * One row per record, each with a cell per column
                cy.get('tbody tr').should('have.length', 2);
                cy.get('tbody tr').each(($row) => {
                    cy.wrap($row).find('th, td').should('have.length', 4);
                });
            });
        });

        closeAppsFormModal();
    });

    it('MM-T5700B - Row header column is sticky and still editable', () => {
        openGridDialog();

        cy.get('#appsModal').within(() => {
            cy.get('.apps-form-grid tbody tr').first().within(() => {
                // * The first cell of each row is a row header rather than an
                // ordinary cell
                cy.get('th[scope="row"]').
                    should('have.length', 1).
                    and('have.class', 'apps-form-grid__row-header');

                // * It holds a real input, not static text: a record's
                // identifier is usually something the user is filling in too
                cy.get('th[scope="row"] input').
                    should('exist').
                    and('have.value', 'SO-1042').

                    // # Edit the row header
                    clear().
                    type('SO-9999').
                    should('have.value', 'SO-9999');
            });
        });

        closeAppsFormModal();
    });

    it('MM-T5700C - Cell labels are hidden visually but kept for assistive technology', () => {
        openGridDialog();

        cy.get('#appsModal').within(() => {
            // * The column header carries the visible text, so the per-cell
            // labels must not be shown a second time in every row
            cy.get('.apps-form-grid tbody label').should('not.be.visible');

            // * They are still in the DOM, so the inputs stay labelled
            cy.get('.apps-form-grid tbody label').should('have.length.greaterThan', 0);

            // * The container's own label is the stacked-mode section title and
            // is not shown in grid mode
            cy.get('.apps-form-grid').should('not.contain', 'Orders');
        });

        closeAppsFormModal();
    });

    it('MM-T5700D - Adding a row grows the table in place and keeps typed values', () => {
        openGridDialog();

        cy.get('#appsModal').within(() => {
            // # Type into a cell of the first row before refreshing. Keep this
            // a whole number: the weight cell is subtype 'number', and
            // TextSetting runs those through parseInt, so a decimal is
            // truncated before it ever reaches the submission. That is a
            // pre-existing bug in number inputs rather than anything to do with
            // the grid, so this spec stays clear of it.
            cy.get('.apps-form-grid tbody tr').first().find('td input').first().type('12');

            // # Toggle the refresh-enabled add-row field
            cy.contains('.form-group', 'Add an order').find('input[type="checkbox"]').click({force: true});
            cy.wait(TIMEOUTS.ONE_SEC);

            // * The modal stays open on the same dialog; a refresh replaces the
            // contents rather than opening a new modal
            cy.get('#appsModalLabel').should('contain', 'Order Queue');

            // * The table grew by one row in place
            cy.get('.apps-form-grid tbody tr').should('have.length', 3);

            // * Half-finished input survives the refresh, because the cells
            // round trip as ordinary fields and come back as defaults
            cy.get('.apps-form-grid tbody tr').first().find('td input').first().should('have.value', '12');
            cy.get('.apps-form-grid tbody tr').first().find('th[scope="row"] input').should('have.value', 'SO-1042');

            // * The added row is blank and sits under the same columns
            cy.get('.apps-form-grid tbody tr').eq(2).find('th[scope="row"] input').should('have.value', '');
            cy.get('.apps-form-grid thead th').should('have.length', 4);
        });

        closeAppsFormModal();
    });

    it('MM-T5700E - A server error lands on the one offending cell', () => {
        openGridDialog();

        cy.get('#appsModal').within(() => {
            // # A negative weight is a value the client accepts and the server
            // rejects, which is what forces a server round trip
            cy.get('.apps-form-grid tbody tr').eq(1).find('td input').first().type('-5');

            // # Submit the whole table
            cy.get('#appsModalSubmit').click();
            cy.wait(TIMEOUTS.ONE_SEC);

            // * The modal stays open with every value intact
            cy.get('#appsModalLabel').should('contain', 'Order Queue');
            cy.get('.apps-form-grid tbody tr').eq(1).find('td input').first().should('have.value', '-5');

            // * The error is rendered in the cell it belongs to, and nowhere
            // else: names are unique across the table, so one error addresses
            // exactly one input
            cy.get('.apps-form-grid tbody tr').eq(1).within(() => {
                cy.contains('Enter a weight of 0 or more').should('exist');
            });
            cy.get('.apps-form-grid tbody tr').eq(0).within(() => {
                cy.contains('Enter a weight of 0 or more').should('not.exist');
            });
        });

        closeAppsFormModal();
    });

    it('MM-T5700F - Dialog width tier resizes the open modal without losing input', () => {
        openGridDialog();

        // * The dialog asked for the large tier, which is what gives the grid
        // room; the historical width is what an unset size still gets
        cy.get('.modal-dialog').should('have.class', 'apps-form-modal--large');

        cy.get('#appsModal').within(() => {
            // # Type into a cell, then change the width
            cy.get('.apps-form-grid tbody tr').first().find('td input').first().type('7');

            cy.contains('.form-group', 'Dialog width').find('[id^=\'MultiInput_\']').click();
        });

        cy.wait(TIMEOUTS.HALF_SEC);
        cy.document().then((doc) => {
            cy.wrap(doc).find('.react-select__option').contains('Small').click();
        });
        cy.wait(TIMEOUTS.ONE_SEC);

        // * The same modal is now at the narrow tier rather than a new one
        cy.get('.modal-dialog').should('not.have.class', 'apps-form-modal--large');
        cy.get('#appsModalLabel').should('contain', 'Order Queue');

        cy.get('#appsModal').within(() => {
            // * Typed values survive the resize, because a width change is an
            // ordinary refresh
            cy.get('.apps-form-grid tbody tr').first().find('td input').first().should('have.value', '7');

            // * The grid does not fit at the narrow tier, so it scrolls
            // sideways rather than squeezing the inputs
            cy.get('.apps-form-grid__scroll').should('have.css', 'overflow-x', 'auto');
        });

        closeAppsFormModal();
    });

    it('MM-T5700G - A button cell opens a child dialog for its own row', () => {
        openGridDialog();

        // # Click the Details button in the second row
        cy.get('#appsModal').within(() => {
            cy.get('.apps-form-grid tbody tr').eq(1).find('td').last().find('button').click();
        });
        cy.wait(TIMEOUTS.ONE_SEC);

        // * A child dialog stacks on top, named for the row whose button was
        // clicked. A click carries only the button's static context, so the row
        // has to name itself there.
        cy.contains('[id="appsModalLabel"]', 'r2 Dialog').should('be.visible');
        cy.get('[id="appsModal"]').should('have.length', 2);

        // * The parent grid is still open underneath
        cy.contains('[id="appsModalLabel"]', 'Order Queue').should('exist');
    });

    it('MM-T5700H - A valid grid submits every cell as an ordinary flat value', () => {
        openGridDialog();

        cy.get('#appsModal').within(() => {
            // # Fill in both rows
            cy.get('.apps-form-grid tbody tr').eq(0).find('td input').first().type('10');
            cy.get('.apps-form-grid tbody tr').eq(1).find('td input').first().type('20');

            // # Submit the whole table at once; a dialog has one submit button
            cy.get('#appsModalSubmit').click();
        });

        // * The modal closes and the server received the cells keyed by their
        // own names
        cy.get('#appsModal').should('not.exist');
        cy.getLastPost().should('contain', 'Grid submitted').
            and('contain', '"weight":"10"').
            and('contain', '"weight":"20"');
    });
});

function openGridDialog() {
    cy.postMessage(`/${createdCommand.trigger} `);
    cy.get('#appsModal').should('be.visible');
    cy.get('.apps-form-grid table').should('be.visible');
}

function closeAppsFormModal() {
    cy.get('.modal-header').should('be.visible').within(($elForm) => {
        cy.wrap($elForm).find('button.close').should('be.visible').click();
    });
    cy.get('#appsModal').should('not.exist');
}

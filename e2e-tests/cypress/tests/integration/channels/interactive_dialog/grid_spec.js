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

// The width each tier resolves to on a window wide enough to hold it. The
// run's viewport is 1300px and every dialog is capped at 95% of that, so all
// three fit and can be measured rather than inferred from a class name.
const TIER_WIDTHS = {
    small: 600,
    medium: 700,
    large: 900,
};

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

    beforeEach(() => {
        // Every refresh and every submission goes through this one route, so
        // the tests below wait on the response rather than on a fixed delay.
        cy.intercept('POST', '/api/v4/actions/dialogs/submit').as('dialogSubmit');
        cy.intercept('POST', '/api/v4/actions/dialogs/execute').as('executeAction');
    });

    afterEach(() => {
        // # Reload current page after each test to close any dialogs left open
        cy.reload();
    });

    it('Grid container renders child sections as table rows', () => {
        // # Post a slash command to open the grid dialog
        openGridDialog();

        cy.get('#appsModal').within(() => {
            cy.get('#appsModalLabel').should('contain', 'Order Queue');

            // * A grid container is still a collapsible, so its own
            // display_name is the section heading above the table
            cy.get('.apps-form-collapsible-section__title').should('contain', 'Orders');

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

    it('Row header column stays put while the rest of the row scrolls, and stays editable', () => {
        // # Narrow the window until the grid genuinely overflows, which is the
        // only condition under which being pinned means anything. This sample
        // is four columns and squeezes down to about 500px, so it still fits
        // inside the 600px tier on a desktop window; the window has to come
        // below that floor for the row header to have anything to stay put
        // against.
        cy.viewport(500, 900);
        openGridDialog();

        // * The first cell of each row is a row header rather than an ordinary
        // cell, and it is the one that is pinned
        cy.get('#appsModal .apps-form-grid tbody tr').first().find('th[scope="row"]').
            should('have.length', 1).
            and('have.class', 'apps-form-grid__row-header').
            and('have.css', 'position', 'sticky');

        // * The table is genuinely wider than the box it sits in, which is the
        // only condition under which being pinned means anything
        cy.get('#appsModal .apps-form-grid__scroll').should(($scroll) => {
            expect($scroll[0].scrollWidth).to.be.greaterThan($scroll[0].clientWidth);
        });

        // # Record where the row header and the first data cell start
        cy.get('#appsModal .apps-form-grid tbody tr').first().find('th[scope="row"]').
            then(($header) => cy.wrap($header[0].getBoundingClientRect().left).as('headerLeft'));
        cy.get('#appsModal .apps-form-grid tbody tr').first().find('td').first().
            then(($cell) => cy.wrap($cell[0].getBoundingClientRect().left).as('cellLeft'));

        // # Scroll the table sideways
        cy.get('#appsModal .apps-form-grid__scroll').scrollTo('right');

        // * The data cell moved, so the table really scrolled...
        cy.get('@cellLeft').then((cellLeft) => {
            cy.get('#appsModal .apps-form-grid tbody tr').first().find('td').first().should(($scrolled) => {
                expect($scrolled[0].getBoundingClientRect().left).to.be.lessThan(cellLeft);
            });
        });

        // * ...and the row header did not, so it is still clear which record
        // the cells on screen belong to
        cy.get('@headerLeft').then((headerLeft) => {
            cy.get('#appsModal .apps-form-grid tbody tr').first().find('th[scope="row"]').should(($stuck) => {
                expect($stuck[0].getBoundingClientRect().left).to.be.closeTo(headerLeft, 1);
            });
        });

        // * It holds a real input, not static text: a record's identifier is
        // usually something the user is filling in too
        cy.get('#appsModal .apps-form-grid tbody tr').first().find('th[scope="row"] input').
            should('have.value', 'SO-1042').

            // # Edit the row header
            clear().
            type('SO-9999').
            should('have.value', 'SO-9999');

        closeAppsFormModal();
    });

    it('Cell labels are clipped but kept for assistive technology', () => {
        openGridDialog();

        cy.get('#appsModal').within(() => {
            // * The column header carries the visible text, so the per-cell
            // labels must not be shown a second time in every row. They are
            // clipped rather than hidden, which is what keeps them announced,
            // so this checks the clip itself: `should('not.be.visible')` passes
            // for a clipped element whether or not the rule is there at all.
            cy.get('.apps-form-grid tbody .form-group > label').
                should('have.length.greaterThan', 0).
                each(($label) => {
                    const rect = $label[0].getBoundingClientRect();
                    expect(rect.width, 'clipped label width').to.be.lessThan(2);
                    expect(rect.height, 'clipped label height').to.be.lessThan(2);
                    expect($label).to.have.css('position', 'absolute');
                });

            // * The table and each row are named for a screen reader: the
            // caption names the table, and each row keeps its own display_name
            cy.get('.apps-form-grid table caption').
                should('have.class', 'sr-only').
                and('contain', 'Orders');
            cy.get('.apps-form-grid tbody tr').first().
                find('th[scope="row"] .sr-only').should('contain', 'SO-1042');
        });

        closeAppsFormModal();
    });

    it('Adding a row grows the table in place and keeps typed values', () => {
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
        });

        cy.wait('@dialogSubmit').its('response.statusCode').should('eq', 200);

        cy.get('#appsModal').within(() => {
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

    it('A server error lands on the one offending cell', () => {
        openGridDialog();

        cy.get('#appsModal').within(() => {
            // # A negative weight is a value the client accepts and the server
            // rejects, which is what forces a server round trip
            cy.get('.apps-form-grid tbody tr').eq(1).find('td input').first().type('-5');

            // # Submit the whole table
            cy.get('#appsModalSubmit').click();
        });

        cy.wait('@dialogSubmit').its('response.statusCode').should('eq', 200);

        cy.get('#appsModal').within(() => {
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

    it('Dialog width tier sizes the modal, and a refresh resizes it without losing input', () => {
        openGridDialog();

        // * The dialog asked for the large tier, which is what gives the grid
        // room. Measure it rather than trusting the class: a class name would
        // still be there if the stylesheet that gives it a width were not.
        shouldMeasure('large');

        cy.get('#appsModal').within(() => {
            // # Type into a cell, then change the width
            cy.get('.apps-form-grid tbody tr').first().find('td input').first().type('7');
        });

        chooseWidth('Medium');

        // * The same modal is now one tier narrower rather than a new one
        shouldMeasure('medium');
        cy.get('#appsModalLabel').should('contain', 'Order Queue');

        chooseWidth('Small');

        // * ...and down to the historical width, which is what a dialog that
        // sets no size at all gets
        shouldMeasure('small');

        cy.get('#appsModal').within(() => {
            // * Typed values survive both resizes, because a width change is an
            // ordinary refresh
            cy.get('.apps-form-grid tbody tr').first().find('td input').first().should('have.value', '7');
        });

        closeAppsFormModal();
    });

    it('A wide tier shrinks to the window rather than forcing the page sideways', () => {
        // # A window narrower than the large tier, and narrower than the 768px
        // at which a dialog stops being fluid at all
        cy.viewport(700, 900);
        openGridDialog();

        cy.get('.modal-dialog.apps-form-modal-dialog').
            should('have.class', 'apps-form-modal--large').
            and(($dialog) => {
                // * The tier is capped to the window instead of overflowing it
                expect($dialog[0].getBoundingClientRect().width).to.be.lessThan(700);
            });

        // * ...and nothing pushed the page itself sideways
        cy.document().should((doc) => {
            expect(doc.documentElement.scrollWidth).to.be.at.most(doc.documentElement.clientWidth);
        });

        closeAppsFormModal();
    });

    it('A button cell opens a child dialog for its own row', () => {
        openGridDialog();

        // # Click the Details button in the second row
        cy.get('#appsModal').within(() => {
            cy.get('.apps-form-grid tbody tr').eq(1).find('td').last().find('button').click();
        });

        cy.wait('@executeAction').its('response.statusCode').should('eq', 200);

        // * A child dialog stacks on top, named for the row whose button was
        // clicked. A click carries only the button's static context, so the row
        // has to name itself there.
        cy.contains('[id="appsModalLabel"]', 'r2 Dialog').should('be.visible');
        cy.get('.apps-form-modal').should('have.length', 2);

        // * The parent grid is still open underneath (hidden, so it has no appsModal ids)
        cy.contains('.apps-form-modal .modal-title', 'Order Queue').should('exist');
    });

    it('A valid grid submits every cell as an ordinary flat value', () => {
        openGridDialog();

        cy.get('#appsModal').within(() => {
            // # Fill in both rows
            cy.get('.apps-form-grid tbody tr').eq(0).find('td input').first().type('10');
            cy.get('.apps-form-grid tbody tr').eq(1).find('td input').first().type('20');

            // # Submit the whole table at once; a dialog has one submit button
            cy.get('#appsModalSubmit').click();
        });

        cy.wait('@dialogSubmit').its('response.statusCode').should('eq', 200);

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

// shouldMeasure asserts the modal is actually the width its tier promises,
// rather than merely carrying the class that is supposed to give it one.
function shouldMeasure(tier) {
    cy.get('.modal-dialog.apps-form-modal-dialog').should(($dialog) => {
        expect($dialog[0].getBoundingClientRect().width, `${tier} tier width`).to.be.closeTo(TIER_WIDTHS[tier], 2);
    });
}

// chooseWidth picks a tier from the refresh-enabled width select and waits for
// the form that comes back, which is what resizes the modal in place.
function chooseWidth(label) {
    cy.get('#appsModal').within(() => {
        cy.contains('.form-group', 'Dialog width').find('[id^=\'MultiInput_\']').click();
    });

    cy.document().then((doc) => {
        cy.wrap(doc).find('.react-select__option').contains(label).click();
    });

    cy.wait('@dialogSubmit').its('response.statusCode').should('eq', 200);
}

function closeAppsFormModal() {
    cy.get('.modal-header').should('be.visible').within(($elForm) => {
        cy.wrap($elForm).find('button.close').should('be.visible').click();
    });
    cy.get('#appsModal').should('not.exist');
}

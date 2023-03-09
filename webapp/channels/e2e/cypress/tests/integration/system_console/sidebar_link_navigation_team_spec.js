// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @te_only @system_console

import * as TIMEOUTS from '../../fixtures/timeouts';
import {adminConsoleNavigation} from '../../utils/admin_console';

describe('System Console - Team', () => {
    before(() => {
        cy.shouldRunOnTeamEdition();

        // # Go to system admin then verify admin console URL and header
        cy.visit('/admin_console/about/license');
        cy.url().should('include', '/admin_console/about/license');
        cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).
            should('be.visible').
            and('have.text', 'Edition and License');
    });

    const serverType = 'team';
    adminConsoleNavigation.forEach((testCase, index) => {
        const canNavigate = testCase.type.includes(serverType);
        const testTitle = `MM-T4263_${index + 1} ${canNavigate ? 'can' : 'cannot'} navigate to ${testCase.team_header || testCase.header}`;
        const testFn = canNavigate ? verifyCanNavigate : verifyCannotNavigate;

        it(testTitle, () => {
            testFn(testCase);
        });
    });
});

function verifyCanNavigate(testCase) {
    // # Click the link on the sidebar
    cy.get('.admin-sidebar', {timeout: TIMEOUTS.ONE_MIN}).
        should('be.visible').
        findByText(testCase.sidebar).
        scrollIntoView().
        should('be.visible').
        click();

    // * Verify that it redirects to the URL and matches with the header
    cy.url().should('include', testCase.url);
    cy.get('.admin-console__header', {timeout: TIMEOUTS.ONE_MIN}).
        should('be.visible').
        and(testCase.headerContains ? 'contain' : 'have.text', testCase.team_header || testCase.header);
}

function verifyCannotNavigate(testCase) {
    // # Header should not exist in sidebar
    cy.get('.admin-sidebar', {timeout: TIMEOUTS.ONE_MIN}).
        should('be.visible').
        findByText(testCase.sidebar).
        should('not.exist');

    // # Visit the URL directly
    cy.visit(testCase.url);

    // * Verify that it redirects to Edition and License page
    cy.url().should('include', '/admin_console/about/license');
}

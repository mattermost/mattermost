// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @system_console @te_only

describe('Settings', () => {
    before(() => {
        cy.shouldRunOnTeamEdition();
    });

    it('MM-T1149 Hide mobile-specific settings', () => {
        cy.visit('/admin_console/site_config/file_sharing_downloads');

        // * Check buttons
        cy.get('#adminConsoleWrapper .wrapper--fixed > .admin-console__wrapper').
            should('be.visible').
            and('contain.text', 'Allow File Sharing');

        cy.get('#adminConsoleWrapper .wrapper--fixed > .admin-console__wrapper').
            should('be.visible').
            and('not.contain.text', 'Allow File Uploads on Mobile');

        cy.get('#adminConsoleWrapper .wrapper--fixed > .admin-console__wrapper').
            should('be.visible').
            and('not.contain.text', 'Allow File Downloads on Mobile');
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @channels @system_console @te_only

describe('Support Packet Generation', () => {
    it('MM-T3817 - Commercial Support Dialog UI - No License', () => {
        // # Remove license
        cy.apiAdminLogin();
        cy.apiDeleteLicense();

        // # Go to System Console
        cy.visit('/admin_console');

        cy.findByRole('button', {name: 'Menu Icon'}).should('exist').click();

        // * Make sure the commercial support button takes you to external link
        cy.findByRole('link', {name: 'Commercial Support'}).and('have.attr', 'href').and('include', '/commercial-support/');
    });
});

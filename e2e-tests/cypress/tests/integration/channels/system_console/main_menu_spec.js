// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @system_console

describe('Main menu', () => {
    describe('MM-T909 Can switch to team', () => {
        it('returns to team via BackstageNavbar when user has a single team', () => {
            cy.visit('/admin_console');

            // # Open the system console header menu
            cy.findByRole('button', {name: 'Admin Console Menu'}).should('be.visible').click();

            // * With a single team, Switch teams is not shown in the header menu
            cy.findByRole('menu', {name: 'Admin Console Menu'}).within(() => {
                cy.findByText('Switch teams').should('not.exist');
            });

            // * Return to team via BackstageNavbar instead
            cy.findByTestId('backstage-navbar-back').should('be.visible').click();
            cy.url().should('include', '/eligendi');
        });
    });

    describe('header menu items', () => {
        before(() => {
            cy.visit('/admin_console');

            // # Open the system console header menu
            cy.findByRole('button', {name: 'Admin Console Menu'}).should('be.visible').click();
        });

        it('MM-T910 Can open Administrators Guide', () => {
            // * Verify administrator's guide menu item is visible
            cy.findByText("Administrator's Guide").should('be.visible');
        });

        it('MM-T911 Can open Troubleshooting Forum', () => {
            // * Verify troubleshooting forum menu item is visible
            cy.findByText('Troubleshooting Forum').should('be.visible');
        });

        it('MM-T914 Can log out from system console', () => {
            // * Verify log out button is visible
            cy.findByText('Log Out').should('be.visible');
        });

        it('MM-T912 Can open Commercial Support', () => {
            // * Verify commercial support
            cy.findByText('Commercial Support').click();
            cy.get('#commercialSupportModal').should('be.visible');
            cy.uiClose();
        });
    });
});

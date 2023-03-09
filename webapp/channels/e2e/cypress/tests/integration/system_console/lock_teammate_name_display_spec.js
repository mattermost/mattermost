// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @system_console

describe('System Console', () => {
    let townSquareUrl;

    before(() => {
        // # Initialize setup and visit town-square
        cy.apiInitSetup().then((out) => {
            townSquareUrl = out.townSquareUrl;
        });
    });

    it('MM-T1100 Lock Teammate Name Display for all users', () => {
        // # Go to system admin page
        cy.visit('/admin_console/site_config/users_and_teams');

        // # Set Teammate Name Display dropdown to 'Show nickname if one exists, otherwise show first and last name' and set Lock Teammate Name Display to false
        cy.findByTestId('TeamSettings.TeammateNameDisplaydropdown').select('nickname_full_name');
        cy.findByTestId('TeamSettings.LockTeammateNameDisplayfalse').click();

        // * Assert that there exists a description underneath the Teammate Name Display lock setting with the following text
        cy.findByTestId('TeamSettings.LockTeammateNameDisplayhelp-text').contains('When true, disables users\' ability to change settings under Settings > Display > Teammate Name Display.').should('be.visible');

        // # Click save button
        cy.get('#saveSetting').click();

        // # Go to main page
        cy.visit(townSquareUrl);

        // # Go to Settings > Display
        cy.uiOpenSettingsModal('Display');

        // # Click Edit button beside Teammate Name Display
        cy.get('#name_formatEdit').click();

        // # Choose Show first and last name
        cy.get('#name_formatFormatC').check();

        // # Click Save button to save the settings
        cy.uiSave();

        // * Assert the description under the Teammate Name Display title has changed to Show first and last name
        cy.get('#name_formatDesc').contains('Show first and last name').should('be.visible');

        // # Go back to System Admin console page
        cy.visit('/admin_console/site_config/users_and_teams');

        // # Set Teammate Name Display dropdown to 'Show by username' and set Lock Teammate Name Display to true
        cy.findByTestId('TeamSettings.TeammateNameDisplaydropdown').select('username');
        cy.findByTestId('TeamSettings.LockTeammateNameDisplaytrue').click();

        // # Click save button
        cy.uiSave();

        // # Go to main page
        cy.visit(townSquareUrl);

        // # Go to Settings > Display
        cy.uiOpenSettingsModal('Display');

        // * Assert the description under the Teammate Name Display title has changed to Show username
        cy.get('#name_formatDesc').contains('Show username').should('be.visible');

        // # Click edit button for Teammate Name Display
        cy.get('#name_formatEdit').click();

        // * Assert that there exists a description noting that this feature has been locked and can only be changed by system admin
        cy.get('#extraInfo').contains('This field is handled through your System Administrator. If you want to change it, you need to do so through your System Administrator.').should('be.visible');
    });
});

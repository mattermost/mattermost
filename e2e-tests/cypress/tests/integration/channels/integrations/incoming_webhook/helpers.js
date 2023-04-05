// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

export function enableUsernameAndIconOverride(enable) {
    enableUsernameAndIconOverrideInt(enable, enable);
}

export function enableUsernameAndIconOverrideInt(enableUsername, enableIcon) {
    // # Visit integration management at system console and change override values
    cy.visit('/admin_console/integrations/integration_management');
    cy.findByTestId('ServiceSettings.EnablePostUsernameOverride' + enableUsername).check({force: true});
    cy.findByTestId('ServiceSettings.EnablePostIconOverride' + enableIcon).check({force: true});

    // # Save the settings
    cy.get('#saveSetting').should('be.enabled').click({force: true});
    cy.get('#saveSetting').should('be.disabled');
}

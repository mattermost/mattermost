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
    cy.get('#saveSetting').should('be.visible').and('be.disabled');

    const usernameTestId = 'ServiceSettings.EnablePostUsernameOverride' + enableUsername;
    const iconTestId = 'ServiceSettings.EnablePostIconOverride' + enableIcon;

    cy.findByTestId(usernameTestId).then(($username) => {
        cy.findByTestId(iconTestId).then(($icon) => {
            // Skip Save when both flags are already in the requested state.
            // Checking an already-selected control leaves Save disabled and flakes MM-T622.
            if ($username.is(':checked') && $icon.is(':checked')) {
                return;
            }

            cy.findByTestId(usernameTestId).check({force: true});
            cy.findByTestId(iconTestId).check({force: true});
            cy.get('#saveSetting').should('be.enabled').click({force: true});
            cy.get('#saveSetting').should('be.disabled');
        });
    });
}

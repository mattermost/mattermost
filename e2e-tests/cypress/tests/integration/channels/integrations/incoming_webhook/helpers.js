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
    // Keep the admin-console Save path so unrelated settings are not reset.
    // If the radios are already in the desired state, Save stays disabled —
    // skip instead of waiting for it to enable (MM-T622 flake).
    cy.visit('/admin_console/integrations/integration_management');

    const usernameTestId = 'ServiceSettings.EnablePostUsernameOverride' + enableUsername;
    const iconTestId = 'ServiceSettings.EnablePostIconOverride' + enableIcon;

    cy.findByTestId(usernameTestId).should('exist');
    cy.findByTestId(iconTestId).should('exist');

    cy.findByTestId(usernameTestId).then(($username) => {
        cy.findByTestId(iconTestId).then(($icon) => {
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

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

    // Each option is a radio pair (testid suffixed 'true'/'false'). Only click the ones not
    // already in the desired state: a sibling spec can leave this setting already matching,
    // and clicking an already-checked radio doesn't mark the form dirty, so unconditionally
    // waiting for Save to become enabled would time out.
    checkIfNotAlreadyChecked('[data-testid="admin.setting:ServiceSettings.EnablePostUsernameOverride--group"] [data-testid="admin.setting.' + enableUsername + '--radio"]');
    checkIfNotAlreadyChecked('[data-testid="admin.setting:ServiceSettings.EnablePostIconOverride--group"] [data-testid="admin.setting.' + enableIcon + '--radio"]');

    // # Save the settings only if something actually changed
    cy.get('body').then(($body) => {
        if ($body.find('#saveSetting:not(:disabled)').length > 0) {
            cy.get('#saveSetting').click({force: true});
            cy.get('#saveSetting').should('be.disabled');
        }
    });
}

function checkIfNotAlreadyChecked(testId) {
    cy.get(testId).then(($el) => {
        if (!$el.prop('checked')) {
            cy.wrap($el).check({force: true});
        }
    });
}

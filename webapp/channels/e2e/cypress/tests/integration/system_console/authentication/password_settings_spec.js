// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @not_cloud @system_console @restrict_system_admin

describe('Password settings', () => {
    it('MM-T4679 - Should NOT show MaximumLoginAttempts when ExperimentalSettings.RestrictSystemAdmin is true', () => {
        cy.apiUpdateConfig({
            ExperimentalSettings: {
                RestrictSystemAdmin: true,
            },
        }).then(() => {
            cy.visit('/admin_console/authentication/password');
            cy.get('#maximumLoginAttempts').should('not.exist');
        });
    });
});

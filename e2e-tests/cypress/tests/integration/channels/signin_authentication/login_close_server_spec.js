// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @signin_authentication

describe('Login page with close server', () => {
    const oldSettings = {};
    before(() => {
        // Back up config, and disable other auth options
        const newSettings = {
            Office365Settings: {Enable: false},
            LdapSettings: {Enable: false},
            TeamSettings: {EnableOpenServer: false},
        };
        cy.apiGetConfig((config) => {
            Object.entries(newSettings).forEach(([key]) => {
                oldSettings[key] = config[key];
            });
        });
        cy.apiUpdateConfig(newSettings);

        // # Create new team and users
        cy.apiInitSetup().then(() => {
            cy.apiLogout();
            cy.visit('/login');
        });
    });
    after(() => {
        // Restore backed up settings
        cy.apiAdminLogin().apiUpdateConfig(oldSettings);
    });
    it('MM-47222 Should verify access problem page can be reached', () => {
        cy.findByText('Don\'t have an account?').should('be.visible').click();
        cy.findByText('Contact your workspace admin').should('be.visible');
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @system_console

import {forEachConsoleSection, makeUserASystemRole} from './helpers';

describe('Limited console access', () => {
    const roleNames = ['system_manager', 'system_user_manager', 'system_read_only_admin'];
    const testUsers = {};

    before(() => {
        cy.apiRequireLicense();

        Cypress._.forEach(roleNames, (roleName) => {
            cy.apiCreateUser().then(({user}) => {
                testUsers[roleName] = user;
            });
        });
    });

    it('MM-T3387 - Verify the Admin Role - System User Manager', () => {
        const role = 'system_user_manager';

        // # Make the user a System User Manager
        makeUserASystemRole(testUsers, role);

        // * Login as the new user and verify the role permissions (ensure they really are a system user manager)
        forEachConsoleSection(testUsers, role);
    });
});

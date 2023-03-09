// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Group: @enterprise @system_console @not_cloud

import {forEachConsoleSection, makeUserASystemRole} from './helpers';

describe('Limited console access', () => {
    const roleNames = ['system_manager', 'system_user_manager', 'system_read_only_admin'];
    const testUsers = {};

    before(() => {
        cy.shouldNotRunOnCloudEdition();
        cy.apiRequireLicense();

        Cypress._.forEach(roleNames, (roleName) => {
            cy.apiCreateUser().then(({user}) => {
                testUsers[roleName] = user;
            });
        });
    });

    it('MM-T3386 - Verify the Admin Role - System Manager -- KNOWN ISSUE: MM-42573', () => {
        const role = 'system_manager';

        // # Make the user a System  Manager
        makeUserASystemRole(testUsers, role);

        // * Login as the new user and verify the role permissions (ensure they really are a system manager)
        forEachConsoleSection(testUsers, role);
    });

    it('MM-T3388 - Verify the Admin Role - System Read Only Admin -- KNOWN ISSUE: MM-42573', () => {
        const role = 'system_read_only_admin';

        // # Make the user a System Ready Only Manager
        makeUserASystemRole(testUsers, role);

        // * Login as the new user and verify the role permissions (ensure they really are a system read only manager)
        forEachConsoleSection(testUsers, role);
    });
});

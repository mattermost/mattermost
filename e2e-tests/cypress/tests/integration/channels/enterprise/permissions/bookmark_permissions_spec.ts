// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// ***************************************************************
// - [#] indicates a test step (e.g. # Go to a page)
// - [*] indicates an assertion (e.g. * Check the title)
// - Use element ID when selecting an element. Create one if none.
// ***************************************************************

// Stage: @prod
// Group: @channels @enterprise @permissions

import * as TIMEOUTS from '@/fixtures/timeouts';

const deleteExistingTeamOverrideSchemes = () => {
    cy.apiGetSchemes('team').then(({schemes}) => {
        schemes.forEach((scheme) => {
            cy.apiDeleteScheme(scheme.id);
        });
    });
};

const checkChannelBookmarksPermissionsAreVisibleAndSet = () => {
    const permissionRowIds = ['[data-testid="admin.permissions.role:all_users--group"] [data-testid="admin.permissions.group:manage_public_channel_bookmarks--checkbox"] [data-testid="admin.permissions.group.checkbox"]',
        '[data-testid="admin.permissions.role:all_users--group"] [data-testid="admin.permissions.group:manage_private_channel_bookmarks--checkbox"] [data-testid="admin.permissions.group.checkbox"]'];

    permissionRowIds.forEach((id) => {
        cy.get(id).then((el) => {
            expect(el.hasClass('checked')).to.be.true;
        });
    });
};

describe('Revoke Bookmarks Permissions', () => {
    before(() => {
        cy.apiRequireLicense();
        cy.apiInitSetup();
        deleteExistingTeamOverrideSchemes();
    });

    beforeEach(() => {
        cy.apiLogout();
        cy.apiAdminLogin();
        cy.apiResetRoles();
    });

    it('Channel Bookmarks permissions should be visible and set in the system scheme', () => {
        cy.apiAdminLogin();

        // # Go to `User Management / Permissions` section
        cy.visit('/admin_console/user_management/permissions');

        // # Click `Edit Scheme` on System Scheme
        cy.findByTestId('admin.permission_schemes.system_scheme.action--link').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Find and ensure that manage bookmarks permissions are visible and set
        checkChannelBookmarksPermissionsAreVisibleAndSet();
    });

    it('Channel Bookmarks permissions should be visible and set in a custom scheme', () => {
        cy.apiAdminLogin();

        // # Go to `User Management / Permissions` section
        cy.visit('/admin_console/user_management/permissions');

        // # Click `New Team Override Scheme`
        cy.findByTestId('admin.permission_schemes.team_overrides.action--link').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Type Name and Description
        cy.get('#scheme-name').should('be.visible').type('custom test schema');
        cy.get('#scheme-description').type('description');

        // # Save scheme
        cy.get('#saveSetting').click().wait(TIMEOUTS.TWO_SEC);

        // # Edit the schema
        cy.contains('[data-testid^="admin.permission_schemes.scheme:"]', 'custom test schema').find('[data-testid="admin.permission_schemes.scheme.edit--link"]').should('be.visible').click().wait(TIMEOUTS.HALF_SEC);

        // # Find and ensure that manage bookmarks permissions are visible and set
        checkChannelBookmarksPermissionsAreVisibleAndSet();
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {
    ensureUserAttributes,
    createPermissionPolicy,
    deletePermissionPolicyByName,
    navigateToPermissionPoliciesPage,
} from '../support';

/**
 * Permission Policies - System Console (MM-64508)
 *
 * Tests the Permission Policies page under System Attributes > Permission Policies.
 * Requires Enterprise Advanced license and ABAC enabled.
 *
 * Sidebar items (Membership Policies, Permission Policies) are only rendered when
 * ABAC is enabled — all tests call enableABAC() first.
 *
 * This file covers list-page UI and management (delete / search) of existing policies.
 */

test.describe('Permission Policies - List Page', () => {
    test('MM-T5801 admin can navigate to Permission Policies page via sidebar', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        // # Enable ABAC — sidebar items only appear when ABAC is on.
        // enableABAC lands on /membership_policies so the sidebar is already expanded.
        await enableABAC(systemConsolePage.page);

        // # Click Permission Policies in the sidebar
        await systemConsolePage.sidebar.systemAttributes.permissionPolicies.click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Correct URL and heading
        await expect(systemConsolePage.page).toHaveURL(/permission_policies/);
        await expect(systemConsolePage.page.getByRole('heading', {name: 'Permission Policies'})).toBeVisible();

        // * List columns are present
        const section = systemConsolePage.page.getByTestId('sysconsole_section_PermissionPolicies');
        await expect(section.getByText('Name')).toBeVisible();
        await expect(section.getByText('Role')).toBeVisible();
        await expect(section.getByText('Permissions', {exact: true})).toBeVisible();
    });

    test('MM-T5802 Permission Policies list page has Add policy button and search input', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        await expect(systemConsolePage.page.getByRole('button', {name: 'Add policy'})).toBeVisible();
        await expect(systemConsolePage.page.getByPlaceholder('Search')).toBeVisible();
    });

    test('MM-T5803 Permission Policies list page subtitle describes file permission scope', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        await expect(
            systemConsolePage.page.getByText(
                'Create policies to control file upload and download permissions based on user attributes',
                {exact: false},
            ),
        ).toBeVisible();
    });
});

test.describe('Permission Policies - Manage Existing Policies', () => {
    test('MM-T5816 admin can delete a permission policy', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);

        const policyName = `PP Delete ${pw.random.id()}`;
        await createPermissionPolicy(systemConsolePage.page, {
            name: policyName,
            celExpression: 'user.attributes.Department == "Delete"',
            permissions: ['Download Files'],
        });

        await expect(systemConsolePage.page.getByText(policyName)).toBeVisible();

        // # Open the row's action menu and delete
        const policyRow = systemConsolePage.page.locator('.DataGrid_row').filter({hasText: policyName});
        await policyRow.locator('button[id*="policy-menu"], button[aria-label*="menu" i], button').last().click();

        const deleteOption = systemConsolePage.page.getByRole('menuitem', {name: /delete/i});
        await deleteOption.click();

        // # Deletion from the list fires immediately — no confirmation modal
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Policy no longer in list
        await expect(systemConsolePage.page.getByText(policyName)).not.toBeVisible();

        // # Safety net: API cleanup in case UI deletion failed
        await deletePermissionPolicyByName(adminClient, policyName);
    });

    test('MM-T5817 admin can search for a permission policy by name', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);

        const policyName = `PP Search ${pw.random.id()}`;
        try {
            await createPermissionPolicy(systemConsolePage.page, {
                name: policyName,
                celExpression: 'user.attributes.Department == "Search"',
                permissions: ['Download Files'],
            });

            // # Search by the exact name
            await systemConsolePage.page.getByPlaceholder('Search').fill(policyName);
            await systemConsolePage.page.waitForLoadState('networkidle');

            // * Only the matching policy is visible
            await expect(systemConsolePage.page.getByText(policyName)).toBeVisible();
        } finally {
            await deletePermissionPolicyByName(adminClient, policyName);
        }
    });
});

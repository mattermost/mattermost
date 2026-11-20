// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, waitForApi, expect, test, enableABAC, duration, type App} from '@mattermost/playwright-lib';

import {
    ensureUserAttributes,
    createPermissionPolicy,
    deletePermissionPolicyByName,
    navigateToPermissionPoliciesPage,
} from '../support';

/** The policy panel bounds controls that have no generated parts. */
function policyList(app: App) {
    // Policy controls have no generated parts; the declared Permission Policies screen bounds them.
    return app.admin.screen('PermissionPolicies').locator;
}

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
        const {app} = await pw.testBrowser.login(adminUser);

        // # Enable ABAC — sidebar items only appear when ABAC is on.
        // enableABAC lands on /membership_policies so the sidebar is already expanded.
        await enableABAC(app.page);

        // # Click Permission Policies in the sidebar
        await app.admin.sidebar.category('system_attributes').section('permission_policies').titleLink.click();
        await expect(app.page).toHaveURL(/permission_policies/);
        await app.page.waitForLoadState('networkidle');

        // * Correct URL and heading
        await expect(app.page).toHaveURL(/permission_policies/);
        // The list controls have no generated parts; query their accessible names and native grid inside the declared screen.
        await expect(policyList(app).getByRole('heading', {name: 'Permission Policies'})).toBeVisible();

        // * List columns are present
        const section = policyList(app);
        await expect(section.getByText('Name')).toBeVisible();
        await expect(section.getByText('Role')).toBeVisible();
        await expect(section.getByText('Permissions', {exact: true})).toBeVisible();
    });

    test('MM-T5802 Permission Policies list page has Add policy button and search input', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        await enableABAC(app.page);
        await navigateToPermissionPoliciesPage(app.page);

        // The list controls have no generated parts; query their accessible names and native grid inside the declared screen.
        await expect(policyList(app).getByRole('button', {name: 'Add policy'})).toBeVisible();
        await expect(policyList(app).getByPlaceholder('Search')).toBeVisible();
    });

    test('MM-T5803 Permission Policies list page subtitle describes the attribute-based scope', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        await enableABAC(app.page);
        await navigateToPermissionPoliciesPage(app.page);

        // The list controls have no generated parts; query their accessible names and native grid inside the declared screen.
        await expect(
            policyList(app).getByText('Create policies to control what users can do, based on their attributes', {
                exact: false,
            }),
        ).toBeVisible();
    });
});

test.describe('Permission Policies - Manage Existing Policies', () => {
    test('MM-T5816 admin can delete a permission policy', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        await enableABAC(app.page);

        const policyName = `PP Delete ${pw.random.id()}`;
        await createPermissionPolicy(app.page, {
            name: policyName,
            celExpression: 'user.attributes.Department == "Delete"',
            permissions: ['Download Files'],
        });

        // The list controls have no generated parts; query their accessible names and native grid inside the declared screen.
        await expect(policyList(app).getByText(policyName)).toBeVisible();

        // # Open the row's action menu and delete
        // The list has no generated row parts; match the native grid row within the declared policy screen.
        const policyRow = policyList(app).locator('.DataGrid_row').filter({hasText: policyName});
        await policyRow.locator('button[id*="policy-menu"], button[aria-label*="menu" i], button').last().click();

        // The row-action menu is portalled outside the undeclared policy panel and has no generated menu scope.
        const deleteOption = app.page.getByRole('menuitem', {name: /delete/i});
        await expect(deleteOption).toBeVisible();
        await Promise.all([waitForApi(app.page, Api.DeleteAccessControlPolicy), deleteOption.click()]);

        // # Deletion from the list fires immediately — no confirmation modal
        await app.page.waitForLoadState('networkidle');

        // * Policy no longer in list
        await expect(policyList(app).getByText(policyName)).not.toBeVisible();

        // # Safety net: API cleanup in case UI deletion failed
        await deletePermissionPolicyByName(adminClient, policyName);
    });

    test('MM-T5817 admin can search for a permission policy by name', async ({pw}) => {
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        await enableABAC(app.page);

        const policyName = `PP Search ${pw.random.id()}`;
        try {
            await createPermissionPolicy(app.page, {
                name: policyName,
                celExpression: 'user.attributes.Department == "Search"',
                permissions: ['Download Files'],
            });

            // # Search by the exact name
            // The list controls have no generated parts; query their accessible names and native grid inside the declared screen.
            await policyList(app).getByPlaceholder('Search').fill(policyName);
            await expect(policyList(app).getByPlaceholder('Search')).toHaveValue(policyName);
            await app.page.waitForLoadState('networkidle');

            // * Only the matching policy is visible
            await expect(policyList(app).getByText(policyName)).toBeVisible();
        } finally {
            await deletePermissionPolicyByName(adminClient, policyName);
        }
    });
});

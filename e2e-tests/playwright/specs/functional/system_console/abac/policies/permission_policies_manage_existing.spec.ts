// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {ensureUserAttributes, createPermissionPolicy, deletePermissionPolicyByName} from '../support';

/**
 * Permission Policies - System Console (MM-64508)
 *
 * Tests the Permission Policies page under System Attributes > Permission Policies.
 * Requires Enterprise Advanced license and ABAC enabled.
 *
 * Sidebar items (Membership Policies, Permission Policies) are only rendered when
 * ABAC is enabled — all tests call enableABAC() first.
 *
 * UI:
 *   List page  — Name | Role | Permissions columns, "+ Add policy", Search
 *   Detail page — name input, role dropdown (Guest users / Members and system administrators / System administrators), CEL editor,
 *                 permissions menu (Download Files / Upload Files), Save / Cancel
 */

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

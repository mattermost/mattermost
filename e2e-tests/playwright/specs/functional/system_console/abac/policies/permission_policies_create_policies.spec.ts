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

test.describe('Permission Policies - Create Policy', () => {
    test('MM-T5812 admin can create a permission policy restricting file downloads', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);

        const policyName = `PP Download ${pw.random.id()}`;
        try {
            await createPermissionPolicy(systemConsolePage.page, {
                name: policyName,
                celExpression: 'user.attributes.Department == "Engineering"',
                permissions: ['Download Files'],
            });

            // * List page shows the new policy with correct role and permissions
            await expect(systemConsolePage.page.getByRole('heading', {name: 'Permission Policies'})).toBeVisible();
            const policyRow = systemConsolePage.page.locator('.DataGrid_row').filter({hasText: policyName});
            await expect(policyRow).toBeVisible();
            await expect(policyRow.getByText('Members and system administrators')).toBeVisible();
            await expect(policyRow.getByText('Download Files')).toBeVisible();
        } finally {
            await deletePermissionPolicyByName(adminClient, policyName);
        }
    });

    test('MM-T5813 admin can create a permission policy with both Download and Upload permissions', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);

        const policyName = `PP Both Perms ${pw.random.id()}`;
        try {
            await createPermissionPolicy(systemConsolePage.page, {
                name: policyName,
                celExpression: 'user.attributes.Department == "Legal"',
                permissions: ['Download Files', 'Upload Files'],
            });

            const policyRow = systemConsolePage.page.locator('.DataGrid_row').filter({hasText: policyName});
            await expect(policyRow.getByText(/Download Files/)).toBeVisible();
            await expect(policyRow.getByText(/Upload Files/)).toBeVisible();
        } finally {
            await deletePermissionPolicyByName(adminClient, policyName);
        }
    });

    test('MM-T5814 created policy appears in list with correct name, role, and permissions', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);

        const policyName = `PP List Check ${pw.random.id()}`;
        try {
            await createPermissionPolicy(systemConsolePage.page, {
                name: policyName,
                celExpression: 'user.attributes.Department == "Legal"',
                permissions: ['Download Files'],
                role: 'system_guest',
            });

            // * Row shows name, Guest role, and Download Files permission
            const policyRow = systemConsolePage.page.locator('.DataGrid_row').filter({hasText: policyName});
            await expect(policyRow).toBeVisible();
            await expect(policyRow.getByText('Guest users')).toBeVisible();
            await expect(policyRow.getByText('Download Files')).toBeVisible();
        } finally {
            await deletePermissionPolicyByName(adminClient, policyName);
        }
    });
});

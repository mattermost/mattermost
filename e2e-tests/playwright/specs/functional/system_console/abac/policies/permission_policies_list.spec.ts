// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, test, enableABAC, duration, settle, Msg} from '@mattermost/playwright-lib';

import {ensureUserAttributes, deletePermissionPolicyByName} from '../support';
import {
    PERMISSION_POLICIES_PATH,
    createPermissionPolicy,
    openPermissionPolicies,
    permissionPolicyIdByName,
} from '../surface';

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

        // * Correct URL and heading
        await expect(app.page).toHavePath(PERMISSION_POLICIES_PATH);
        const list = app.admin.permissionPolicies;
        await expect(list.titleText).toHaveMessage(Msg.admin.permission_policies.title);

        // * List columns are present
        await expect(list.header).toContainMessage(Msg.admin.permission_policies.name);
        await expect(list.header).toContainMessage(Msg.admin.permission_policies.role._);
        await expect(list.header).toContainMessage(Msg.admin.permission_policies.policy_actions);
    });

    test('MM-T5802 Permission Policies list page has Add policy button and search input', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        await enableABAC(app.page);
        const list = await openPermissionPolicies(app);

        await expect(list.addButton).toHaveMessage(Msg.admin.permission_policies.add_policy);
        await expect(list.searchTextbox).toBeVisible();
    });

    test('MM-T5803 Permission Policies list page subtitle describes the attribute-based scope', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {app} = await pw.testBrowser.login(adminUser);

        await enableABAC(app.page);
        const list = await openPermissionPolicies(app);

        await expect(list.subtitleText).toHaveMessage(Msg.admin.permission_policies.description);
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
        const list = await createPermissionPolicy(app, {
            name: policyName,
            cel: 'user.attributes.Department == "Delete"',
            permissions: ['download_file_attachment'],
        });
        const policyId = await permissionPolicyIdByName(adminClient, policyName);
        const row = list.row(policyId);
        await expect(row.cell('name')).toHaveText(policyName);

        // # Open the row's action menu and delete: deletion from the list fires immediately, with no confirmation modal
        await row.openMenuButton.click();
        const rowMenu = app.permissionPolicyRowMenu;
        await expect(rowMenu.deleteMenuItem).toBeVisible();
        await settle(rowMenu.deleteMenuItem, {
            wait: Api.DeleteAccessControlPolicy,
            params: {policy_id: policyId},
        }).click();

        // * Policy no longer in list
        await expect(row.container).toHaveCount(0);

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
            const list = await createPermissionPolicy(app, {
                name: policyName,
                cel: 'user.attributes.Department == "Search"',
                permissions: ['download_file_attachment'],
            });
            const policyId = await permissionPolicyIdByName(adminClient, policyName);

            // # Search by the exact name
            await list.searchTextbox.fill(policyName);
            await expect(list.searchTextbox).toHaveValue(policyName);

            // * Only the matching policy is visible
            await expect(list.rowList).toHaveKeys([policyId]);
        } finally {
            await deletePermissionPolicyByName(adminClient, policyName);
        }
    });
});

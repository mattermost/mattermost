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
 * Permission Policies - Create Policy save/cancel flows (MM-64508)
 *
 * Covers end-to-end creation flows that persist a policy (download-only,
 * combined download+upload, guest role) plus the cancel path. Paired with
 * permission_policies_create_form.spec.ts which covers form UI + validation.
 */

test.describe('Permission Policies - Create Policy', () => {
    test('MM-T5812 admin can create a permission policy restricting file downloads', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        // Re-apply via API: a concurrent initSetup() on another shard may have
        // disabled ABAC between the enableABAC UI call and the navigation to
        // permission_policies, causing a redirect to the license page.
        await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});

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
            // Role label was shortened from "Members and system administrators"
            // to just "Members" in the UX pass; the "system admins fall back
            // when no admin-specific rule exists" semantics moved into the
            // role's description copy.
            await expect(policyRow.getByText('Members', {exact: true})).toBeVisible();
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
        await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});

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
        await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});

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

    test('MM-T5815 admin can cancel policy creation and return to list', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        await expect(
            systemConsolePage.page.getByText('Attribute Based Permission Policy', {exact: true}),
        ).toBeVisible();

        // # Cancel navigates back to list without saving
        await systemConsolePage.page.getByRole('link', {name: 'Cancel'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        await expect(systemConsolePage.page.getByRole('heading', {name: 'Permission Policies'})).toBeVisible();
    });
});

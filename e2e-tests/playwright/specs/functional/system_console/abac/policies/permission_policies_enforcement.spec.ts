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
 * UI:
 *   List page  — Name | Role | Permissions columns, "+ Add policy", Search
 *   Detail page — name input, role dropdown (Guest users / Members and system administrators / System administrators), CEL editor,
 *                 permissions menu (Download Files / Upload Files), Save / Cancel
 */

test.describe('Permission Policies - Create Policy (Enforcement)', () => {
    test('MM-T5810 Save is blocked when CEL expression is empty', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        await systemConsolePage.page
            .getByPlaceholder('Add a unique policy name')
            .fill(`PP Expr Validate ${pw.random.id()}`);
        await systemConsolePage.page.getByRole('button', {name: 'Save'}).last().click();

        await expect(systemConsolePage.page.getByText('Please add an expression to the policy')).toBeVisible();
    });

    test('MM-T5811 Save is blocked when no permission is selected', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        await systemConsolePage.page
            .getByPlaceholder('Add a unique policy name')
            .fill(`PP Perm Validate ${pw.random.id()}`);

        // # Enter a valid CEL expression but add no permissions
        await systemConsolePage.page.getByRole('button', {name: 'Switch to Advanced Mode'}).click();
        const monacoContainer = systemConsolePage.page.locator('.monaco-editor').first();
        await monacoContainer.waitFor({state: 'visible', timeout: 5000});
        const editorLines = systemConsolePage.page.locator('.monaco-editor .view-lines').first();
        await editorLines.click({force: true});
        await systemConsolePage.page.waitForTimeout(300);
        const isMac = process.platform === 'darwin';
        await systemConsolePage.page.keyboard.press(isMac ? 'Meta+a' : 'Control+a');
        await systemConsolePage.page.waitForTimeout(100);
        await systemConsolePage.page.keyboard.type('user.attributes.Department == "Engineering"', {delay: 10});

        await systemConsolePage.page.getByRole('button', {name: 'Save'}).last().click();

        await expect(systemConsolePage.page.getByText('Please select at least one permission')).toBeVisible();
    });

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

    test('MM-T5815 admin can cancel policy creation and return to list', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
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

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

test.describe('Permission Policies - Create Policy', () => {
    test('MM-T5804 admin can open the create permission policy form', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);

        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Detail page heading and name input visible
        await expect(
            systemConsolePage.page.getByText('Attribute Based Permission Policy', {exact: true}),
        ).toBeVisible();
        await expect(systemConsolePage.page.getByPlaceholder('Add a unique policy name')).toBeVisible();
    });

    test('MM-T5805 create policy form shows evaluation order info banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // * Banner explains that permission policies override system permission schemes
        await expect(
            systemConsolePage.page.getByText('The permissions defined in this policy override the', {exact: false}),
        ).toBeVisible();
        await expect(systemConsolePage.page.getByText('system permission schemes', {exact: false})).toBeVisible();
        await expect(systemConsolePage.page.getByText('Permissions evaluation order', {exact: false})).toBeVisible();
    });

    test('MM-T5806 create policy form shows role dropdown defaulting to Members and system administrators', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        await expect(systemConsolePage.page.getByText('Who this policy applies to')).toBeVisible();
        await expect(
            systemConsolePage.page.getByText('Select a role from the predefined list of system roles'),
        ).toBeVisible();

        // * The dropdown button is visible and shows the default role (system_user = "Members and system administrators")
        const roleButton = systemConsolePage.page.locator('#pp-role-selector-btn');
        await expect(roleButton).toBeVisible();
        await expect(roleButton).toContainText('Members and system administrators');
    });

    test('MM-T5807 admin can change role selection to System administrators via dropdown', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Open the role dropdown and select System administrators
        await systemConsolePage.page.locator('#pp-role-selector-btn').click();
        await systemConsolePage.page.locator('#pp-role-option-system_admin').click();

        // * Dropdown button now shows the selected role
        await expect(systemConsolePage.page.locator('#pp-role-selector-btn')).toContainText('System administrators');
    });

    test('MM-T5808 admin can toggle between Simple and Advanced CEL editor modes', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        const switchToAdvanced = systemConsolePage.page.getByRole('button', {name: 'Switch to Advanced Mode'});
        await expect(switchToAdvanced).toBeVisible();
        await switchToAdvanced.click();

        // * Button label flips to Simple Mode
        const switchToSimple = systemConsolePage.page.getByRole('button', {name: 'Switch to Simple Mode'});
        await expect(switchToSimple).toBeVisible();

        await switchToSimple.click();
        await expect(switchToAdvanced).toBeVisible();
    });

    test('MM-T5809 Save is blocked when policy name is empty', async ({pw}) => {
        await pw.skipIfNoLicense();
        const {adminUser, adminClient} = await pw.initSetup();
        await ensureUserAttributes(adminClient);
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);

        await enableABAC(systemConsolePage.page);
        await navigateToPermissionPoliciesPage(systemConsolePage.page);
        await systemConsolePage.page.getByRole('button', {name: 'Add policy'}).click();
        await systemConsolePage.page.waitForLoadState('networkidle');

        // # Type then clear the name to mark the form dirty, enabling the Save button
        const nameInput = systemConsolePage.page.getByPlaceholder('Add a unique policy name');
        await nameInput.fill('x');
        await nameInput.clear();

        await systemConsolePage.page.getByRole('button', {name: 'Save'}).last().click();

        await expect(systemConsolePage.page.getByText('Please add a name to the policy')).toBeVisible();
    });

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

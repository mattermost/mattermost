// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC} from '@mattermost/playwright-lib';

import {ensureUserAttributes, navigateToPermissionPoliciesPage} from '../support';

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
});

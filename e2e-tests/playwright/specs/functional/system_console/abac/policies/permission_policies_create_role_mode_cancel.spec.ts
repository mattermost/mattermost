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

test.describe('Permission Policies - Create Policy', () => {
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

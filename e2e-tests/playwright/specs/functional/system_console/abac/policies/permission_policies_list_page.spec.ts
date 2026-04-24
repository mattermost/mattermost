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

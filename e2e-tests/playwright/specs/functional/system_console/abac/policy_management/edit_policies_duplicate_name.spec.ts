// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {createPrivateChannelForABAC, createBasicPolicy, enableUserManagedAttributes} from '../support';

/**
 * ABAC Policy Management - Edit Policies
 * Tests for editing existing ABAC policies
 */
test.describe('ABAC Policy Management - Edit Policies', () => {
    /**
     * MM-63848: Renaming a policy to a name that already exists should show an error
     */
    test('MM-63848 Should show error when renaming policy to an existing name', async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();

        await enableUserManagedAttributes(adminClient);

        const departmentAttribute: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        await setupCustomProfileAttributeFields(adminClient, departmentAttribute);

        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;

        await navigateToABACPage(page);
        await enableABAC(page);

        // Create two policies with different names
        const policyName1 = `Edit Dup Test A ${pw.random.id()}`;
        await createBasicPolicy(page, {
            name: policyName1,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false,
            channels: [privateChannel.display_name],
        });

        await navigateToABACPage(page);

        const privateChannel2 = await createPrivateChannelForABAC(adminClient, team.id);
        const policyName2 = `Edit Dup Test B ${pw.random.id()}`;
        await createBasicPolicy(page, {
            name: policyName2,
            attribute: 'Department',
            operator: '==',
            value: 'Sales',
            autoSync: false,
            channels: [privateChannel2.display_name],
        });

        // Navigate back and edit policy2's name to match policy1
        await navigateToABACPage(page);
        await page.waitForTimeout(1000);

        // Search for the second policy
        const policySearchInput = page.locator('input[placeholder*="Search" i]').first();
        if (await policySearchInput.isVisible({timeout: 3000})) {
            await policySearchInput.fill(policyName2);
            await page.waitForTimeout(1000);
        }

        const policyRow = page.locator('tr.clickable, .DataGrid_row').filter({hasText: policyName2}).first();
        await policyRow.waitFor({state: 'visible', timeout: 10000});
        await policyRow.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Change the name to match the first policy
        const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
        await nameInput.waitFor({state: 'visible', timeout: 10000});
        await nameInput.fill('');
        await nameInput.fill(policyName1);

        // Save and expect failure
        const saveButton = page.getByRole('button', {name: 'Save'});
        await saveButton.click();
        await page.waitForTimeout(2000);

        // Handle confirmation modal if it appears
        const applyPolicyButton = page.getByRole('button', {name: /apply policy/i});
        if (await applyPolicyButton.isVisible({timeout: 3000}).catch(() => false)) {
            await applyPolicyButton.click();
            await page.waitForTimeout(2000);
        }

        // Verify error message is shown
        const errorMessage = page.locator('.EditPolicy__error');
        await expect(errorMessage).toBeVisible({timeout: 5000});

        const errorText = await errorMessage.textContent();
        expect(errorText).toContain('A policy with this name already exists');
    });
});

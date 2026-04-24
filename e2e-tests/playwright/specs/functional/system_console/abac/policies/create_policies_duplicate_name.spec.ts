// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {
    CustomProfileAttribute,
    setupCustomProfileAttributeFields,
} from '../../../channels/custom_profile_attributes/helpers';
import {createPrivateChannelForABAC, createBasicPolicy, enableUserManagedAttributes} from '../support';

/**
 * ABAC Policies - Create Policies
 * Tests for creating ABAC policies with different auto-add settings
 */
test.describe('ABAC Policies - Create Policies', () => {
    /**
     * MM-63848: Creating a policy with a name that already exists should show an error
     */
    test('MM-63848 Should show error when creating policy with duplicate name', async ({pw}) => {
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

        // Create the first policy
        const policyName = `Duplicate Test ${pw.random.id()}`;
        await createBasicPolicy(page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Engineering',
            autoSync: false,
            channels: [privateChannel.display_name],
        });

        // Navigate back and try to create another policy with the same name
        await navigateToABACPage(page);

        await createBasicPolicy(page, {
            name: policyName,
            attribute: 'Department',
            operator: '==',
            value: 'Sales',
            autoSync: false,
            channels: [],
        });

        // Verify error message is shown
        const errorMessage = page.locator('.EditPolicy__error');
        await expect(errorMessage).toBeVisible({timeout: 5000});

        const errorText = await errorMessage.textContent();
        expect(errorText).toContain('A policy with this name already exists');
    });
});

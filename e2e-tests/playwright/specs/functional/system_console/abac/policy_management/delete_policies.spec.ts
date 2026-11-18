// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, duration} from '@mattermost/playwright-lib';

import type {CustomProfileAttribute} from '../../../channels/custom_profile_attributes/helpers';
import {setupCustomProfileAttributeFields} from '../../../channels/custom_profile_attributes/helpers';
import {createPrivateChannelForABAC, enableUserManagedAttributes} from '../support';
import {createMembershipPolicy, fieldNamed, openMembershipPolicies, policyIdByName, setAbacEnabled} from '../surface';

/**
 * ABAC Policy Management - Delete Policies
 * Tests for deleting ABAC policies
 */
test.describe('ABAC Policy Management - Delete Policies', () => {
    /**
     * MM-T5793: Attribute-based access policy cannot be deleted if it is applied to any channels
     *
     * Step 1:
     * 1. As system admin, go to ABAC page and click three-dot menu on a policy APPLIED to a channel
     * 2. Observe Delete is DISABLED
     * 3. Click three-dot menu on a policy NOT applied to any channels
     * 4. Click Delete
     *
     * Expected:
     * - Policy applied to a channel CANNOT be deleted (Delete is disabled)
     * - Policy NOT applied to any channels CAN be deleted
     */
    test('MM-T5793 Policy with channels cannot be deleted, policy without channels can be deleted', async ({pw}) => {
        test.setTimeout(duration.two_min);

        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        await enableUserManagedAttributes(adminClient);
        const attributeFields: CustomProfileAttribute[] = [{name: 'Department', type: 'text', value: ''}];
        const department = fieldNamed(
            await setupCustomProfileAttributeFields(adminClient, attributeFields),
            'Department',
        );

        const {app} = await pw.testBrowser.login(adminUser);
        await setAbacEnabled(app, true);

        // # Create two policies: one with a channel assigned, one with none
        const uniqueId = pw.random.id();
        const policyWithChannelName = `ABAC-WithChannel-${uniqueId}`;
        const policyWithoutChannelName = `ABAC-NoChannel-${uniqueId}`;

        const team = (await adminClient.getMyTeams())[0];
        const privateChannel = await createPrivateChannelForABAC(adminClient, team.id);

        await createMembershipPolicy(app, {
            name: policyWithChannelName,
            rules: [{field: department, value: 'Engineering'}],
            channels: [privateChannel],
        });

        // Saved without channels, the editor goes straight back to the list (no apply dialog)
        await createMembershipPolicy(app, {
            name: policyWithoutChannelName,
            cel: 'user.attributes.Department == "Sales"',
        });

        const withChannelId = await policyIdByName(adminClient, policyWithChannelName);
        const withoutChannelId = await policyIdByName(adminClient, policyWithoutChannelName);

        // # Steps 1-2: open the menu of the policy with a channel
        const policies = await openMembershipPolicies(app);
        await policies.searchTextbox.fill(policyWithChannelName);
        const withChannel = policies.row(withChannelId);
        await withChannel.openMenuButton.click();
        const withChannelMenu = app.accessPolicyRowMenu;

        // * Delete is disabled
        await expect(withChannelMenu.deleteMenuItem).toHaveAttribute('aria-disabled', 'true');
        await app.page.keyboard.press('Escape');
        await expect(withChannelMenu.deleteMenuItem).not.toBeVisible();

        // # Steps 3-4: open the menu of the policy without channels
        await policies.searchTextbox.fill(policyWithoutChannelName);
        const withoutChannel = policies.row(withoutChannelId);
        await withoutChannel.openMenuButton.click();
        const withoutChannelMenu = app.accessPolicyRowMenu;

        // * Delete is enabled
        await expect(withoutChannelMenu.deleteMenuItem).not.toHaveAttribute('aria-disabled', 'true');

        // # Delete it and confirm
        await withoutChannelMenu.deleteMenuItem.click();
        await expect(policies.deleteModal).toBeVisible();
        await policies.deleteModal.confirmButton.click();

        // * The policy is gone
        await expect(withoutChannel).toHaveCount(0);
        await policies.searchTextbox.fill(policyWithChannelName);
        await expect(withChannel).toBeVisible();
    });
});

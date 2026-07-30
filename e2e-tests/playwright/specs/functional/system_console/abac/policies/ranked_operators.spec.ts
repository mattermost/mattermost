// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for ranked comparison operators in the Membership Policy editor.
 *
 * When the selected attribute is of type `rank`, the simple-mode operator
 * dropdown replaces the standard set with the ordinal comparison operators
 * (is exactly, is not, is at least, is greater than, is at most, is less than).
 */

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {duration, expect, getRandomId, test} from '@mattermost/playwright-lib';

import {deleteCustomProfileAttributes} from '../../../channels/custom_profile_attributes/helpers';

test.describe('System Console - Membership Policy ranked operators', () => {
    let adminClient: Client4;
    let adminUser: UserProfile;
    let field: UserPropertyField | undefined;

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const clientInfo = await pw.getAdminClient();
        adminClient = clientInfo.adminClient;
        adminUser = clientInfo.adminUser!;

        // # Create an admin-managed ranked attribute (admin-managed → usable in ABAC)
        field = await adminClient.createCustomProfileAttributeField({
            name: `clearance_${getRandomId()}`,
            type: 'rank',
            attrs: {
                sort_order: 0,
                managed: 'admin',
                options: [
                    {name: 'Unclassified', rank: 1},
                    {name: 'Secret', rank: 2},
                    {name: 'TopSecret', rank: 3},
                ],
            },
        } as any);

        // # Make sure ABAC stays enabled (a concurrent initSetup can reset config)
        await adminClient.patchConfig({
            AccessControlSettings: {EnableAttributeBasedAccessControl: true},
        } as any);
    });

    test.afterEach(async () => {
        if (field) {
            await deleteCustomProfileAttributes(adminClient, {
                [field.id]: field,
                __ownedIds: new Set([field.id]),
            } as any);
            field = undefined;
        }
    });

    /**
     * @objective Selecting a ranked attribute in the policy editor surfaces the
     * ordinal operators and removes the equality/string/list operators; the row
     * defaults to "is at least".
     *
     * @precondition
     * An admin-managed ranked attribute (Unclassified/Secret/TopSecret) exists.
     */
    test('shows ranked comparison operators for a ranked attribute', {tag: '@abac'}, async ({pw}) => {
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const policies = systemConsolePage.membershipPolicies;

        // # ABAC is already enabled (see beforeEach) — go straight to Membership Policies
        await policies.goto();

        // # Open the new-policy editor and name it
        const policyName = `Ranked Policy ${getRandomId()}`;
        await policies.openNewPolicy();
        await policies.policyNameInput.fill(policyName);

        // # Add an attribute row (reload once if attributes haven't loaded yet)
        await policies.ensureAddAttributeEnabled(policyName);
        await policies.addAttributeButton.click();

        // # Select the ranked attribute by name
        await policies.selectAttribute(field!.name);

        // * The row defaults to the canonical ranked operator, "is at least"
        // (waits for attribute type to propagate — without it the button can linger on "is")
        await expect(policies.operatorSelectorButton).toContainText('is at least');

        // # Open the operator dropdown
        await policies.operatorSelectorButton.click();

        // * All six ranked operators are offered (menu items auto-wait for the open menu)
        for (const label of ['is exactly', 'is not', 'is at least', 'is greater than', 'is at most', 'is less than']) {
            await expect(policies.menuItemRadio(label)).toBeVisible();
        }

        // * The standard (non-ranked) operators are not offered
        for (const label of ['is', 'in', 'has any of', 'has all of', 'starts with', 'ends with', 'contains']) {
            await expect(policies.menuItemRadio(label)).toHaveCount(0);
        }
    });

    /**
     * @objective An "is at least <option>" rule built in the editor survives a
     * save/reopen round-trip: the stored marker form rehydrates back to the
     * operator form and the table editor re-renders the same operator and value.
     *
     * @precondition
     * An admin-managed ranked attribute (Unclassified/Secret/TopSecret) exists.
     */
    test('round-trips an "is at least" ranked rule through save and reopen', {tag: '@abac'}, async ({pw}) => {
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const policies = systemConsolePage.membershipPolicies;
        const {page} = systemConsolePage;
        const policyName = `Ranked RT ${getRandomId()}`;
        let policyId: string | null = null;

        try {
            await policies.goto();

            // # Create a policy and add a ranked attribute row
            await policies.openNewPolicy();
            await policies.policyNameInput.fill(policyName);
            await policies.ensureAddAttributeEnabled(policyName);
            await policies.addAttributeButton.click();
            await policies.selectAttribute(field!.name);

            // * Defaults to "is at least"
            await expect(policies.operatorSelectorButton).toContainText('is at least');

            // # Pick the value "Secret"
            await policies.valueSelectorButton.click();
            await policies.menuItemRadio('Secret').click();
            await expect(policies.valueSelectorButton).toContainText('Secret');

            // # Save the policy
            await policies.saveButton.click();
            await page.waitForLoadState('networkidle');

            // # Reopen the policy from the list (search — list is paginated)
            await policies.goto();
            policyId = await policies.openPolicy(policyName);

            // Existing policies open in Advanced mode. The "Switch to Simple Mode"
            // toggle is enabled only when isSimpleExpression accepts the stored
            // expression — proving the marker form rehydrated to `>= "Secret"`
            // (a non-rehydrated `_rank_ge(...)` marker would disable the toggle).
            if (await policies.switchToSimpleModeButton.isVisible({timeout: duration.four_sec}).catch(() => false)) {
                await expect(policies.switchToSimpleModeButton).toBeEnabled();
                await policies.switchToSimpleModeButton.click();
            }

            // * The table editor re-parses the rehydrated rule to the same operator
            //   and value (no rank integer surfaced in the value chip)
            await expect(policies.operatorSelectorButton).toContainText('is at least');
            await expect(policies.valueSelectorButton).toContainText('Secret');
            await expect(policies.valueSelectorButton).not.toContainText('2');
        } finally {
            if (policyId) {
                await adminClient.deleteAccessControlPolicy(policyId).catch(() => {});
            }
        }
    });
});

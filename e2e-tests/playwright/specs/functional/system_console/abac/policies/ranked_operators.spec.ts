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
import type {UserPropertyField} from '@mattermost/types/properties';

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

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
        const {page} = systemConsolePage;

        // # ABAC is already enabled (see beforeEach) — go straight to Membership Policies
        await page.goto('/admin_console/system_attributes/membership_policies');
        await page.waitForLoadState('networkidle');

        // # Open the new-policy editor and name it
        await systemConsolePage.policyList.createPolicyButton.click();
        await page.waitForLoadState('networkidle');
        const nameInput = systemConsolePage.policyEditor.policyNameInput;
        await nameInput.waitFor({state: 'visible', timeout: 10000});
        await nameInput.fill(`Ranked Policy ${getRandomId()}`);

        // # Add an attribute row (reload once if attributes haven't loaded yet)
        const addAttributeButton = systemConsolePage.policyEditor.addAttributeButton;
        await addAttributeButton.waitFor({state: 'visible', timeout: 10000});
        if (await addAttributeButton.isDisabled()) {
            await page.reload();
            await page.waitForLoadState('networkidle');
            await nameInput.fill(`Ranked Policy ${getRandomId()}`);
            await expect(addAttributeButton).toBeEnabled({timeout: 15000});
        }
        await addAttributeButton.click();

        // # Select the ranked attribute by name
        const attributeButton = systemConsolePage.policyEditor.ruleBuilder.getAttributeSelectorButton(0);
        if (!(await systemConsolePage.policyEditor.ruleBuilder.attributeSelectorMenu.isVisible({timeout: 2000}))) {
            await attributeButton.click();
        }
        await systemConsolePage.policyEditor.ruleBuilder
            .getAttributeMenuItemByText(field!.name)
            .first()
            .click({force: true});

        // # Let the attribute menu and its backdrop fully close before opening the next menu
        await expect(systemConsolePage.policyEditor.ruleBuilder.attributeSelectorMenu).toBeHidden();

        // * The row defaults to the canonical ranked operator, "is at least"
        const operatorButton = systemConsolePage.policyEditor.ruleBuilder.getOperatorSelectorButton(0);
        await expect(operatorButton).toContainText('is at least');

        // # Open the operator dropdown
        await operatorButton.click();

        // * All six ranked operators are offered (menu items auto-wait for the open menu)
        for (const label of ['is exactly', 'is not', 'is at least', 'is greater than', 'is at most', 'is less than']) {
            await expect(page.getByRole('menuitemradio', {name: label, exact: true})).toBeVisible();
        }

        // * The standard (non-ranked) operators are not offered
        for (const label of ['is', 'in', 'has any of', 'has all of', 'starts with', 'ends with', 'contains']) {
            await expect(page.getByRole('menuitemradio', {name: label, exact: true})).toHaveCount(0);
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
        const {page} = systemConsolePage;
        const policyName = `Ranked RT ${getRandomId()}`;
        let policyId: string | null = null;

        try {
            await page.goto('/admin_console/system_attributes/membership_policies');
            await page.waitForLoadState('networkidle');

            // # Create a policy and add a ranked attribute row
            await systemConsolePage.policyList.createPolicyButton.click();
            await page.waitForLoadState('networkidle');
            const nameInput = systemConsolePage.policyEditor.policyNameInput;
            await nameInput.waitFor({state: 'visible', timeout: 10000});
            await nameInput.fill(policyName);

            const addAttributeButton = systemConsolePage.policyEditor.addAttributeButton;
            await addAttributeButton.waitFor({state: 'visible', timeout: 10000});
            if (await addAttributeButton.isDisabled()) {
                await page.reload();
                await page.waitForLoadState('networkidle');
                await nameInput.fill(policyName);
                await expect(addAttributeButton).toBeEnabled({timeout: 15000});
            }
            await addAttributeButton.click();

            if (!(await systemConsolePage.policyEditor.ruleBuilder.attributeSelectorMenu.isVisible({timeout: 2000}))) {
                await systemConsolePage.policyEditor.ruleBuilder.getAttributeSelectorButton(0).click();
            }
            await systemConsolePage.policyEditor.ruleBuilder
                .getAttributeMenuItemByText(field!.name)
                .first()
                .click({force: true});
            await expect(systemConsolePage.policyEditor.ruleBuilder.attributeSelectorMenu).toBeHidden();

            // * Defaults to "is at least"
            await expect(systemConsolePage.policyEditor.ruleBuilder.getOperatorSelectorButton(0)).toContainText(
                'is at least',
            );

            // # Pick the value "Secret"
            await systemConsolePage.policyEditor.ruleBuilder.getValueSelectorButton(0).click();
            await page.getByRole('menuitemradio', {name: 'Secret', exact: true}).click();
            await expect(systemConsolePage.policyEditor.ruleBuilder.getValueSelectorButton(0)).toContainText('Secret');

            // # Save the policy
            await systemConsolePage.policyEditor.saveButton.click();
            await page.waitForLoadState('networkidle');

            // # Reopen the policy from the list
            await page.goto('/admin_console/system_attributes/membership_policies');
            await page.waitForLoadState('networkidle');
            const policyRow = systemConsolePage.policyList.getPolicyRowByName(policyName);
            await expect(policyRow).toBeVisible({timeout: 10000});
            const rowId = await policyRow.getAttribute('id');
            policyId = rowId?.replace('customDescription-', '') ?? null;
            await policyRow.click();
            await page.waitForLoadState('networkidle');

            // Existing policies open in Advanced mode. The "Switch to Simple Mode"
            // toggle is enabled only when isSimpleExpression accepts the stored
            // expression — proving the marker form rehydrated to `>= "Secret"`
            // (a non-rehydrated `_rank_ge(...)` marker would disable the toggle).
            const toSimpleMode = page.getByRole('button', {name: 'Switch to Simple Mode'});
            if (await toSimpleMode.isVisible({timeout: 5000}).catch(() => false)) {
                await expect(toSimpleMode).toBeEnabled();
                await toSimpleMode.click();
            }

            // * The table editor re-parses the rehydrated rule to the same operator
            //   and value (no rank integer surfaced in the value chip)
            await expect(systemConsolePage.policyEditor.ruleBuilder.getOperatorSelectorButton(0)).toContainText(
                'is at least',
            );
            const valueButton = systemConsolePage.policyEditor.ruleBuilder.getValueSelectorButton(0);
            await expect(valueButton).toContainText('Secret');
            await expect(valueButton).not.toContainText('2');
        } finally {
            if (policyId) {
                await adminClient.deleteAccessControlPolicy(policyId).catch(() => {});
            }
        }
    });
});

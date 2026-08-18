// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * E2E tests for MM-64357 in the Membership Policy editor.
 *
 * A rule value containing a quote character (e.g. the apostrophe in
 * "Matt's Department") must still be recognized as a simple expression. Before
 * the fix the quoted-value matcher forbade any inner quote, so such a rule was
 * misclassified as complex: the "Switch to Simple Mode" toggle became disabled
 * and the admin was trapped in Advanced mode after a save/reopen.
 *
 * These specs drive the rendered UI (button enabled/disabled state and the
 * save -> reopen round-trip) rather than the helper functions directly, which
 * is the coverage gap flagged in review.
 */

import type {Client4} from '@mattermost/client';
import type {UserProfile} from '@mattermost/types/users';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {expect, getRandomId, test} from '@mattermost/playwright-lib';

import {deleteCustomProfileAttributes} from '../../../channels/custom_profile_attributes/helpers';

const APOSTROPHE_VALUE = "Matt's Department";

test.describe('System Console - Membership Policy apostrophe values (MM-64357)', () => {
    let adminClient: Client4;
    let adminUser: UserProfile;
    let field: UserPropertyField | undefined;

    test.beforeEach(async ({pw}) => {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();

        const clientInfo = await pw.getAdminClient();
        adminClient = clientInfo.adminClient;
        adminUser = clientInfo.adminUser!;

        // # Create an admin-managed text attribute (admin-managed → usable in ABAC)
        field = await adminClient.createCustomProfileAttributeField({
            name: `department_${getRandomId()}`,
            type: 'text',
            attrs: {
                sort_order: 0,
                managed: 'admin',
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
     * @objective A rule whose value contains an apostrophe survives a
     * save/reopen round-trip: the stored expression rehydrates as a simple
     * expression so the "Switch to Simple Mode" toggle stays enabled (the admin
     * is not trapped in Advanced mode) and the table editor re-renders the same
     * value.
     *
     * @precondition
     * An admin-managed text attribute exists.
     */
    test('round-trips an apostrophe "is" value and keeps the mode toggle switchable', {tag: '@abac'}, async ({pw}) => {
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const {page} = systemConsolePage;
        const policyName = `Apostrophe RT ${getRandomId()}`;
        let policyId: string | null = null;

        try {
            await page.goto('/admin_console/system_attributes/membership_policies');
            await page.waitForLoadState('networkidle');

            // # Create a policy and add a text attribute row
            await page.getByRole('button', {name: 'Add policy'}).click();
            await page.waitForLoadState('networkidle');
            const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await nameInput.waitFor({state: 'visible', timeout: 10000});
            await nameInput.fill(policyName);

            const addAttributeButton = page.getByRole('button', {name: /add attribute/i});
            await addAttributeButton.waitFor({state: 'visible', timeout: 10000});
            if (await addAttributeButton.isDisabled()) {
                await page.reload();
                await page.waitForLoadState('networkidle');
                await nameInput.fill(policyName);
                await expect(addAttributeButton).toBeEnabled({timeout: 15000});
            }
            await addAttributeButton.click();

            // # Select the text attribute by name
            if (!(await page.locator('[id^="attribute-selector-menu"]').isVisible({timeout: 2000}))) {
                await page.locator('[data-testid="attributeSelectorMenuButton"]').first().click();
            }
            await page
                .locator(`[id^="attribute-selector-menu"] li:has-text("${field!.name}")`)
                .first()
                .click({force: true});
            await expect(page.locator('[id^="attribute-selector-menu"]')).toBeHidden();

            // * A text attribute defaults to the "is" operator
            await expect(page.locator('[data-testid="operatorSelectorMenuButton"]').first()).toContainText('is');

            // # Type a value containing an apostrophe
            const valueInput = page.locator('.values-editor__simple-input, input[placeholder*="Add value" i]').first();
            await valueInput.waitFor({state: 'visible', timeout: 10000});
            await valueInput.fill(APOSTROPHE_VALUE);
            await expect(valueInput).toHaveValue(APOSTROPHE_VALUE);

            // # Save the policy
            await page.getByRole('button', {name: 'Save'}).last().click();
            await page.waitForLoadState('networkidle');

            // # Reopen the policy from the list
            await page.goto('/admin_console/system_attributes/membership_policies');
            await page.waitForLoadState('networkidle');
            const policyRow = page.locator('.policy-name').filter({hasText: policyName}).first();
            await expect(policyRow).toBeVisible({timeout: 10000});
            const rowId = await policyRow.getAttribute('id');
            policyId = rowId?.replace('customDescription-', '') ?? null;
            await policyRow.click();
            await page.waitForLoadState('networkidle');

            // # Switch to Advanced mode so the "Switch to Simple Mode" toggle is present.
            const toAdvanced = page.getByRole('button', {name: 'Switch to Advanced Mode'});
            if (await toAdvanced.isVisible({timeout: 5000}).catch(() => false)) {
                await expect(toAdvanced).toBeEnabled({timeout: 60_000});
                await toAdvanced.click();
            }

            // * The stored apostrophe expression classifies as simple, so the
            //   toggle back to Simple mode stays enabled (before the fix it was
            //   disabled, trapping the admin in Advanced mode).
            const toSimpleMode = page.getByRole('button', {name: 'Switch to Simple Mode'});
            await expect(toSimpleMode).toBeVisible({timeout: 10_000});
            await expect(toSimpleMode).toBeEnabled();

            // # Return to Simple mode and confirm the value round-tripped intact
            await toSimpleMode.click();
            const reopenedValue = page
                .locator('.values-editor__simple-input, input[placeholder*="Add value" i]')
                .first();
            await expect(reopenedValue).toHaveValue(APOSTROPHE_VALUE, {timeout: 10_000});
        } finally {
            // Clean up the policy. If we didn't capture the ID from the DOM (e.g. because
            // save succeeded but navigation/assertion failed), search for it by name.
            let idToDelete = policyId;
            if (!idToDelete) {
                try {
                    const searchResult = await adminClient.searchAccessControlPolicies(policyName, 'parent', '', 10);
                    const foundPolicy = searchResult.policies?.find((p) => p.name === policyName);
                    if (foundPolicy) {
                        idToDelete = foundPolicy.id;
                    }
                } catch {
                    // Search failed; skip cleanup
                }
            }
            if (idToDelete) {
                await adminClient.deleteAccessControlPolicy(idToDelete).catch(() => {});
            }
        }
    });
});

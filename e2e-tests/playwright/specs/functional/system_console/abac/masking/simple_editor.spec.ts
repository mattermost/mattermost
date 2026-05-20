// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';

import {getStoredPolicyRuleExpressions, purgeFieldsByPrefix, setFieldAsSharedOnly} from './masking_db_setup';
import {
    createMaskingTextField,
    createPolicyWithCEL,
    deleteCPAField,
    deletePolicy,
    disableMaskingFlag,
    enableMaskingFlag,
    getPolicyIdFromURL,
    openExistingPolicy,
    setUserAttribute,
} from './support';

/**
 * Attribute-Value Masking — Simple-editor masking display behaviors.
 *
 * Validates the masked-chip UI, dirty-form save (merge-on-save), and row-remove
 * lockdown for callers viewing a policy whose CPA field has been flipped to
 * shared_only. Self-inclusion and direct-API write-path validations live in
 * save_validation.spec.ts.
 */

// Purge any orphaned Masking* CPA fields left by previous failed runs so we
// don't hit the 200-field global limit mid-suite. Uses a direct DB delete
// so protected fields (set via setFieldAsSharedOnly/setFieldAsSourceOnly)
// are removed — the API rejects deletes for those with 403.
test.beforeAll(async () => {
    await purgeFieldsByPrefix('Masking');
});

test('MM-68508-1: Full masking round-trip in Simple editor', async ({pw}) => {
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const fieldIds: string[] = [];
    const policyIds: string[] = [];

    try {
        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `MaskingProgram_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);

        // adminUser holds "Alpha" — Bravo and Charlie will be masked for them
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;
        await navigateToABACPage(page);
        await enableABAC(page);

        const policyName = `MaskingPolicy ${pw.random.id()}`;
        const policyId = await createPolicyWithCEL(
            page,
            policyName,
            `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
        );
        policyIds.push(policyId);
        // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
        // otherwise reject values the caller does not hold. Flipping now means the policy
        // is created against a public field, then masking applies on the next load.
        await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

        // Navigate back to the policy editor — masking now applies on load
        await openExistingPolicy(page, policyName);

        // Alpha chip must be visible (caller holds it)
        await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();

        // Masked chip must be visible (Bravo + Charlie are hidden)
        await expect(page.locator('.select__multi-value--masked')).toBeVisible();

        // Bravo and Charlie chips must NOT appear in plain text
        await expect(page.locator('.select__multi-value').filter({hasText: 'Bravo'})).not.toBeVisible();
        await expect(page.locator('.select__multi-value').filter({hasText: 'Charlie'})).not.toBeVisible();

        // Warning banner must appear
        await expect(page.locator('text="This policy contains restricted values"')).toBeVisible();

        // Attribute selector on the row must be locked (has 'disabled' class)
        const attributeSelector = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
        await expect(attributeSelector).toHaveClass(/disabled/);

        // Test-access-rule button must be disabled when policy has masked values
        const testRulesBtn = page.locator('button').filter({hasText: 'Test access rule'});
        if (await testRulesBtn.isVisible()) {
            await expect(testRulesBtn).toBeDisabled();
        }
        // Save-button enabled state is covered functionally by E2E-2 (merge round-trip)
        // and E2E-10 (held-value addition) — both exercise an actual save and verify the
        // server preserved hidden values. A pristine "is the button disabled?" check
        // here would only catch the narrow regression of adding a masking-aware gate to
        // SaveButton.disabled, which the round-trip tests also cover.
    } finally {
        for (const id of policyIds) {
            try {
                await deletePolicy(adminClient, id);
            } catch {} // eslint-disable-line no-empty
        }
        for (const id of fieldIds) {
            try {
                await deleteCPAField(adminClient, id);
            } catch {} // eslint-disable-line no-empty
        }
        try {
            await disableMaskingFlag(adminClient);
        } catch {} // eslint-disable-line no-empty
    }
});

test('MM-68508-2: Caller with masked values can save; hidden values are preserved by merge', async ({pw}) => {
    // Validates that callers with masked values CAN save changes. Merge-on-save
    // re-injects hidden values so Bravo and Charlie survive even though the caller
    // only sees and submits Alpha. Save button is enabled (not gated on masked state).
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const fieldIds: string[] = [];
    const policyIds: string[] = [];

    try {
        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `MaskingProgram_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;
        await navigateToABACPage(page);
        await enableABAC(page);

        const policyName = `MaskingPolicy ${pw.random.id()}`;
        const policyId = await createPolicyWithCEL(
            page,
            policyName,
            `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
        );
        policyIds.push(policyId);
        // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
        // otherwise reject values the caller does not hold. Flipping now means the policy
        // is created against a public field, then masking applies on the next load.
        await setFieldAsSharedOnly(fieldId);

        await openExistingPolicy(page, policyName);
        const storedPolicyId = await getPolicyIdFromURL(page);

        // Alpha visible, Bravo+Charlie masked
        await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
        await expect(page.locator('.select__multi-value--masked')).toBeVisible();

        const saveBtn = page.getByRole('button', {name: 'Save'});

        // Dirty the form via the policy name field. The original test dirtied by removing /
        // re-adding the visible "Alpha" chip, but masked rows are now fully read-only —
        // value chips can't be removed and the value selector is disabled. The merge-on-save
        // invariant we're testing doesn't depend on how the form is dirtied; what matters is
        // that an actual PUT happens with the masked condition's reduced value set, and the
        // server re-injects Bravo + Charlie via mergeExpressionWithMaskedValues.
        const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
        await nameInput.fill(policyName + ' (edited)');
        await page.waitForTimeout(300);

        // Save — must succeed
        await saveBtn.click();
        await page.waitForLoadState('networkidle');

        // Verify via API (flag off): Bravo + Charlie preserved by merge-on-save
        const rawExpression = (await getStoredPolicyRuleExpressions(storedPolicyId))[0] ?? '';

        expect(rawExpression).toContain('Alpha');
        expect(rawExpression).toContain('Bravo');
        expect(rawExpression).toContain('Charlie');
    } finally {
        for (const id of policyIds) {
            try {
                await deletePolicy(adminClient, id);
            } catch {} // eslint-disable-line no-empty
        }
        for (const id of fieldIds) {
            try {
                await deleteCPAField(adminClient, id);
            } catch {} // eslint-disable-line no-empty
        }
        try {
            await disableMaskingFlag(adminClient);
        } catch {} // eslint-disable-line no-empty
    }
});

test('MM-68508-3: Row-remove button is disabled on masked rows', async ({pw}) => {
    // The trash/remove button on a masked row is disabled — a caller with
    // masked values cannot delete individual rows, matching the Save/Delete
    // buttons which are also disabled when masked values are present.
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const fieldIds: string[] = [];
    const policyIds: string[] = [];

    try {
        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `MaskingProgram_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;
        await navigateToABACPage(page);
        await enableABAC(page);

        const policyName = `MaskingPolicy ${pw.random.id()}`;
        const policyId = await createPolicyWithCEL(
            page,
            policyName,
            `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
        );
        policyIds.push(policyId);
        // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
        // otherwise reject values the caller does not hold. Flipping now means the policy
        // is created against a public field, then masking applies on the next load.
        await setFieldAsSharedOnly(fieldId);

        await openExistingPolicy(page, policyName);

        // Confirm masked state
        await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
        await expect(page.locator('.select__multi-value--masked')).toBeVisible();

        // Row-remove (trash) button must be disabled on the masked row
        const removeRowBtn = page.locator('button[aria-label="Remove row"], button.table-editor__row-remove').first();
        await removeRowBtn.waitFor({state: 'visible', timeout: 5000});
        await expect(removeRowBtn).toBeDisabled();
    } finally {
        for (const id of policyIds) {
            try {
                await deletePolicy(adminClient, id);
            } catch {} // eslint-disable-line no-empty
        }
        for (const id of fieldIds) {
            try {
                await deleteCPAField(adminClient, id);
            } catch {} // eslint-disable-line no-empty
        }
        try {
            await disableMaskingFlag(adminClient);
        } catch {} // eslint-disable-line no-empty
    }
});

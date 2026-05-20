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
 * Attribute-Value Masking — editor states.
 *
 * Covers callers with full visibility (no masked chip), new-policy creation
 * (no masking applied), the locked masked-row save round-trip, and Simple-editor
 * masking with the multi-value "in" operator.
 */

test.beforeAll(async () => {
    await purgeFieldsByPrefix('Masking');
});

test('MM-68508-7: Caller holding all policy values sees them all unmasked', async ({pw}) => {
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

        // adminUser holds "Alpha" and the policy contains ONLY "Alpha"
        // → caller holds ALL values in the condition → nothing is masked
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;
        await navigateToABACPage(page);
        await enableABAC(page);

        const policyName = `MaskingPolicy ${pw.random.id()}`;
        const policyId = await createPolicyWithCEL(page, policyName, `user.attributes.${fieldName} in ["Alpha"]`);
        policyIds.push(policyId);
        // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
        // otherwise reject values the caller does not hold. Flipping now means the policy
        // is created against a public field, then masking applies on the next load.
        await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

        await openExistingPolicy(page, policyName);

        // Alpha visible
        await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();

        // No masked chip — caller holds all values
        await expect(page.locator('.select__multi-value--masked')).not.toBeVisible();

        // No warning banner
        await expect(page.locator('text="This policy contains restricted values"')).not.toBeVisible();

        // Attribute selector is NOT locked
        const attributeSelector = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
        await expect(attributeSelector).not.toHaveClass(/disabled/);

        // Test access rule button should be enabled
        const testRulesBtn = page.locator('button').filter({hasText: 'Test access rule'});
        if (await testRulesBtn.isVisible()) {
            await expect(testRulesBtn).not.toBeDisabled();
        }

        // CEL mode is editable (no read-only)
        const advancedBtn = page.getByRole('button', {name: /advanced/i});
        if (await advancedBtn.isVisible()) {
            await advancedBtn.click();
            await page.waitForTimeout(1000);
            const monacoEditor = page.locator('.monaco-editor').first();
            if (await monacoEditor.isVisible()) {
                const ariaReadOnly = await monacoEditor.getAttribute('aria-readonly');
                expect(ariaReadOnly).not.toBe('true');
            }
        }
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

test('MM-68508-8: New policy creation has no masking', async ({pw}) => {
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const fieldIds: string[] = [];

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

        // Navigate to New Policy form
        await page.goto('/admin_console/system_attributes/membership_policies');
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', {name: 'Add policy'}).click();
        await page.waitForLoadState('networkidle');

        // A fresh editor must show no masked chip and no warning banner
        await expect(page.locator('.select__multi-value--masked')).not.toBeVisible();
        await expect(page.locator('text="This policy contains restricted values"')).not.toBeVisible();

        // Add a rule row
        const addAttributeBtn = page.getByRole('button', {name: /add attribute/i});
        if ((await addAttributeBtn.isVisible()) && !(await addAttributeBtn.isDisabled())) {
            await addAttributeBtn.click();
            await page.waitForTimeout(500);
        }

        // Still no masked chip after adding a blank row
        await expect(page.locator('.select__multi-value--masked')).not.toBeVisible();

        // Attribute selector is NOT locked on a new row
        const attributeSelector = page.locator('[data-testid="attributeSelectorMenuButton"]').first();
        await expect(attributeSelector).not.toHaveClass(/disabled/);
    } finally {
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

test('MM-68508-9: Masked row is fully read-only; merge-on-save preserves hidden values', async ({pw}) => {
    // The masked row's value selector is locked — callers cannot add or remove values
    // through it. This is intentional: any direct modification could silently drop
    // hidden values, and the merge logic gates write-path edits on shared_only fields
    // anyway. This test asserts the locked state, then dirties the form via an
    // unrelated field (policy name) and verifies the server-side merge still preserves
    // the hidden values across save — the same merge invariant E2E-2 covers, with the
    // extra assertion that the locked UI doesn't break round-trip correctness.
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

        // adminUser holds "Alpha"; policy has ["Bravo", "Charlie"] (admin holds none of these)
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;
        await navigateToABACPage(page);
        await enableABAC(page);

        const policyName = `MaskingPolicy ${pw.random.id()}`;
        const policyId = await createPolicyWithCEL(
            page,
            policyName,
            `user.attributes.${fieldName} in ["Bravo", "Charlie"]`,
        );
        policyIds.push(policyId);
        // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
        // otherwise reject values the caller does not hold. Flipping now means the policy
        // is created against a public field, then masking applies on the next load.
        await setFieldAsSharedOnly(fieldId);

        await openExistingPolicy(page, policyName);
        const storedPolicyId = await getPolicyIdFromURL(page);

        // No visible chips (admin holds none of the existing values); only masked chip
        await expect(page.locator('.select__multi-value').filter({hasText: 'Bravo'})).not.toBeVisible();
        await expect(page.locator('.select__multi-value').filter({hasText: 'Charlie'})).not.toBeVisible();
        await expect(page.locator('.select__multi-value--masked')).toBeVisible();

        const saveBtn = page.getByRole('button', {name: 'Save'});

        // Value selector on the masked row is locked. Both the menu button and the chip
        // remove icons sit inside the disabled selector; trying to edit through them
        // is a no-op for the caller.
        const valueSelector = page.locator('[data-testid="valueSelectorMenuButton"]').first();
        await expect(valueSelector).toHaveClass(/disabled/);

        // Dirty the form via an unrelated input so Save enables.
        const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
        await nameInput.fill(policyName + ' (edited)');
        await page.waitForTimeout(300);

        // Save — must succeed despite the masked row being read-only.
        await saveBtn.click();
        await page.waitForLoadState('networkidle');

        // Verify via API (flag off): Bravo + Charlie still in the stored policy.
        // Alpha is NOT expected — this test's policy never contained Alpha and the
        // caller had no way to add it through the locked selector.
        const rawExpression = (await getStoredPolicyRuleExpressions(storedPolicyId))[0] ?? '';

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

test('MM-68508-10: Text field masking with "in" operator', async ({pw}) => {
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

        // Policy uses a text-field "in" with multiple values
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

        await openExistingPolicy(page, policyName);

        // "Alpha" chip visible (held); "Bravo" and "Charlie" are masked
        await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
        await expect(page.locator('.select__multi-value').filter({hasText: 'Bravo'})).not.toBeVisible();
        await expect(page.locator('.select__multi-value').filter({hasText: 'Charlie'})).not.toBeVisible();
        await expect(page.locator('.select__multi-value--masked')).toBeVisible();

        // Attribute selector on the masked row is locked
        await expect(page.locator('[data-testid="attributeSelectorMenuButton"]').first()).toHaveClass(/disabled/);
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

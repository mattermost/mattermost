// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';

import {
    createMaskingMultiselectField,
    createMaskingTextField,
    createPolicyWithCEL,
    deleteCPAField,
    deletePolicy,
    disableMaskingFlag,
    enableMaskingFlag,
    openExistingPolicy,
    setUserAttribute,
} from './masking_helpers';
import {purgeFieldsByPrefix, setFieldAsSharedOnly} from './masking_db_setup';

const fieldPrefix = 'MaskingVT';

test.describe('Attribute-Value Masking - Visibility and Text Fields', {tag: ['@abac', '@abac_masking']}, () => {
    test.beforeAll(async () => {
        await purgeFieldsByPrefix(fieldPrefix);
    });

    test('MM-68508-7: Caller holding all policy values sees them all unmasked', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
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
            await setFieldAsSharedOnly(fieldId);

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
            await expect(testRulesBtn).toBeVisible();
            await expect(testRulesBtn).toBeEnabled();

            // CEL mode is editable (no read-only)
            const advancedBtn = page.getByRole('button', {name: /advanced/i});
            await expect(advancedBtn).toBeVisible();
            await advancedBtn.click();
            await page.waitForTimeout(1000);
            const monacoEditor = page.locator('.monaco-editor').first();
            await expect(monacoEditor).toBeVisible();
            const ariaReadOnly = await monacoEditor.getAttribute('aria-readonly');
            expect(ariaReadOnly).not.toBe('true');
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
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
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
            await expect(addAttributeBtn).toBeVisible();
            await expect(addAttributeBtn).toBeEnabled();
            await addAttributeBtn.click();
            await page.waitForTimeout(500);

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

    test('MM-68508-9: Masked row is fully read-only', async ({pw}) => {
        // The masked row's value selector is locked — callers cannot add or remove values
        // through it. This is intentional: any direct modification could silently drop
        // hidden values, and the merge logic gates write-path edits on shared_only fields.
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
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
            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);

            // Masked state visible
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            // Value selector on the masked row must be disabled
            const valueSelector = page.locator('[data-testid="valueSelectorMenuButton"]').first();
            await expect(valueSelector).toBeVisible({timeout: 3000});
            await expect(valueSelector).toBeDisabled();

            // Attribute selector locked
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

    test('MM-68508-10: Text field masking with "in" operator', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
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
            await setFieldAsSharedOnly(fieldId);

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

    test('MM-68508-11: Text field masking with single-value operator (value not held)', async ({pw}) => {
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            // adminUser holds "Building 1"; policy value is "Building 7" (not held)
            const fieldName = `${fieldPrefix}Loc_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Building 1');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            // Policy: Location != "Building 7"
            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${fieldName} != "Building 7"`,
            );
            policyIds.push(policyId);
            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);

            // "Building 7" is not held by the admin → it should be masked in some form
            await expect(page.locator('text="Building 7"')).not.toBeVisible();

            // The row should still show the masked state: either masked chip or read-only input
            const maskedState = page.locator(
                '.select__multi-value--masked, input[disabled], .values-editor__simple-input[disabled]',
            );
            await expect(maskedState).toBeVisible({timeout: 5000});
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

    test('MM-68508-22: Fully-masked hasAnyOf row displays correct operator', async ({pw}) => {
        // Regression test for: when a caller holds none of the values in a
        // hasAnyOf condition, all values are replaced by a single masked-token
        // sentinel. The masked expression re-parses to a standalone "tok in attr"
        // which mergeMultiselectConditions promotes to hasAllOf — showing the wrong
        // operator in the table editor. The fix emits a duplicate-token OR to
        // preserve hasAnyOf semantics through the re-parse cycle.
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `${fieldPrefix}Team_${pw.random.id()}`;
            const fieldId = await createMaskingMultiselectField(adminClient, fieldName, ['Alpha', 'Bravo']);
            fieldIds.push(fieldId);

            // adminUser holds NONE of the values — the entire condition is fully masked.

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            // Policy uses hasAnyOf: ("Alpha" in attr || "Bravo" in attr)
            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `("Alpha" in user.attributes.${fieldName} || "Bravo" in user.attributes.${fieldName})`,
            );
            policyIds.push(policyId);

            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);

            // Only the masked chip is visible — caller holds no values.
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).not.toBeVisible();
            await expect(page.locator('.select__multi-value').filter({hasText: 'Bravo'})).not.toBeVisible();

            // The operator selector on the masked row must show "has any of", NOT "has all of".
            const operatorBtn = page.locator('[data-testid="operatorSelectorMenuButton"]').first();
            await operatorBtn.waitFor({state: 'visible', timeout: 10000});
            await expect(operatorBtn).toContainText('has any of');
            await expect(operatorBtn).not.toContainText('has all of');
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
});

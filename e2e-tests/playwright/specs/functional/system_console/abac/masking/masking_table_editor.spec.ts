// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';

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
} from './masking_helpers';
import {getStoredPolicyRuleExpressions, purgeFieldsByPrefix, setFieldAsSharedOnly} from './masking_db_setup';

const fieldPrefix = 'MaskingTE';

test.describe('Attribute-Value Masking - Table Editor', {tag: ['@abac', '@abac_masking']}, () => {
    // Purge any orphaned MaskingTE* CPA fields left by previous failed runs so we
    // don't hit the 200-field global limit mid-suite.
    test.beforeAll(async () => {
        await purgeFieldsByPrefix(fieldPrefix);
    });

    test('MM-68508-1: Full masking round-trip in Simple editor', async ({pw}) => {
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
            await setFieldAsSharedOnly(fieldId);

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
            if (await testRulesBtn.isVisible({timeout: 3000})) {
                await expect(testRulesBtn).toBeDisabled();
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

    test('MM-68508-2: Caller with masked values can save; hidden values are preserved by merge', async ({pw}) => {
        // Validates that callers with masked values CAN save changes. Merge-on-save
        // re-injects hidden values so Bravo and Charlie survive even though the caller
        // only sees and submits Alpha. Save button is enabled (not gated on masked state).
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
            const storedPolicyId = await getPolicyIdFromURL(page);

            // Alpha visible, Bravo+Charlie masked
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            const saveBtn = page.getByRole('button', {name: 'Save'});

            // Dirty the form via the policy name field. Masked rows are read-only so
            // we can't remove/add chips. The merge-on-save invariant we're testing
            // doesn't depend on how the form is dirtied.
            const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await nameInput.fill(policyName + ' (edited)');
            await page.waitForTimeout(300);

            await saveBtn.click();
            await page.waitForLoadState('networkidle');

            // Verify via DB: Bravo + Charlie preserved by merge-on-save
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

            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            // Row-remove (trash) button must be disabled on the masked row
            const removeRowBtn = page
                .locator('button[aria-label="Remove row"], button.table-editor__row-remove')
                .first();
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

    test('MM-68508-4: Self-inclusion failure blocks save (caller has full visibility)', async ({pw}) => {
        // Self-inclusion is only checked when the caller holds ALL values in the policy
        // (no masked values). If masked values are present the 403 block fires first
        // and the Save button is disabled. This test uses a single-value policy so the
        // caller has full visibility, then removes their own satisfying value.
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);

            // adminUser holds "Alpha"; policy has ONLY ["Alpha"] — no masked values
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');
            await adminClient.addToTeam(team.id, adminUser.id);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(page, policyName, `user.attributes.${fieldName} in ["Alpha"]`);
            policyIds.push(policyId);
            await setFieldAsSharedOnly(fieldId);

            await openExistingPolicy(page, policyName);

            // Alpha visible, no masked chip — caller has full visibility
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
            await expect(page.locator('.select__multi-value--masked')).not.toBeVisible();

            const saveBtn = page.getByRole('button', {name: 'Save'});

            // Remove Alpha — now the condition has no values (empty)
            const alphaChip = page.locator('.select__multi-value').filter({hasText: 'Alpha'});
            await alphaChip.locator('.select__multi-value__remove').click();
            await page.waitForTimeout(300);

            await saveBtn.click();
            await page.waitForTimeout(2000);

            // An error message about self-inclusion should appear
            const errorMsg = page.locator('text=/do not satisfy|self.inclusion|condition/i').first();
            await expect(errorMsg).toBeVisible({timeout: 8000});

            // Reload — Alpha should still be in the stored policy (save was blocked)
            await page.reload();
            await page.waitForLoadState('networkidle');
            await openExistingPolicy(page, policyName);
            await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).toBeVisible();
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

    test('MM-68508-5: Non-held value rejected via direct API', async ({pw}) => {
        test.setTimeout(60000);
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

            // Try to create a policy containing a non-held value ("Delta") via direct API
            const statusWithDelta = await page.evaluate(
                async ({fieldName: fn}: {fieldName: string}) => {
                    const resp = await fetch('/api/v4/access_control_policies', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        body: JSON.stringify({
                            name: `Illegal ${Date.now()}`,
                            type: 'member',
                            rules: [{expression: `user.attributes.${fn} in ["Alpha", "Delta"]`}],
                        }),
                    });
                    return resp.status;
                },
                {fieldName},
            );

            // Server must reject with 400 — "Delta" is not a held value
            expect(statusWithDelta).toBe(400);

            // Also verify that the masked placeholder literal is rejected
            const statusWithMasked = await page.evaluate(
                async ({fieldName: fn}: {fieldName: string}) => {
                    const resp = await fetch('/api/v4/access_control_policies', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        body: JSON.stringify({
                            name: `Illegal ${Date.now()}`,
                            type: 'member',
                            rules: [{expression: `user.attributes.${fn} in ["Alpha", "--------"]`}],
                        }),
                    });
                    return resp.status;
                },
                {fieldName},
            );

            expect(statusWithMasked).toBe(400);
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

    test('MM-68508-6: CEL editor is read-only when policy has masked values', async ({pw}) => {
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

            await expect(page.locator('.select__multi-value--masked')).toBeVisible();

            // Switch to Advanced (CEL) mode
            const advancedBtn = page.getByRole('button', {name: /advanced/i});
            await advancedBtn.waitFor({state: 'visible', timeout: 5000});
            await advancedBtn.click();
            await page.waitForTimeout(1000);

            // Monaco editor must be read-only — verify functionally: capture the current text,
            // attempt to type, and assert the content is unchanged.
            const monacoEditor = page.locator('.monaco-editor').first();
            await monacoEditor.waitFor({state: 'visible', timeout: 5000});
            const viewLines = monacoEditor.locator('.view-lines').first();
            const before = (await viewLines.textContent()) ?? '';
            await monacoEditor.locator('textarea.inputarea').first().focus();
            await page.keyboard.press('End');
            await page.keyboard.type('xyz');
            await page.waitForTimeout(300);
            const after = (await viewLines.textContent()) ?? '';
            expect(after).toBe(before);

            // There should be a notice/banner about restricted values in CEL mode
            const celNotice = page.locator('text=/restricted values|read.only/i').first();
            await expect(celNotice).toBeVisible({timeout: 5000});

            // Test-access-rule button must be disabled in CEL mode with masked values
            const testRulesBtn = page.locator('button').filter({hasText: 'Test access rule'});
            if (await testRulesBtn.isVisible({timeout: 3000})) {
                await expect(testRulesBtn).toBeDisabled();
            }

            // Switch back to Simple mode — masked chip is still present
            const simpleBtn = page.getByRole('button', {name: /simple/i});
            if (await simpleBtn.isVisible({timeout: 3000})) {
                await simpleBtn.click();
                await page.waitForTimeout(500);
                await expect(page.locator('.select__multi-value--masked')).toBeVisible();
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
});

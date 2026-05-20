// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';

import {purgeFieldsByPrefix, setFieldAsSharedOnly} from './masking_db_setup';
import {
    createMaskingTextField,
    createPolicyWithCEL,
    deleteCPAField,
    deletePolicy,
    disableMaskingFlag,
    enableMaskingFlag,
    openExistingPolicy,
    setUserAttribute,
} from './support';

/**
 * Attribute-Value Masking — save-path validation.
 *
 * Covers:
 *   - Self-inclusion failure when the caller has full visibility (no masked
 *     values) and removes the value that lets them satisfy the rule.
 *   - Write-path rejection of non-held values and the masked-token sentinel
 *     submitted via direct API calls.
 *   - Read-only state of the CEL editor when masked values are present.
 */

test.beforeAll(async () => {
    await purgeFieldsByPrefix('Masking');
});

test('MM-68508-4: Self-inclusion failure blocks save (caller has full visibility)', async ({pw}) => {
    // Self-inclusion is only checked when the caller holds ALL values in the policy
    // (no masked values). If masked values are present the 403 block fires first
    // and the Save button is disabled. This test uses a single-value policy so the
    // caller has full visibility, then removes their own satisfying value.
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();
    const fieldIds: string[] = [];
    const policyIds: string[] = [];

    try {
        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `MaskingProgram_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);

        // adminUser holds "Alpha"; policy has ONLY ["Alpha"] — no masked values
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');
        await adminClient.addToTeam(team.id, adminUser.id);

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const page = systemConsolePage.page;
        await navigateToABACPage(page);
        await enableABAC(page);

        // Policy: MaskingProgram in ["Alpha"] — admin holds ALL values, no masking
        const policyName = `MaskingPolicy ${pw.random.id()}`;
        const policyId = await createPolicyWithCEL(page, policyName, `user.attributes.${fieldName} in ["Alpha"]`);
        policyIds.push(policyId);
        // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
        // otherwise reject values the caller does not hold. Flipping now means the policy
        // is created against a public field, then masking applies on the next load.
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

        // Try to save — should be blocked (admin no longer satisfies the condition)
        await saveBtn.click();
        await page.waitForTimeout(2000);

        // An error message about self-inclusion should appear
        const errorMsg = page.locator('text=/do not satisfy|self.inclusion|condition/i').first();
        await expect(errorMsg).toBeVisible();

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
        await setFieldAsSharedOnly(fieldId); // UNPLUG: remove to skip masking setup

        await openExistingPolicy(page, policyName);

        // Confirm masking is active (sanity)
        await expect(page.locator('.select__multi-value--masked')).toBeVisible();

        // Switch to Advanced (CEL) mode
        const advancedBtn = page.getByRole('button', {name: /advanced/i});
        await advancedBtn.waitFor({state: 'visible', timeout: 5000});
        await advancedBtn.click();
        await page.waitForTimeout(1000);

        // Monaco editor must be read-only. Monaco doesn't set the DOM `readonly`
        // attribute unless `domReadOnly: true` is configured, and it isn't exposed
        // on `window`. Verify functionally: capture the current text, attempt to
        // type, and assert the content is unchanged.
        const monacoEditor = page.locator('.monaco-editor').first();
        await monacoEditor.waitFor({state: 'visible', timeout: 5000});
        const viewLines = monacoEditor.locator('.view-lines').first();
        const before = (await viewLines.textContent()) ?? '';
        // Click is intercepted by the .view-lines overlay; focus the textarea
        // directly and dispatch keystrokes — Monaco routes them to its model.
        await monacoEditor.locator('textarea.inputarea').first().focus();
        await page.keyboard.press('End');
        await page.keyboard.type('xyz');
        await page.waitForTimeout(300);
        const after = (await viewLines.textContent()) ?? '';
        expect(after).toBe(before);

        // There should be a notice/banner about restricted values in CEL mode
        const celNotice = page.locator('text=/restricted values|read.only/i').first();
        await expect(celNotice).toBeVisible();

        // Test-access-rule button must be disabled in CEL mode with masked values
        const testRulesBtn = page.locator('button').filter({hasText: 'Test access rule'});
        if (await testRulesBtn.isVisible()) {
            await expect(testRulesBtn).toBeDisabled();
        }

        // Switch back to Simple mode — masked chip is still present
        const simpleBtn = page.getByRole('button', {name: /simple/i});
        if (await simpleBtn.isVisible()) {
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

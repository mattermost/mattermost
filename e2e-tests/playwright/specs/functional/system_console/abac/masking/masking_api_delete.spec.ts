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
    getRawPolicyExpression,
    openExistingPolicy,
    resubmitPolicyExpression,
    searchPoliciesExpression,
    setUserAttribute,
} from './masking_helpers';
import {getStoredPolicyRuleExpressions, purgeFieldsByPrefix, setFieldAsSharedOnly} from './masking_db_setup';

const fieldPrefix = 'MaskingAD';

test.describe('Attribute-Value Masking - API Redaction and Delete', {tag: ['@abac', '@abac_masking']}, () => {
    test.beforeAll(async () => {
        await purgeFieldsByPrefix(fieldPrefix);
    });

    test('MM-68508-12: GET /policies/{id} does not leak raw CEL when values are masked', async ({pw}) => {
        test.setTimeout(60000);
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
            expect(storedPolicyId).toBeTruthy();

            // GET policy as the logged-in user (holds "Alpha" only). Hidden values
            // must be replaced with the masked-token sentinel.
            const expression = await getRawPolicyExpression(page, storedPolicyId);
            expect(expression).toContain('Alpha');
            expect(expression).toContain('--------');
            expect(expression).not.toContain('Bravo');
            expect(expression).not.toContain('Charlie');

            // Direct DB read bypasses the API masking pipeline — stored expression
            // must still contain the originals.
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

    test('MM-68508-13: POST /policies/search does not leak raw CEL when values are masked', async ({pw}) => {
        test.setTimeout(60000);
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

            // Search as the logged-in (masked) user — the response must contain the
            // masked-token sentinel for any hidden values, never the raw originals.
            const maskedExpression = await searchPoliciesExpression(page, policyName);
            expect(maskedExpression).toContain('--------');
            expect(maskedExpression).not.toContain('Bravo');
            expect(maskedExpression).not.toContain('Charlie');

            // Verify the stored policy still contains the originals — direct DB read.
            const rawExpression = (await getStoredPolicyRuleExpressions(policyId))[0] ?? '';
            expect(rawExpression).toContain('Alpha');
            expect(rawExpression).toContain('Bravo');
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

    test('MM-68508-14: Warning banner visible in editor when policy has masked values', async ({pw}) => {
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

            // Policy with masked values (admin holds Alpha; Bravo/Charlie are masked)
            const maskedPolicyName = `MaskingPolicy ${pw.random.id()}`;
            const maskedPolicyId = await createPolicyWithCEL(
                page,
                maskedPolicyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(maskedPolicyId);

            // Policy with NO masked values (admin holds the only value in the condition)
            const cleanPolicyName = `CleanPolicy ${pw.random.id()}`;
            const cleanPolicyId = await createPolicyWithCEL(
                page,
                cleanPolicyName,
                `user.attributes.${fieldName} in ["Alpha"]`,
            );
            policyIds.push(cleanPolicyId);

            // shared_only must flip AFTER both policy saves
            await setFieldAsSharedOnly(fieldId);

            // Open masked policy — warning banner must be present
            await openExistingPolicy(page, maskedPolicyName);
            await expect(page.locator('text="This policy contains restricted values"')).toBeVisible({timeout: 5000});

            // Open clean policy — warning banner must NOT be present
            await openExistingPolicy(page, cleanPolicyName);
            await expect(page.locator('text="This policy contains restricted values"')).not.toBeVisible();
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

    test('MM-68508-15: Delete button is disabled on masked policies; clean policies open the standard confirmation modal', async ({
        pw,
    }) => {
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

            // Policy WITH masked values
            const maskedPolicyName = `MaskingPolicy ${pw.random.id()}`;
            const maskedPolicyId = await createPolicyWithCEL(
                page,
                maskedPolicyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(maskedPolicyId);

            // Policy WITHOUT masked values
            const cleanPolicyName = `CleanPolicy ${pw.random.id()}`;
            const cleanPolicyId = await createPolicyWithCEL(
                page,
                cleanPolicyName,
                `user.attributes.${fieldName} in ["Alpha"]`,
            );
            policyIds.push(cleanPolicyId);

            await setFieldAsSharedOnly(fieldId);

            // --- Masked policy: Delete button must be disabled (no modal flow) ---
            await openExistingPolicy(page, maskedPolicyName);

            const deleteBtn = page.getByRole('button', {name: /delete policy|delete/i}).last();
            await deleteBtn.scrollIntoViewIfNeeded();
            await expect(deleteBtn).toBeDisabled();

            // --- Clean policy: Delete button must be enabled and open a normal
            // confirmation modal without the "restricted values" warning ---
            await openExistingPolicy(page, cleanPolicyName);

            const cleanDeleteBtn = page.getByRole('button', {name: /delete policy|delete/i}).last();
            await cleanDeleteBtn.scrollIntoViewIfNeeded();
            await expect(cleanDeleteBtn).toBeEnabled();
            await cleanDeleteBtn.click();
            await page.waitForTimeout(500);

            const cleanModal = page.locator('[role="dialog"]').filter({hasText: /confirm|delete/i});
            await cleanModal.waitFor({state: 'visible', timeout: 5000});
            await expect(cleanModal.locator('text=/restricted values/i')).not.toBeVisible();

            await cleanModal.getByRole('button', {name: /cancel/i}).click();
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

    test('MM-68508-16: Delete Policy is blocked (UI and server) when caller has masked values', async ({pw}) => {
        // Validates that the read-only-when-masked invariant covers deletion:
        // - Delete Policy button in the UI is disabled when hasMaskedRows is true
        // - Server returns HTTP 403 for direct DELETE requests when caller has masked values
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

            // UI: Delete Policy button must be disabled when masked values present
            const deleteBtn = page.getByRole('button', {name: /^delete$/i}).last();
            await expect(deleteBtn).toBeVisible({timeout: 5000});
            await expect(deleteBtn).toBeDisabled();

            expect(policyId).toMatch(/^[A-Za-z0-9]{26}$/);

            // Server: direct DELETE must return HTTP 403
            const status = await page.evaluate(async (id: string) => {
                const resp = await fetch(`/api/v4/access_control_policies/${id}`, {
                    method: 'DELETE',
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                });
                return resp.status;
            }, policyId);

            expect(status, `DELETE /api/v4/access_control_policies/${policyId} returned ${status}`).toBe(403);

            // Verify policy still exists via DB
            const expression = (await getStoredPolicyRuleExpressions(policyId))[0] ?? '';
            expect(expression).toContain('Alpha');
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

    test('MM-68508-17: Multi-condition save preserves all hidden values; deleting masked row is blocked', async ({
        pw,
    }) => {
        // Validates merge-on-save for a multi-condition policy. The caller (holds Alpha
        // in programField, nothing in clearanceField) can save — both conditions survive
        // with their hidden values intact. The server blocks deletion of masked conditions.
        test.setTimeout(150000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const programFieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
            const clearanceFieldName = `${fieldPrefix}Clear_${pw.random.id()}`;
            const programFieldId = await createMaskingTextField(adminClient, programFieldName);
            const clearanceFieldId = await createMaskingTextField(adminClient, clearanceFieldName);
            fieldIds.push(programFieldId, clearanceFieldId);

            await setUserAttribute(adminClient, adminUser.id, programFieldId, 'Alpha');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const page = systemConsolePage.page;
            await navigateToABACPage(page);
            await enableABAC(page);

            const policyName = `MaskingRegressionPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                page,
                policyName,
                `user.attributes.${programFieldName} in ["Alpha", "Bravo", "Charlie"] && user.attributes.${clearanceFieldName} in ["Secret", "TopSecret"]`,
            );
            policyIds.push(policyId);

            // shared_only must flip AFTER the policy save for both fields
            await setFieldAsSharedOnly(programFieldId);
            await setFieldAsSharedOnly(clearanceFieldId);

            await openExistingPolicy(page, policyName);
            const storedPolicyId = await getPolicyIdFromURL(page);

            // Both rows are masked — banner visible
            await expect(page.locator('.select__multi-value--masked').first()).toBeVisible();
            await expect(page.locator('text="This policy contains restricted values"')).toBeVisible();

            const saveBtn = page.getByRole('button', {name: 'Save'});

            // Trash buttons on both masked rows must be DISABLED
            const trashButtons = page.locator('button[aria-label="Remove row"]');
            const firstTrash = trashButtons.first();
            if (await firstTrash.isVisible({timeout: 3000})) {
                await expect(firstTrash).toBeDisabled();
            }

            // Dirty the form via the policy name so Save enables
            const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
            await nameInput.fill(policyName + ' (edited)');
            await page.waitForTimeout(300);

            await saveBtn.click();
            await page.waitForLoadState('networkidle');

            // Verify the stored policy directly — all hidden values must survive merge-on-save
            const rawExpression = (await getStoredPolicyRuleExpressions(storedPolicyId))[0] ?? '';

            expect(rawExpression).toContain(programFieldId);
            expect(rawExpression).toContain('Bravo');
            expect(rawExpression).toContain('Charlie');
            expect(rawExpression).toContain(clearanceFieldId);
            expect(rawExpression).toContain('Secret');
            expect(rawExpression).toContain('TopSecret');

            // Server blocks a direct API attempt to remove a masked condition
            const status = await page.evaluate(
                async ({policyId: id, fn}: {policyId: string; fn: string}) => {
                    const resp = await fetch('/api/v4/access_control_policies', {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
                        body: JSON.stringify({
                            id,
                            name: 'Modified',
                            type: 'parent',
                            rules: [{expression: `user.attributes.${fn} in ["Alpha"]`}],
                        }),
                    });
                    return resp.status;
                },
                {policyId, fn: programFieldName},
            );

            expect(status, `PUT /api/v4/access_control_policies (id=${policyId}) returned ${status}`).toBe(403);
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

    test('MM-68508-19: Mode toggle Simple → Advanced → Simple preserves all masked-row restrictions', async ({pw}) => {
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

            // --- Initial Simple mode: restrictions in place ---
            const maskedChip = page.locator('.select__multi-value--masked');
            const banner = page.locator('text="This policy contains restricted values"');
            const deleteBtn = page.getByRole('button', {name: /^delete$/i}).last();

            await expect(maskedChip.first()).toBeVisible();
            await expect(banner).toBeVisible();
            await expect(deleteBtn).toBeDisabled();

            // --- Switch to Advanced mode ---
            const toAdvanced = page.getByRole('button', {name: /switch to advanced mode/i});
            await toAdvanced.click();
            await page.waitForTimeout(500);

            // Banner must persist across the toggle
            await expect(banner).toBeVisible();
            await expect(page.locator('.monaco-editor').first()).toBeVisible();

            // --- Switch back to Simple mode ---
            const toSimple = page.getByRole('button', {name: /switch to simple mode/i});
            await toSimple.click();
            await page.waitForTimeout(1500);

            // All restrictions must STILL be in place after toggling back
            await expect(banner).toBeVisible();
            await expect(maskedChip.first()).toBeVisible();
            await expect(deleteBtn).toBeDisabled();

            const valueSelector = page.locator('[data-testid="valueSelectorMenuButton"]').first();
            if (await valueSelector.isVisible({timeout: 2000})) {
                await expect(valueSelector).toBeDisabled();
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

    test('MM-68508-22: PUT re-submitting "false" over a rule with hidden values is rejected (403), stored policy untouched', async ({
        pw,
    }) => {
        // The genuinely dangerous scenario: a caller re-submits the deny-all
        // sentinel "false" over a stored rule whose values they cannot see, which
        // would silently wipe a masked rule. The canonical merge can't pair the
        // bare "false" with the stored masked node, so it must fail closed (403)
        // and leave the stored expression untouched. The merge is the actual line
        // of defence — rejectMaskedTokens' former "== false" check was only a
        // redundant (and overbroad) extra layer on top of it. This is the
        // end-to-end proof of that protection.
        test.setTimeout(60000);
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

            // Flip to shared_only AFTER the save: the admin now holds only "Alpha",
            // so "Bravo"/"Charlie" become hidden from this caller.
            await setFieldAsSharedOnly(fieldId);

            // Sanity: the caller's GET view is masked.
            const masked = await getRawPolicyExpression(page, policyId);
            expect(masked).toContain('Alpha');
            expect(masked).toContain('--------');
            expect(masked).not.toContain('Bravo');
            expect(masked).not.toContain('Charlie');

            // Attempt to overwrite the masked rule with the bare deny-all sentinel.
            const {status, body} = await resubmitPolicyExpression(page, policyId, 'false');
            expect(status, `PUT re-submitting "false" returned ${status}`).toBe(403);
            expect(body?.id).toBe('app.pap.save_policy.masked_condition_deleted');

            // The stored expression must be untouched — direct DB read still has originals.
            const rawExpression = (await getStoredPolicyRuleExpressions(policyId))[0] ?? '';
            expect(rawExpression).toContain('Alpha');
            expect(rawExpression).toContain('Bravo');
            expect(rawExpression).toContain('Charlie');
            expect(rawExpression).not.toBe('false');
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

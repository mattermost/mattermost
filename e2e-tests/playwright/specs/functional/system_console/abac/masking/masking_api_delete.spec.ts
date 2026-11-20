// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, duration} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';

import {
    createMaskingTextField,
    createPolicyWithCEL,
    deleteCPAField,
    deletePolicy,
    disableMaskingFlag,
    enableMaskingFlag,
    getRawPolicyExpression,
    openMaskedPolicy,
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
        test.setTimeout(duration.one_min);
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

            const {app} = await pw.testBrowser.login(adminUser);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                app,
                adminClient,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            await setFieldAsSharedOnly(fieldId);

            // GET policy as the logged-in user (holds "Alpha" only). Hidden values
            // must be replaced with the masked-token sentinel.
            const expression = await getRawPolicyExpression(app.page, policyId);
            expect(expression).toContain('Alpha');
            expect(expression).toContain('--------');
            expect(expression).not.toContain('Bravo');
            expect(expression).not.toContain('Charlie');

            // Direct DB read bypasses the API masking pipeline — stored expression
            // must still contain the originals.
            const rawExpression = (await getStoredPolicyRuleExpressions(policyId))[0] ?? '';
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
        test.setTimeout(duration.one_min);
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

            const {app} = await pw.testBrowser.login(adminUser);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                app,
                adminClient,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            await setFieldAsSharedOnly(fieldId);

            // Search as the logged-in (masked) user — the response must contain the
            // masked-token sentinel for any hidden values, never the raw originals.
            const maskedExpression = await searchPoliciesExpression(app.page, policyName);
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
        test.setTimeout(duration.two_min);
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

            const {app} = await pw.testBrowser.login(adminUser);

            // Policy with masked values (admin holds Alpha; Bravo/Charlie are masked)
            const maskedPolicyName = `MaskingPolicy ${pw.random.id()}`;
            const maskedPolicyId = await createPolicyWithCEL(
                app,
                adminClient,
                maskedPolicyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(maskedPolicyId);

            // Policy with NO masked values (admin holds the only value in the condition)
            const cleanPolicyName = `CleanPolicy ${pw.random.id()}`;
            const cleanPolicyId = await createPolicyWithCEL(
                app,
                adminClient,
                cleanPolicyName,
                `user.attributes.${fieldName} in ["Alpha"]`,
            );
            policyIds.push(cleanPolicyId);

            // shared_only must flip AFTER both policy saves
            await setFieldAsSharedOnly(fieldId);

            // * The masked policy shows the warning banner
            const masked = await openMaskedPolicy(app, maskedPolicyId);
            await expect(masked.policy.maskedValuesWarning).toBeVisible();

            // * The clean policy doesn't
            const clean = await openMaskedPolicy(app, cleanPolicyId);
            await expect(await clean.row.value.chipList.itemWith({text: 'Alpha'})).toContainText('Alpha');
            await expect(clean.policy.maskedValuesWarning).toHaveCount(0);
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
        test.setTimeout(duration.two_min);
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

            const {app} = await pw.testBrowser.login(adminUser);

            // Policy WITH masked values
            const maskedPolicyName = `MaskingPolicy ${pw.random.id()}`;
            const maskedPolicyId = await createPolicyWithCEL(
                app,
                adminClient,
                maskedPolicyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(maskedPolicyId);

            // Policy WITHOUT masked values
            const cleanPolicyName = `CleanPolicy ${pw.random.id()}`;
            const cleanPolicyId = await createPolicyWithCEL(
                app,
                adminClient,
                cleanPolicyName,
                `user.attributes.${fieldName} in ["Alpha"]`,
            );
            policyIds.push(cleanPolicyId);

            await setFieldAsSharedOnly(fieldId);

            // * Masked policy: Delete is disabled (no modal flow)
            const masked = await openMaskedPolicy(app, maskedPolicyId);
            await expect(masked.policy.deleteButton).toBeDisabled();

            // * Clean policy: Delete is enabled and opens the standard confirmation, without the
            // "restricted values" warning
            const clean = await openMaskedPolicy(app, cleanPolicyId);
            await expect(clean.policy.deleteButton).toBeEnabled();
            await clean.policy.deleteButton.click();
            const {deleteModal} = clean.policy;
            await expect(deleteModal).toBeVisible();
            await expect(deleteModal).not.toContainText(/restricted values/i);
            await deleteModal.cancelButton.click();
            await expect(deleteModal).not.toBeVisible();
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
        test.setTimeout(duration.two_min);
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

            const {app} = await pw.testBrowser.login(adminUser);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                app,
                adminClient,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            await setFieldAsSharedOnly(fieldId);

            const {policy, row} = await openMaskedPolicy(app, policyId);
            await expect(row.maskedImg).toBeVisible();

            // * UI: Delete is disabled while masked values are present
            await expect(policy.deleteButton).toBeVisible();
            await expect(policy.deleteButton).toBeDisabled();

            expect(policyId).toMatch(/^[A-Za-z0-9]{26}$/);

            // Server: direct DELETE must return HTTP 403
            const status = await app.page.evaluate(async (id: string) => {
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
        test.setTimeout(duration.four_min);
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

            const {app} = await pw.testBrowser.login(adminUser);

            const policyName = `MaskingRegressionPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                app,
                adminClient,
                policyName,
                `user.attributes.${programFieldName} in ["Alpha", "Bravo", "Charlie"] && user.attributes.${clearanceFieldName} in ["Secret", "TopSecret"]`,
            );
            policyIds.push(policyId);

            // shared_only must flip AFTER the policy save for both fields
            await setFieldAsSharedOnly(programFieldId);
            await setFieldAsSharedOnly(clearanceFieldId);

            const {policy, row} = await openMaskedPolicy(app, policyId);

            // * Both rows are masked, with the banner
            await expect(row.maskedImg).toBeVisible();
            await expect(policy.rules.row(1).maskedImg).toBeVisible();
            await expect(policy.maskedValuesWarning).toBeVisible();

            // * The remove buttons on both masked rows are disabled
            await expect(row.removeButton).toBeDisabled();
            await expect(policy.rules.row(1).removeButton).toBeDisabled();

            // # Dirty the form via the policy name so Save enables, and save
            await policy.editPolicy.name.valueTextbox.fill(policyName + ' (edited)');
            await app.admin.saveButton.click();
            await expect(app.page).toHaveURL(/\/membership_policies$/);

            // Verify the stored policy directly — all hidden values must survive merge-on-save
            const rawExpression = (await getStoredPolicyRuleExpressions(policyId))[0] ?? '';

            expect(rawExpression).toContain(programFieldId);
            expect(rawExpression).toContain('Bravo');
            expect(rawExpression).toContain('Charlie');
            expect(rawExpression).toContain(clearanceFieldId);
            expect(rawExpression).toContain('Secret');
            expect(rawExpression).toContain('TopSecret');

            // Server blocks a direct API attempt to remove a masked condition
            const status = await app.page.evaluate(
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
        test.setTimeout(duration.two_min);
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

            const {app} = await pw.testBrowser.login(adminUser);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                app,
                adminClient,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);
            await setFieldAsSharedOnly(fieldId);

            const {policy, row} = await openMaskedPolicy(app, policyId);

            // * Simple mode: the restrictions are in place
            await expect(row.maskedImg).toBeVisible();
            await expect(policy.maskedValuesWarning).toBeVisible();
            await expect(policy.deleteButton).toBeDisabled();

            // # Switch to Advanced mode
            await policy.switchModeButton.click();

            // * The banner persists across the toggle
            await expect(policy.cel.input).toBeVisible();
            await expect(policy.maskedValuesWarning).toBeVisible();

            // # Switch back to Simple mode
            await policy.switchModeButton.click();

            // * All restrictions are still in place
            await expect(policy.maskedValuesWarning).toBeVisible();
            await expect(row.maskedImg).toBeVisible();
            await expect(policy.deleteButton).toBeDisabled();
            await expect(row.value.container).toBeDisabled();
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
        test.setTimeout(duration.one_min);
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

            const {app} = await pw.testBrowser.login(adminUser);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                app,
                adminClient,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo", "Charlie"]`,
            );
            policyIds.push(policyId);

            // Flip to shared_only AFTER the save: the admin now holds only "Alpha",
            // so "Bravo"/"Charlie" become hidden from this caller.
            await setFieldAsSharedOnly(fieldId);

            // Sanity: the caller's GET view is masked.
            const masked = await getRawPolicyExpression(app.page, policyId);
            expect(masked).toContain('Alpha');
            expect(masked).toContain('--------');
            expect(masked).not.toContain('Bravo');
            expect(masked).not.toContain('Charlie');

            // Attempt to overwrite the masked rule with the bare deny-all sentinel.
            const {status, body} = await resubmitPolicyExpression(app.page, policyId, 'false');
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

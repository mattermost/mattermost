// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, duration} from '@mattermost/playwright-lib';

import {enableUserManagedAttributes} from '../support';
import {setAbacEnabled} from '../surface';
import {createTeamAdmin, enableABACConfig} from '../../../channels/team_settings/helpers';

import {
    createMaskingTextField,
    createPolicyWithCEL,
    deleteCPAField,
    deletePolicy,
    disableMaskingFlag,
    enableMaskingFlag,
    openMaskedPolicy,
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

            // adminUser holds "Alpha" — Bravo and Charlie will be masked for them
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
            // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
            // otherwise reject values the caller does not hold. Flipping now means the policy
            // is created against a public field, then masking applies on the next load.
            await setFieldAsSharedOnly(fieldId);

            const {policy, row} = await openMaskedPolicy(app, policyId);

            // * Alpha (held) is the only value shown; Bravo and Charlie sit behind the masked chip
            await expect(await row.value.chipList.itemWith({text: 'Alpha'})).toContainText('Alpha');
            await expect(row.value.chipList).toHaveKeyCount(1);
            await expect(row.maskedImg).toBeVisible();
            await expect(row).not.toContainText('Bravo');
            await expect(row).not.toContainText('Charlie');

            // * The warning banner shows
            await expect(policy.maskedValuesWarning).toBeVisible();

            // * The row's attribute selector is locked, and the access test is disabled
            await expect(row.attributeButton).toBeDisabled();
            await expect(policy.rules.testButton).toBeDisabled();
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

            // * Alpha visible, Bravo + Charlie masked
            await expect(await row.value.chipList.itemWith({text: 'Alpha'})).toContainText('Alpha');
            await expect(row.maskedImg).toBeVisible();

            // # Dirty the form via the policy name field and save. Masked rows are read-only so
            // we can't remove/add chips. The merge-on-save invariant we're testing
            // doesn't depend on how the form is dirtied.
            await policy.editPolicy.name.valueTextbox.fill(policyName + ' (edited)');
            await app.admin.saveButton.click();
            await expect(app.page).toHaveURL(/\/membership_policies$/);

            // * Verify via DB: Bravo + Charlie preserved by merge-on-save
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

    test('MM-68508-3: Row-remove button is disabled on masked rows', async ({pw}) => {
        // The trash/remove button on a masked row is disabled — a caller with
        // masked values cannot delete individual rows, matching the Save/Delete
        // buttons which are also disabled when masked values are present.
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

            const {row} = await openMaskedPolicy(app, policyId);

            await expect(await row.value.chipList.itemWith({text: 'Alpha'})).toContainText('Alpha');
            await expect(row.maskedImg).toBeVisible();

            // * The row's remove (trash) button is disabled on the masked row
            await expect(row.removeButton).toBeVisible();
            await expect(row.removeButton).toBeDisabled();
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

    test('MM-68508-4: A team admin who sees every value cannot save a membership policy that excludes them', async ({
        pw,
    }) => {
        // The server's self-inclusion check (app.pap.save_policy.self_exclusion) applies to callers who aren't system
        // admins, and every admin screen asks the server first, so it is reached through the API only: a team admin
        // saving their team's membership policy. With masking on and the team admin holding every value in the rule,
        // nothing is hidden or re-merged, so the refusal is the specific self-exclusion one.
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminClient, team} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableABACConfig(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `${fieldPrefix}Self_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);

            // # A team admin (not a system admin) who holds "Alpha", the only value either rule uses; then the field
            // becomes shared-only (masked), which takes values from admins no longer
            const teamAdmin = await createTeamAdmin(adminClient, team.id);
            await setUserAttribute(adminClient, teamAdmin.id, fieldId, 'Alpha');
            await setFieldAsSharedOnly(fieldId);
            const {client: teamAdminClient} = await pw.makeClient({
                username: teamAdmin.username,
                password: teamAdmin.password,
            });

            // # The team admin saves a membership policy for their team that they satisfy
            const satisfied = `user.attributes.${fieldName} == "Alpha"`;
            const saved = await teamAdminClient.updateOrCreateAccessControlPolicy(
                {
                    id: '',
                    name: `Self inclusion ${pw.random.id()}`,
                    type: 'parent',
                    version: 'v0.3',
                    revision: 0,
                    rules: [{expression: satisfied, actions: ['membership']}],
                } as never,
                team.id,
            );
            policyIds.push(saved.id);

            // * The save goes through: the refusal below is about excluding themselves, not about saving at all (the
            // server stores the rule with the attribute's ids in place of its name)
            const stored = await getStoredPolicyRuleExpressions(saved.id);
            expect(stored).toHaveLength(1);
            expect(stored[0]).toMatch(/ == "Alpha"$/);

            // # They edit it to a rule they don't satisfy, still using only a value they hold
            const excluding = `user.attributes.${fieldName} != "Alpha"`;
            const refused = await teamAdminClient
                .updateOrCreateAccessControlPolicy(
                    {...saved, rules: [{expression: excluding, actions: ['membership']}]},
                    team.id,
                )
                .then(
                    () => null,
                    (error: {status_code?: number; server_error_id?: string}) => error,
                );

            // * The server refuses with its self-exclusion error, and the stored policy is unchanged
            expect(refused?.status_code).toBe(403);
            expect(refused?.server_error_id).toBe('app.pap.save_policy.self_exclusion');
            expect(await getStoredPolicyRuleExpressions(saved.id)).toEqual(stored);
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
        test.setTimeout(duration.one_min);
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

            const {app} = await pw.testBrowser.login(adminUser);
            await setAbacEnabled(app, true);

            // Try to create a policy containing a non-held value ("Delta") via direct API
            const statusWithDelta = await app.page.evaluate(
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
            const statusWithMasked = await app.page.evaluate(
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

            // # Switch to Advanced (CEL) mode
            await policy.switchModeButton.click();
            const {cel} = policy;
            await expect(cel.input).toContainText(fieldName);

            // * The editor is read-only: what's typed never lands (Monaco says so in place)
            // Monaco owns its native textbox; focus and type there to exercise the read-only editor.
            const editor = cel.input.locator.getByRole('textbox');
            await editor.press('End');
            await expect(editor).toBeFocused();
            await editor.type('xyz');
            await expect(cel.input).toContainText('Cannot edit in read-only editor');
            await expect(cel.input).toContainText(`user.attributes.${fieldName} in ["Alpha", "--------"]`);
            await expect(cel.input).not.toContainText('xyz');

            // * It explains why, and the access test is disabled
            await expect(cel.maskedAlert).toBeVisible();
            await expect(cel.testButton).toBeDisabled();

            // # Switch back to Simple mode
            await policy.switchModeButton.click();

            // * The masked chip is still there
            await expect(row.maskedImg).toBeVisible();
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

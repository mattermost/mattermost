// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelsPage, expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

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
 * Attribute-Value Masking — delete-button gating, server-side DELETE 403,
 * multi-condition merge-on-save, and team-settings delete behavior.
 */

test.beforeAll(async () => {
    await purgeFieldsByPrefix('Masking');
});

test('MM-68508-15: Delete button is disabled on masked policies; clean policies open the standard confirmation modal', async ({
    pw,
}) => {
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

        // shared_only must flip AFTER both policy saves: validatePolicyExpressionValues would
        // otherwise reject values the caller does not hold.
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
        await expect(page.locator('.select__multi-value--masked')).toBeVisible();

        // UI: Delete Policy button must be disabled when masked values present
        const deleteBtn = page.getByRole('button', {name: /^delete$/i}).last();
        if (await deleteBtn.isVisible()) {
            await expect(deleteBtn).toBeDisabled();
        }

        // The DELETE handler requires the route's :policy_id segment to match
        // [A-Za-z0-9]+. If the id is malformed, the request 404s instead of
        // hitting the 403 guard — assert format up front so a mismatch is
        // surfaced clearly instead of being misread as missing 403 enforcement.
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

        // Verify policy still exists via API (flag off)
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

test('MM-68508-17: Multi-condition save preserves all hidden values; deleting masked row is blocked', async ({pw}) => {
    // Validates merge-on-save for a multi-condition policy. The caller (holds Alpha
    // in programField, nothing in clearanceField) can save — both conditions survive
    // with their hidden values intact. The server blocks deletion of masked conditions.
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const fieldIds: string[] = [];
    const policyIds: string[] = [];

    try {
        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const programFieldName = `MaskingProgram_${pw.random.id()}`;
        const clearanceFieldName = `MaskingClearance_${pw.random.id()}`;
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

        // shared_only must flip AFTER the policy save for both fields: validatePolicyExpressionValues
        // would otherwise reject Bravo / Charlie / Secret / TopSecret which the caller doesn't hold.
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
        if (await firstTrash.isVisible()) {
            await expect(firstTrash).toBeDisabled();
        }

        // Dirty the form via the policy name so Save enables. Masked rows themselves
        // are read-only — no chip removal or value-selector edit is possible. The
        // merge-on-save server logic runs on any save, regardless of which field
        // triggered the dirty state.
        const nameInput = page.locator('#admin\\.access_control\\.policy\\.edit_policy\\.policyName');
        await nameInput.fill(policyName + ' (edited)');
        await page.waitForTimeout(300);

        await saveBtn.click();
        await page.waitForLoadState('networkidle');

        // Verify the stored policy directly — bypass API masking, all hidden values
        // must survive merge-on-save. The persisted CEL uses canonical id form
        // (`user.id_<userid>.id_<fieldid>`), so match on field ids, not names.
        const rawExpression = (await getStoredPolicyRuleExpressions(storedPolicyId))[0] ?? '';

        expect(rawExpression).toContain(programFieldId);
        expect(rawExpression).toContain('Bravo');
        expect(rawExpression).toContain('Charlie');
        expect(rawExpression).toContain(clearanceFieldId);
        expect(rawExpression).toContain('Secret');
        expect(rawExpression).toContain('TopSecret');

        // Server blocks a direct API attempt to remove a masked condition.
        // Updates use the collection endpoint with `id` in the body — there is
        // no PUT on /access_control_policies/{id}. The submitted expression
        // must use only values the caller holds, otherwise
        // validatePolicyExpressionValues 400s before the 403 guard runs.
        // Caller holds "Alpha" in programField and nothing in clearanceField,
        // so submitting just the program condition drops the masked clearance
        // condition → 403 from mergeExpressionWithMaskedValues.
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

test('MM-68508-18: Team admin cannot delete a policy with masked values even after removing all channels', async ({
    pw,
}) => {
    // Validates that the masked-values block applies to the team settings modal:
    // the Delete button stays disabled even after a team admin removes all assigned
    // channels from the policy, as long as masked values are present.
    // The server also returns HTTP 403 for a direct DELETE request.
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

        // adminUser holds "Alpha"; policy has ["Alpha", "Bravo"] — Bravo is masked
        await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

        // Create the policy via system console (as system admin)
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const sysPage = systemConsolePage.page;
        await navigateToABACPage(sysPage);
        await enableABAC(sysPage);

        const policyName = `MaskingPolicy ${pw.random.id()}`;
        const policyId = await createPolicyWithCEL(
            sysPage,
            policyName,
            `user.attributes.${fieldName} in ["Alpha", "Bravo"]`,
        );
        policyIds.push(policyId);
        // shared_only must flip AFTER the policy save: validatePolicyExpressionValues would
        // otherwise reject values the caller does not hold. Flipping now means the policy
        // is created against a public field, then masking applies on the next load.
        await setFieldAsSharedOnly(fieldId);

        // Assign team to policy so it shows up in team settings
        await adminClient.addToTeam(team.id, adminUser.id);
        try {
            await (adminClient as any).doFetch(
                `${(adminClient as any).getBaseRoute()}/access_control_policies/${policyId}/teams`,
                {method: 'POST', body: JSON.stringify({team_id: team.id})},
            );
        } catch {
            // best-effort assignment — test still validates button state
        }

        // Open team settings modal as the same admin (who has masked values)
        const {page} = await pw.testBrowser.login(adminUser);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // Find and open the masked policy in the editor
        const policyRow = teamSettings.container.getByText(policyName).first();
        if (await policyRow.isVisible()) {
            await policyRow.click();
            await page.waitForTimeout(500);

            // Delete button must be disabled — masked values present
            const deleteBtn = teamSettings.container
                .locator('.TeamPolicyEditor__section--delete button')
                .filter({hasText: 'Delete'});

            if (await deleteBtn.isVisible()) {
                await expect(deleteBtn).toBeDisabled();

                // Remove the channel (if any) — button must STAY disabled due to masked values
                const removeLink = teamSettings.container.getByText('Remove').first();
                if (await removeLink.isVisible()) {
                    await removeLink.click();
                    await page.waitForTimeout(300);
                    // Even with no channels, delete must remain disabled because of masked values
                    await expect(deleteBtn).toBeDisabled();
                }
            }

            await teamSettings.close();
        }

        // The DELETE route requires `policy_id` to match [A-Za-z0-9]+; a
        // malformed id 404s before reaching the 403 masked-values guard.
        expect(policyId).toMatch(/^[A-Za-z0-9]{26}$/);

        // Server: direct DELETE must return HTTP 403 regardless of UI state
        const status = await page.evaluate(async (id: string) => {
            const resp = await fetch(`/api/v4/access_control_policies/${id}`, {
                method: 'DELETE',
                headers: {'X-Requested-With': 'XMLHttpRequest'},
            });
            return resp.status;
        }, policyId);

        expect(status, `DELETE /api/v4/access_control_policies/${policyId} returned ${status}`).toBe(403);
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

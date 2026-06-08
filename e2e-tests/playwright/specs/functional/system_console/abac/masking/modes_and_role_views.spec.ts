// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelsPage, expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {
    assignChannelsToPolicy,
    createPrivateChannel,
    createTeamAdmin,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';
import {enableUserManagedAttributes} from '../support';

import {purgeFieldsByPrefix, setFieldAsSharedOnly, setFieldAsSourceOnly} from './masking_db_setup';
import {
    createMaskingMultiselectField,
    createMaskingTextField,
    createPolicyWithCEL,
    deleteCPAField,
    deletePolicy,
    disableMaskingFlag,
    enableMaskingFlag,
    ensureRoleHasPermission,
    openExistingPolicy,
    setUserAttribute,
} from './support';

/**
 * Attribute-Value Masking — Simple↔Advanced mode toggle stability, delegated
 * (team / channel) admin surfaces, hasAnyOf operator preservation through the
 * mask round-trip, and the channel members RHS attribute-tag filter.
 */

test.beforeAll(async () => {
    await purgeFieldsByPrefix('Masking');
});

test('MM-68508-19: Mode toggle Simple → Advanced → Simple preserves all masked-row restrictions', async ({pw}) => {
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

        // Banner must persist across the toggle (it lives in policy_details,
        // not the editor).
        await expect(banner).toBeVisible();
        // CEL editor visible
        await expect(page.locator('.monaco-editor').first()).toBeVisible();

        // --- Switch back to Simple mode ---
        const toSimple = page.getByRole('button', {name: /switch to simple mode/i});
        await toSimple.click();
        // Give TableEditor a beat to remount and re-fetch the AST. The
        // assertions below must hold *after* the remount completes — that
        // window is exactly where the pre-fix race lived.
        await page.waitForTimeout(1500);

        // Banner must STILL be visible.
        await expect(banner).toBeVisible();
        // Masked chip must STILL be visible.
        await expect(maskedChip.first()).toBeVisible();
        // Delete button must STILL be disabled.
        await expect(deleteBtn).toBeDisabled();
        // Value selector on the masked row must be disabled (no edits to
        // values the caller couldn't see).
        const valueSelector = page.locator('[data-testid="valueSelectorMenuButton"]').first();
        if (await valueSelector.isVisible()) {
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

test('MM-68508-20: Team admin (non-sysadmin) sees the same masking as a system admin in team settings', async ({
    pw,
}) => {
    // Role-neutrality across roles: a delegated team admin (granted
    // PermissionManageTeamAccessRules by their team_admin role, but NOT
    // PermissionManageSystem) must see masking in the team-settings access
    // policy editor. The masked-values guard MUST apply at this surface too:
    // controls locked, Delete disabled, server 403 on direct DELETE.
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();
    const fieldIds: string[] = [];
    const policyIds: string[] = [];

    try {
        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);
        // The team_admin role's stored permissions on this server can lag the
        // model defaults — without manage_team_access_rules the Membership
        // Policies tab is hidden from the team settings modal and this test
        // fails before the masking assertions run.
        await ensureRoleHasPermission(adminClient, 'team_admin', 'manage_team_access_rules');

        const teamAdmin = await createTeamAdmin(adminClient, team.id);

        const fieldName = `MaskingProgram_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);
        await setUserAttribute(adminClient, teamAdmin.id, fieldId, 'Alpha');

        const channel = await createPrivateChannel(adminClient, team.id);
        await adminClient.addToChannel(teamAdmin.id, channel.id);

        // Sysadmin enables ABAC via the UI (required to activate the PAP),
        // then creates a parent policy and assigns only channels from the
        // team administered by `teamAdmin`. The assigned private channel makes
        // SearchTeamAccessPolicies enforce self-inclusion, which `teamAdmin`
        // satisfies because they hold Alpha.
        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        const sysPage = systemConsolePage.page;
        await navigateToABACPage(sysPage);
        await enableABAC(sysPage);
        const policyName = `MaskingPolicy ${pw.random.id()}`;
        const policyExpression = `user.attributes.${fieldName} in ["Alpha", "Bravo"]`;
        const policyResp = await (adminClient as any).doFetch(
            `${(adminClient as any).getBaseRoute()}/access_control_policies`,
            {
                method: 'PUT',
                body: JSON.stringify({
                    name: policyName,
                    type: 'parent',
                    version: 'v0.3',
                    revision: 1,
                    rules: [
                        {
                            actions: ['membership'],
                            expression: policyExpression,
                        },
                    ],
                }),
            },
        );
        const policyId = policyResp.id as string;
        policyIds.push(policyId);
        await assignChannelsToPolicy(adminClient, policyId, [channel.id]);
        await waitForAttributeViewToInclude(adminClient, policyExpression, [teamAdmin.id]);

        await setFieldAsSharedOnly(fieldId);

        // Log in AS THE TEAM ADMIN (not the sysadmin).
        const {page} = await pw.testBrowser.login(teamAdmin);
        const channelsPage = new ChannelsPage(page);
        await channelsPage.goto(team.name);
        await channelsPage.toBeVisible();

        const teamSettings = await channelsPage.openTeamSettings();
        await teamSettings.openAccessPoliciesTab();

        // The policy is team-scoped through its single-team channel
        // assignment, and `teamAdmin` satisfies its rule, so it MUST appear in
        // the team-admin policy list. Search by the unique name because the
        // list is paginated and prior tests can leave more than one page of
        // MaskingPolicy rows.
        const searchInput = teamSettings.container.locator('[data-testid="searchInput"]').first();
        await expect(searchInput).toBeVisible();
        const searchResponse = page.waitForResponse(
            (resp) =>
                /\/api\/v4\/access_control_policies\/search$/.test(resp.url()) &&
                resp.request().method() === 'POST' &&
                Boolean(resp.request().postData()?.includes(policyName)) &&
                resp.ok(),
        );
        await searchInput.fill(policyName);
        await searchResponse.catch(() => {
            // Debounced search can occasionally settle from cached data; the
            // row assertion below is the source of truth.
        });
        await page.waitForLoadState('networkidle');

        const policyRow = teamSettings.container.getByText(policyName).first();
        await expect(policyRow).toBeVisible();
        await policyRow.click();
        await page.waitForTimeout(500);

        // Masking surfaces in the team-policy editor exactly as in the
        // system console — masked chip visible, Delete disabled.
        await expect(teamSettings.container.locator('.select__multi-value--masked').first()).toBeVisible({
            timeout: 5000,
        });

        const deleteBtn = teamSettings.container
            .locator('.TeamPolicyEditor__section--delete button')
            .filter({hasText: 'Delete'});
        await expect(deleteBtn).toBeVisible();
        await expect(deleteBtn).toBeDisabled();

        await teamSettings.close();

        // Server enforces the same 403 regardless of which admin role
        // initiated the delete. team_id is required in the URL because the
        // team-admin permission path scopes by team.
        expect(policyId).toMatch(/^[A-Za-z0-9]{26}$/);
        const status = await page.evaluate(
            async ({id, teamId}: {id: string; teamId: string}) => {
                const resp = await fetch(`/api/v4/access_control_policies/${id}?team_id=${teamId}`, {
                    method: 'DELETE',
                    headers: {'X-Requested-With': 'XMLHttpRequest'},
                });
                return resp.status;
            },
            {id: policyId, teamId: team.id},
        );
        expect(status, `DELETE as team admin returned ${status}`).toBe(403);
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

test('MM-68508-21: Channel admin (non-sysadmin) sees the same masking as a system admin in channel settings', async ({
    pw,
}) => {
    // Role-neutrality for the channel-admin surface: a user with
    // PermissionManageChannelAccessRules (via channel_admin role) on a
    // private channel must see masking inside the Membership Policy tab of
    // the channel settings modal. Channel admins never see the system
    // console — this is the only surface where they touch policy values.
    await pw.skipIfNoLicense();

    // adminClient is the sysadmin REST handle used to seed the channel-level
    // policy directly; the channel admin (user) drives the UI assertions.
    const {adminClient, user, team} = await pw.initSetup();
    const fieldIds: string[] = [];
    const policyIds: string[] = [];

    try {
        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);
        // Same caveat as test 20: the channel_admin role on this server may
        // be missing manage_channel_access_rules, which hides the Membership
        // Policy tab in the channel settings modal.
        await ensureRoleHasPermission(adminClient, 'channel_admin', 'manage_channel_access_rules');

        // The Membership Policy tab requires a private channel that the
        // caller has channel-admin permission over.
        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `mp-${pw.random.id()}`.toLowerCase(),
            display_name: `Masked Policy Channel ${pw.random.id()}`,
            type: 'P',
            purpose: '',
            header: '',
        } as any);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.updateChannelMemberRoles(channel.id, user.id, 'channel_user channel_admin');

        const fieldName = `MaskingProgram_${pw.random.id()}`;
        const fieldId = await createMaskingTextField(adminClient, fieldName);
        fieldIds.push(fieldId);
        await setUserAttribute(adminClient, user.id, fieldId, 'Alpha');

        // Sysadmin authors a CHANNEL-level policy directly (id === channel.id,
        // type === "channel"). The channel settings access-rules tab renders
        // this via getAccessControlPolicy(channelId) — which goes through the
        // same MaskPolicyExpressions read-path masking as everything else.
        // Parent policies assigned to a channel would only surface in the
        // SystemPolicyIndicator (read-only), not in the editable TableEditor
        // where the masked chips render.
        const channelPolicyResp = await (adminClient as any).doFetch(
            `${(adminClient as any).getBaseRoute()}/access_control_policies`,
            {
                method: 'PUT',
                body: JSON.stringify({
                    id: channel.id,
                    type: 'channel',
                    version: 'v0.3',
                    revision: 1,
                    rules: [
                        {actions: ['membership'], expression: `user.attributes.${fieldName} in ["Alpha", "Bravo"]`},
                    ],
                }),
            },
        );
        const policyId = (channelPolicyResp?.id ?? channel.id) as string;
        policyIds.push(policyId);

        await setFieldAsSharedOnly(fieldId);

        // Log in AS THE CHANNEL ADMIN (not the sysadmin).
        const {page} = await pw.testBrowser.login(user);
        const channelsPage = new ChannelsPage(page);
        await page.goto(`/${team.name}/channels/${channel.name}`);
        await channelsPage.toBeVisible();

        // Open channel settings via the lib helper so we don't depend on
        // hand-rolled header selectors. The Membership Policy tab is gated
        // by canManageChannelAccessRules — channel_admin has it.
        const channelSettings = await channelsPage.openChannelSettings();
        const membershipPolicyTab = channelSettings.container.getByRole('tab', {name: /membership policy/i});
        await membershipPolicyTab.waitFor({state: 'visible', timeout: 10000});
        await membershipPolicyTab.click();
        // The tab loads via getChannelPolicy → server returns the masked
        // view (FF on). Allow time for the AST round-trip to render chips.
        await page.waitForTimeout(1500);

        // Same masking primitives as every other surface — the TableEditor
        // underneath is the same component.
        await expect(channelSettings.container.locator('.select__multi-value--masked').first()).toBeVisible({
            timeout: 10000,
        });

        // Server-side guard: direct DELETE by the channel admin must 403,
        // matching the team-admin and sysadmin paths and proving no role
        // bypasses the masked-values protection.
        expect(policyId).toMatch(/^[A-Za-z0-9]{26}$/);
        const status = await page.evaluate(async (id: string) => {
            const resp = await fetch(`/api/v4/access_control_policies/${id}`, {
                method: 'DELETE',
                headers: {'X-Requested-With': 'XMLHttpRequest'},
            });
            return resp.status;
        }, policyId);
        expect(status, `DELETE as channel admin returned ${status}`).toBe(403);
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
    await pw.skipIfNoLicense();

    const {adminUser, adminClient} = await pw.initSetup();
    const fieldIds: string[] = [];
    const policyIds: string[] = [];

    try {
        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const fieldName = `MaskingTeam_${pw.random.id()}`;
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

        // Flip to shared_only AFTER saving so the initial save is not rejected.
        await setFieldAsSharedOnly(fieldId);

        await openExistingPolicy(page, policyName);

        // Only the masked chip is visible — caller holds no values.
        await expect(page.locator('.select__multi-value--masked')).toBeVisible();
        await expect(page.locator('.select__multi-value').filter({hasText: 'Alpha'})).not.toBeVisible();
        await expect(page.locator('.select__multi-value').filter({hasText: 'Bravo'})).not.toBeVisible();

        // The operator selector on the masked row must show "has any of", NOT "has all of".
        // Before the fix, the masked expression re-parsed as hasAllOf and the wrong label appeared.
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

test('MM-68508-23: source_only and shared_only fields are filtered from the channel members RHS attribute tags', async ({
    pw,
}) => {
    // Validates that the /attributes endpoint strips source_only and shared_only
    // fields before they reach the channel members RHS panel. A public field in
    // the same policy must still appear so we confirm the filter is selective.
    await pw.skipIfNoLicense();

    const {adminUser, adminClient, team} = await pw.initSetup();
    const fieldIds: string[] = [];
    const policyIds: string[] = [];

    try {
        await enableUserManagedAttributes(adminClient);
        await enableMaskingFlag(adminClient);

        const id = pw.random.id();
        const publicFieldName = `MaskingPublic_${id}`;
        const sharedFieldName = `MaskingShared_${id}`;
        const sourceFieldName = `MaskingSource_${id}`;

        // Create all three fields as public first — the API rejects protected
        // access modes (source_only / shared_only) without a source_plugin_id,
        // so we flip them via direct DB writes after creation.
        const publicFieldId = await createMaskingTextField(adminClient, publicFieldName);
        const sharedFieldId = await createMaskingTextField(adminClient, sharedFieldName);
        const sourceFieldId = await createMaskingTextField(adminClient, sourceFieldName);
        fieldIds.push(publicFieldId, sharedFieldId, sourceFieldId);

        // Give the admin user a value for every field so the self-inclusion
        // check passes when the policy is saved.
        await setUserAttribute(adminClient, adminUser.id, publicFieldId, 'Alpha');
        await setUserAttribute(adminClient, adminUser.id, sharedFieldId, 'Beta');
        await setUserAttribute(adminClient, adminUser.id, sourceFieldId, 'Gamma');

        const {channelsPage, page} = await pw.testBrowser.login(adminUser);
        await navigateToABACPage(page);
        await enableABAC(page);

        const policyName = `MaskingPolicy ${pw.random.id()}`;
        const policyId = await createPolicyWithCEL(
            page,
            policyName,
            `user.attributes.${publicFieldName} in ["Alpha"] && user.attributes.${sharedFieldName} in ["Beta"] && user.attributes.${sourceFieldName} in ["Gamma"]`,
        );
        policyIds.push(policyId);

        // Flip access modes AFTER saving — same pattern as other masking tests.
        // The policy save runs validatePolicyExpressionValues, which would reject
        // values the caller does not hold if the field were already shared_only/
        // source_only at save time.
        await setFieldAsSharedOnly(sharedFieldId);
        await setFieldAsSourceOnly(sourceFieldId);

        // Create a private channel and attach the policy.
        const channel = await createPrivateChannel(adminClient, team.id);
        await assignChannelsToPolicy(adminClient, policyId, [channel.id]);

        // Navigate to the channel.
        await channelsPage.goto(team.name, channel.name);
        await channelsPage.toBeVisible();

        // The enforcement cache is cold on the first request — the hook fetch
        // returns {} and the RHS renders no tags. Open the RHS, check; if the
        // public-field tag is not yet visible, reload and retry. The first
        // /attributes request from the browser warms the cache so subsequent
        // fetches return the correctly-filtered attribute set.
        const alertContainer = page.locator('.channel-members-rhs__alert-container.policy-enforced');
        let publicTagVisible = false;
        for (let attempt = 0; attempt < 6; attempt++) {
            if (attempt > 0) {
                await page.keyboard.press('Escape');
                await page.waitForTimeout(3000);
                await page.reload();
                await channelsPage.toBeVisible();
            }

            await channelsPage.centerView.header.openChannelMenu();
            await page.locator('#channelMembers').click();
            await channelsPage.sidebarRight.toBeVisible();

            try {
                await alertContainer.waitFor({state: 'visible', timeout: 10000});
                publicTagVisible = await alertContainer.getByText(/:\s*Alpha/).isVisible();
                if (publicTagVisible) {
                    break;
                }
            } catch {
                // alert container not yet visible, retry
            }
        }

        // The tag text is formatted as "${AttributeLabel}: ${value}" where AttributeLabel
        // is the result of formatAttributeName() — field names with underscores and mixed
        // case are split and title-cased. Assert on the attribute VALUE to avoid coupling
        // to the formatting logic.
        //
        // Public field (value "Alpha") MUST be visible.
        await expect(alertContainer.getByText(/:\s*Alpha/)).toBeVisible();

        // shared_only (value "Beta") and source_only (value "Gamma") must NOT appear.
        await expect(alertContainer.getByText(/:\s*Beta/)).not.toBeVisible();
        await expect(alertContainer.getByText(/:\s*Gamma/)).not.toBeVisible();
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

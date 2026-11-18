// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    closeChannelSettings,
    expect,
    openChannel,
    openChannelSettings,
    test,
    type App,
    duration,
} from '@mattermost/playwright-lib';

import {
    assignChannelsToPolicy,
    createPrivateChannel,
    createTeamAdmin,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';
import {closeTeamSettings, openAccessPoliciesTab} from '../../../channels/team_settings/surface';
import {assignTeamsToPolicy} from '../teams/helpers';
import {enableUserManagedAttributes} from '../support';
import {setAbacEnabled} from '../surface';

import {
    createMaskingTextField,
    createPolicyWithCEL,
    deleteCPAField,
    deletePolicy,
    disableMaskingFlag,
    enableMaskingFlag,
    setUserAttribute,
} from './masking_helpers';
import {deleteFieldFromDB, purgeFieldsByPrefix, setFieldAsSharedOnly, setFieldAsSourceOnly} from './masking_db_setup';

const fieldPrefix = 'MaskingAR';

/** Opens Team Settings > Membership Policies and a policy's editor from the list (searching for it first). */
async function openTeamPolicy(app: App, policy: {id: string; name: string}) {
    const settings = await openAccessPoliciesTab(app);
    const {policies, editor} = settings.accessPolicies;

    // the list loads its first page on open, and that response can replace a search's results
    await expect(await policies.rowList.first()).toBeVisible();
    await expect(policies.searchTextbox).toBeVisible();
    await policies.searchTextbox.fill(policy.name);
    await expect(policies.row(policy.id)).toBeVisible();
    // The DataGrid name cell opens the editor but has no operable role or click driver.
    await policies.row(policy.id).cell('name').click();
    await expect(editor.name.container).toHaveValue(policy.name);
    return {settings, editor};
}

test.describe('Attribute-Value Masking - Admin Roles', {tag: ['@abac', '@abac_masking']}, () => {
    test.beforeAll(async () => {
        await purgeFieldsByPrefix(fieldPrefix);
    });

    test('MM-68508-18: Team admin cannot delete a policy with masked values even after removing all channels', async ({
        pw,
    }) => {
        // Validates that the masked-values block applies to the team settings modal:
        // the Delete button stays disabled even after a team admin removes all assigned
        // channels from the policy, as long as masked values are present.
        // The server also returns HTTP 403 for a direct DELETE request.
        test.setTimeout(duration.four_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team, townSquare} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);

            // adminUser holds "Alpha"; policy has ["Alpha", "Bravo"] — Bravo is masked
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

            const {app: consoleApp} = await pw.testBrowser.login(adminUser);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                consoleApp,
                adminClient,
                policyName,
                `user.attributes.${fieldName} in ["Alpha", "Bravo"]`,
            );
            policyIds.push(policyId);

            // Assign channel first so the attribute view can be primed before
            // we flip the field to shared_only (self-inclusion filter in
            // SearchTeamAccessPolicies requires the view to be current).
            await adminClient.addToTeam(team.id, adminUser.id);
            const channel = await createPrivateChannel(adminClient, team.id);
            await assignChannelsToPolicy(adminClient, policyId, [channel.id]);
            await waitForAttributeViewToInclude(adminClient, `user.attributes.${fieldName} in ["Alpha", "Bravo"]`, [
                adminUser.id,
            ]);
            await setFieldAsSharedOnly(fieldId);
            await assignTeamsToPolicy(adminClient, policyId, [team.id]);

            const app = await openChannel(pw, adminUser, {team, channel: townSquare});
            const {settings, editor} = await openTeamPolicy(app, {id: policyId, name: policyName});

            // * The policy's masked values make Delete unavailable
            await expect(editor.rules.row(0).maskedImg).toBeVisible();
            await expect(editor.deleteButton).toBeVisible();
            await expect(editor.deleteButton).toBeDisabled();

            // # Remove the channel
            const channelRow = editor.channels.row(channel.id);
            await channelRow.removeLink.click();
            await expect(channelRow).toHaveCount(0);

            // * Delete stays disabled, because of the masked values
            await expect(editor.deleteButton).toBeDisabled();

            await closeTeamSettings(settings);

            // * Server: a direct DELETE returns HTTP 403 regardless of UI state
            const status = await app.page.evaluate(async (id: string) => {
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
                } catch {
                    // Protected/shared-only/source-only fields reject the API delete; fall back to DB.
                    await deleteFieldFromDB(id).catch(() => {});
                }
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
        test.setTimeout(duration.four_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team, townSquare} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

            const teamAdmin = await createTeamAdmin(adminClient, team.id);

            const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, teamAdmin.id, fieldId, 'Alpha');

            const channel = await createPrivateChannel(adminClient, team.id);
            await adminClient.addToChannel(teamAdmin.id, channel.id);

            const {app: consoleApp} = await pw.testBrowser.login(adminUser);
            await setAbacEnabled(consoleApp, true);
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

            // # Log in AS THE TEAM ADMIN (not the sysadmin) and open the policy in Team Settings
            const app = await openChannel(pw, teamAdmin, {team, channel: townSquare});
            const {settings, editor} = await openTeamPolicy(app, {id: policyId, name: policyName});

            // * Masking surfaces in the team-policy editor exactly as in the System Console, and Delete is disabled
            await expect(editor.rules.row(0).maskedImg).toBeVisible();
            await expect(editor.deleteButton).toBeVisible();
            await expect(editor.deleteButton).toBeDisabled();

            await closeTeamSettings(settings);

            // * Server: a direct DELETE as the team admin returns 403
            const status = await app.page.evaluate(
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
                } catch {
                    // Protected/shared-only/source-only fields reject the API delete; fall back to DB.
                    await deleteFieldFromDB(id).catch(() => {});
                }
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
        // the channel settings modal.
        test.setTimeout(duration.four_min);
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
            await enableMaskingFlag(adminClient);

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

            const fieldName = `${fieldPrefix}Prog_${pw.random.id()}`;
            const fieldId = await createMaskingTextField(adminClient, fieldName);
            fieldIds.push(fieldId);
            await setUserAttribute(adminClient, user.id, fieldId, 'Alpha');

            // Sysadmin authors a CHANNEL-level policy directly
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

            // # Log in AS THE CHANNEL ADMIN (not the sysadmin) and open the channel's membership policy
            const app = await openChannel(pw, user, {team, channel});
            const settings = await openChannelSettings(app, 'access_rules');

            // * The masked chip shows there too
            await expect(settings.accessRules.rules.row(0).maskedImg).toBeVisible();
            await closeChannelSettings(settings);

            // * Server-side guard: a direct DELETE by the channel admin returns 403
            expect(policyId).toMatch(/^[A-Za-z0-9]{26}$/);
            const status = await app.page.evaluate(async (id: string) => {
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
                } catch {
                    // Protected/shared-only/source-only fields reject the API delete; fall back to DB.
                    await deleteFieldFromDB(id).catch(() => {});
                }
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
        test.setTimeout(duration.two_min);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);

            // The tags only render when the channel policy indicators are on, which is off by default
            await adminClient.patchConfig({AccessControlSettings: {EnableChannelPolicyIndicators: true}} as any);
            await enableMaskingFlag(adminClient);

            const id = pw.random.id();
            const publicFieldName = `${fieldPrefix}Pub_${id}`;
            const sharedFieldName = `${fieldPrefix}Sh_${id}`;
            const sourceFieldName = `${fieldPrefix}Src_${id}`;

            // Create all three fields as public first — the API rejects protected
            // access modes without a source_plugin_id, so we flip them via DB after creation.
            const publicFieldId = await createMaskingTextField(adminClient, publicFieldName);
            const sharedFieldId = await createMaskingTextField(adminClient, sharedFieldName);
            const sourceFieldId = await createMaskingTextField(adminClient, sourceFieldName);
            fieldIds.push(publicFieldId, sharedFieldId, sourceFieldId);

            await setUserAttribute(adminClient, adminUser.id, publicFieldId, 'Alpha');
            await setUserAttribute(adminClient, adminUser.id, sharedFieldId, 'Beta');
            await setUserAttribute(adminClient, adminUser.id, sourceFieldId, 'Gamma');

            const {app: consoleApp} = await pw.testBrowser.login(adminUser);

            const policyName = `MaskingPolicy ${pw.random.id()}`;
            const policyId = await createPolicyWithCEL(
                consoleApp,
                adminClient,
                policyName,
                `user.attributes.${publicFieldName} in ["Alpha"] && user.attributes.${sharedFieldName} in ["Beta"] && user.attributes.${sourceFieldName} in ["Gamma"]`,
            );
            policyIds.push(policyId);

            await setFieldAsSharedOnly(sharedFieldId);
            await setFieldAsSourceOnly(sourceFieldId);

            const channel = await createPrivateChannel(adminClient, team.id);
            await assignChannelsToPolicy(adminClient, policyId, [channel.id]);

            // # Wait until the server's answer for the channel holds the public field's value: the policy's
            // enforcement cache is cold on the first request. The webapp keeps its first answer for five minutes, so
            // the panel opens only after that.
            await expect
                .poll(async () => (await adminClient.getChannelAccessControlAttributes(channel.id))[publicFieldName], {
                    message: `the channel's access control attributes never listed ${publicFieldName}`,
                    timeout: pw.duration.one_min,
                })
                .toContain('Alpha');

            // # Open the channel's members panel, once
            const app = await openChannel(pw, adminUser, {team, channel});
            const {policy} = app.rhs.channelMembers;
            await app.channelHeader.membersButton.click();
            await expect(app.rhs.channelMembers.container).toBeVisible();
            await expect(await policy.tagList.itemWith({text: 'Alpha'})).toBeVisible();

            // * The public field's value shows; the shared_only and source_only ones don't
            await expect(policy).toContainText('Alpha');
            await expect(policy).not.toContainText('Beta');
            await expect(policy).not.toContainText('Gamma');
        } finally {
            for (const id of policyIds) {
                try {
                    await deletePolicy(adminClient, id);
                } catch {} // eslint-disable-line no-empty
            }
            for (const id of fieldIds) {
                try {
                    await deleteCPAField(adminClient, id);
                } catch {
                    // Protected/shared-only/source-only fields reject the API delete; fall back to DB.
                    await deleteFieldFromDB(id).catch(() => {});
                }
            }
            try {
                await disableMaskingFlag(adminClient);
            } catch {} // eslint-disable-line no-empty
        }
    });
});

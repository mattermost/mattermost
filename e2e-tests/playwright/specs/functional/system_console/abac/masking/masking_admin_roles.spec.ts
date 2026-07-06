// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelsPage, expect, test, enableABAC, navigateToABACPage} from '@mattermost/playwright-lib';

import {
    assignChannelsToPolicy,
    createPrivateChannel,
    createTeamAdmin,
    waitForAttributeViewToInclude,
} from '../../../channels/team_settings/helpers';
import {assignTeamsToPolicy} from '../teams/helpers';
import {enableUserManagedAttributes} from '../support';

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
        test.setTimeout(150000);
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

            // adminUser holds "Alpha"; policy has ["Alpha", "Bravo"] — Bravo is masked
            await setUserAttribute(adminClient, adminUser.id, fieldId, 'Alpha');

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

            const {page} = await pw.testBrowser.login(adminUser);
            const channelsPage = new ChannelsPage(page);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const teamSettings = await channelsPage.openTeamSettings();
            await teamSettings.openAccessPoliciesTab();

            const policyRow = teamSettings.container.getByText(policyName).first();
            await expect(policyRow).toBeVisible({timeout: 10000});
            await policyRow.click();
            await page.waitForTimeout(500);

            const deleteBtn = teamSettings.container
                .locator('.TeamPolicyEditor__section--delete button')
                .filter({hasText: 'Delete'});

            await expect(deleteBtn).toBeVisible({timeout: 3000});
            await expect(deleteBtn).toBeDisabled();

            // Remove the channel — button must STAY disabled due to masked values
            const removeLink = teamSettings.container.getByText('Remove').first();
            await expect(removeLink).toBeVisible({timeout: 5000});
            await removeLink.click();
            await page.waitForTimeout(300);
            await expect(deleteBtn).toBeDisabled();

            await teamSettings.close();

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
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
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

            // Log in AS THE TEAM ADMIN (not the sysadmin)
            const {page} = await pw.testBrowser.login(teamAdmin);
            const channelsPage = new ChannelsPage(page);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const teamSettings = await channelsPage.openTeamSettings();
            await teamSettings.openAccessPoliciesTab();

            const searchInput = teamSettings.container.locator('[data-testid="searchInput"]').first();
            await expect(searchInput).toBeVisible({timeout: 10000});
            const searchResponse = page.waitForResponse(
                (resp) =>
                    /\/api\/v4\/access_control_policies\/search$/.test(resp.url()) &&
                    resp.request().method() === 'POST' &&
                    Boolean(resp.request().postData()?.includes(policyName)) &&
                    resp.ok(),
                {timeout: 15000},
            );
            await searchInput.fill(policyName);
            await searchResponse.catch(() => {
                // debounced search can occasionally settle from cached data
            });
            await page.waitForLoadState('networkidle');

            const policyRow = teamSettings.container.getByText(policyName).first();
            await expect(policyRow).toBeVisible({timeout: 10000});
            await policyRow.click();
            await page.waitForTimeout(500);

            // Masking surfaces in the team-policy editor exactly as in the system console
            await expect(teamSettings.container.locator('.select__multi-value--masked').first()).toBeVisible({
                timeout: 5000,
            });

            const deleteBtn = teamSettings.container
                .locator('.TeamPolicyEditor__section--delete button')
                .filter({hasText: 'Delete'});
            await expect(deleteBtn).toBeVisible({timeout: 5000});
            await expect(deleteBtn).toBeDisabled();

            await teamSettings.close();

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
        test.setTimeout(180000);
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

            // Log in AS THE CHANNEL ADMIN (not the sysadmin)
            const {page} = await pw.testBrowser.login(user);
            const channelsPage = new ChannelsPage(page);
            await page.goto(`/${team.name}/channels/${channel.name}`);
            await channelsPage.toBeVisible();

            const channelSettings = await channelsPage.openChannelSettings();
            const membershipPolicyTab = channelSettings.container.getByRole('tab', {name: /membership policy/i});
            await membershipPolicyTab.waitFor({state: 'visible', timeout: 10000});
            await membershipPolicyTab.click();
            await page.waitForTimeout(1500);

            await expect(channelSettings.container.locator('.select__multi-value--masked').first()).toBeVisible({
                timeout: 10000,
            });

            // Server-side guard: direct DELETE by the channel admin must 403
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
        test.setTimeout(120000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, team} = await pw.initSetup();
        const fieldIds: string[] = [];
        const policyIds: string[] = [];

        try {
            await enableUserManagedAttributes(adminClient);
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

            await setFieldAsSharedOnly(sharedFieldId);
            await setFieldAsSourceOnly(sourceFieldId);

            const channel = await createPrivateChannel(adminClient, team.id);
            await assignChannelsToPolicy(adminClient, policyId, [channel.id]);

            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // The enforcement cache is cold on the first request — retry until the
            // public-field tag is visible (up to 6 attempts with reload).
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

            // Public field (value "Alpha") MUST be visible
            await expect(alertContainer.getByText(/:\s*Alpha/)).toBeVisible({timeout: 5000});

            // shared_only (value "Beta") and source_only (value "Gamma") must NOT appear
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

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelsPage, expect, test, enableABAC} from '@mattermost/playwright-lib';

import {
    activatePolicy,
    createPermissionPolicy,
    deletePermissionPolicyByName,
    ensureUserAttributes,
    getPolicyIdByName,
} from '../support';

/**
 * Channel policy administration requires channel write access.
 *
 * Editing a channel's Membership Policy or Permissions Policy is a write to the channel,
 * so a policy denying channel_write_access must stop a channel admin from doing it — both
 * in Channel Settings and through the API directly.
 *
 * The tabs stay visible and read-only rather than disappearing: every tab in the modal is
 * gated on a permission the write gate covers, so hiding them left the modal empty.
 *
 * The server gate exempts manage_system so a policy that denies a channel's own admins
 * stays repairable: the System Console channel-level access rules page is that repair
 * path. The modal is read-only for a denied system admin too, so the exemption is an API
 * escape hatch rather than a visible affordance.
 *
 * Note: the permission policy created here is system-scoped, so while it is active it
 * governs channel_write_access everywhere. It is deleted in `finally`.
 */

async function channelAccessABACPermissionEnabled(adminClient: any): Promise<boolean> {
    const config = await adminClient.getConfig();
    const on = (value: unknown) => value === true || value === 'true';
    return on(config.FeatureFlags?.PermissionPolicies) && on(config.FeatureFlags?.ChannelAccessABACPermission);
}

test.describe('Channel policy administration - channel_write_access', {tag: ['@abac', '@abac_permission_policies']}, () => {
    test('a channel admin denied channel_write_access sees the policy tabs read-only', async ({pw}) => {
        test.setTimeout(180000);
        await pw.skipIfNoLicense();

        const {adminUser, adminClient, user, team} = await pw.initSetup();

        // The flag is off by default and is environment-supplied, not test-supplied.
        test.skip(
            !(await channelAccessABACPermissionEnabled(adminClient)),
            'requires the PermissionPolicies and ChannelAccessABACPermission feature flags',
        );

        await ensureUserAttributes(adminClient);

        const channel = await adminClient.createChannel({
            team_id: team.id,
            name: `cwa-${pw.random.id()}`.toLowerCase(),
            display_name: `Channel Write Access ${pw.random.id()}`,
            type: 'P',
            purpose: '',
            header: '',
        } as any);
        await adminClient.addToChannel(user.id, channel.id);
        await adminClient.updateChannelMemberRoles(channel.id, user.id, 'channel_user channel_admin');

        const {systemConsolePage} = await pw.testBrowser.login(adminUser);
        await enableABAC(systemConsolePage.page);
        await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});

        const policyName = `PP Write Deny ${pw.random.id()}`;
        try {
            // # The channel admin holds no Department value, so this rule denies them.
            await createPermissionPolicy(systemConsolePage.page, {
                name: policyName,
                celExpression: 'user.attributes.Department == "NoSuchDepartment"',
                permissions: ['Channel Write Access'],
                adminClient,
            });

            const policyId = await getPolicyIdByName(adminClient, policyName);
            expect(policyId).toBeTruthy();
            await activatePolicy(adminClient, policyId!);

            // # Log in as the channel admin, not the system admin
            const {page} = await pw.testBrowser.login(user);
            const channelsPage = new ChannelsPage(page);
            await page.goto(`/${team.name}/channels/${channel.name}`);
            await channelsPage.toBeVisible();

            const channelSettings = await channelsPage.openChannelSettings();

            // * Both policy tabs stay available — hiding them would empty the modal
            const membershipPolicyTab = channelSettings.container.getByRole('tab', {name: /membership policy/i});
            const permissionsPolicyTab = channelSettings.container.getByRole('tab', {name: /permissions policy/i});
            await expect(membershipPolicyTab).toBeVisible();
            await expect(permissionsPolicyTab).toBeVisible();

            // * ... and the reason editing is off is stated rather than implied
            await expect(channelSettings.container.getByText('Editing is restricted')).toBeVisible();

            // * The Permissions Policy tab offers no way to add or change a rule
            await permissionsPolicyTab.click();
            await expect(channelSettings.container.getByTestId('permissions-policy-add-rule')).toBeDisabled();

            // * The server refuses the save even when the request skips the UI
            const channelAdminStatus = await page.evaluate(async (channelId: string) => {
                const resp = await fetch('/api/v4/access_control_policies', {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest'},
                    body: JSON.stringify({
                        id: channelId,
                        type: 'channel',
                        version: 'v0.3',
                        revision: 1,
                        rules: [{actions: ['membership'], expression: 'true'}],
                    }),
                });
                return resp.status;
            }, channel.id);
            expect(channelAdminStatus).toBe(403);

            // * The system admin keeps the repair path the exemption exists for
            const repaired = await (adminClient as any).doFetch(
                `${(adminClient as any).getBaseRoute()}/access_control_policies`,
                {
                    method: 'PUT',
                    body: JSON.stringify({
                        id: channel.id,
                        type: 'channel',
                        version: 'v0.3',
                        revision: 1,
                        rules: [{actions: ['membership'], expression: 'true'}],
                    }),
                },
            );
            expect(repaired?.id).toBe(channel.id);
        } finally {
            await deletePermissionPolicyByName(adminClient, policyName);
        }
    });
});

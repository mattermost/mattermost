// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {ChannelsPage, expect, test, enableABAC} from '@mattermost/playwright-lib';

import {
    activatePolicy,
    createPermissionPolicy,
    deletePermissionPolicyByName,
    ensureUserAttributes,
    getPolicyIdByName,
} from '../support';

async function findPolicyByExactName(client: Client4, policyName: string): Promise<string | null> {
    const result = await (client as any).doFetch(`${(client as any).getBaseRoute()}/access_control_policies/search`, {
        method: 'POST',
        body: JSON.stringify({term: policyName, type: 'permission'}),
    });
    const policies: any[] = Array.isArray(result) ? result : result?.policies || [];
    return policies.find((policy: any) => policy.name === policyName)?.id ?? null;
}

test.describe(
    'Channel policy administration - channel access actions',
    {tag: ['@abac', '@abac_permission_policies']},
    () => {
        let createdPolicyName = '';
        let createdPolicyClient: Client4 | null = null;

        test.afterEach(async () => {
            if (!createdPolicyName || !createdPolicyClient) {
                return;
            }

            const client = createdPolicyClient;
            const policyName = createdPolicyName;
            createdPolicyName = '';
            createdPolicyClient = null;

            await deletePermissionPolicyByName(client, policyName);

            expect(
                await findPolicyByExactName(client, policyName),
                `leaked the system-scoped policy "${policyName}"; later tests in this shard would lose channel access`,
            ).toBeNull();
        });

        test('a channel admin denied channel_write_access sees the policy tabs read-only', async ({pw}) => {
            test.setTimeout(180000);
            await pw.skipIfNoLicense();

            await pw.skipIfFeatureFlagNotSet('PermissionPolicies', true);
            await pw.skipIfFeatureFlagNotSet('ChannelPermissionPolicies', true);

            const {adminUser, adminClient, user, team} = await pw.initSetup();

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

            // # Something for the channel admin to still be able to read once writes are denied
            const readableMessage = `readable under a write denial ${pw.random.id()}`;
            await adminClient.createPost({channel_id: channel.id, message: readableMessage} as any);

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);
            await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});

            const policyName = `PP Write Deny ${pw.random.id()}`;
            createdPolicyName = policyName;
            createdPolicyClient = adminClient;

            await createPermissionPolicy(systemConsolePage.page, {
                name: policyName,
                celExpression: 'user.attributes.Department == "NoSuchDepartment"',
                permissions: ['Channel Write Access'],
                adminClient,
            });

            const policyId = await getPolicyIdByName(adminClient, policyName);
            expect(policyId).toBeTruthy();
            await activatePolicy(adminClient, policyId!);

            const {page} = await pw.testBrowser.login(user);
            const channelsPage = new ChannelsPage(page);
            await page.goto(`/${team.name}/channels/${channel.name}`);
            await channelsPage.toBeVisible();

            await expect(page.locator(`#sidebarItem_${channel.name}`)).toBeVisible();
            await expect((await channelsPage.getLastPost()).body).toContainText(readableMessage);

            const channelSettings = await channelsPage.openChannelSettings();

            const membershipPolicyTab = channelSettings.container.getByRole('tab', {name: /membership policy/i});
            const permissionsPolicyTab = channelSettings.container.getByRole('tab', {name: /permissions policy/i});
            await expect(membershipPolicyTab).toBeVisible();
            await expect(permissionsPolicyTab).toBeVisible();

            await expect(channelSettings.container.getByText('Editing is restricted')).toBeVisible();

            await permissionsPolicyTab.click();
            await expect(channelSettings.container.getByTestId('permissions-policy-read-only')).toBeVisible();
            await expect(channelSettings.container.getByTestId('permissions-policy-add-rule')).toHaveCount(0);

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
        });

        test('a channel admin denied channel_read_access loses the channel itself, not just its tabs', async ({pw}) => {
            test.setTimeout(180000);
            await pw.skipIfNoLicense();

            await pw.skipIfFeatureFlagNotSet('PermissionPolicies', true);

            const {adminUser, adminClient, user, team} = await pw.initSetup();

            await ensureUserAttributes(adminClient);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `cra-${pw.random.id()}`.toLowerCase(),
                display_name: `Channel Read Access ${pw.random.id()}`,
                type: 'P',
                purpose: '',
                header: '',
            } as any);
            await adminClient.addToChannel(user.id, channel.id);
            await adminClient.updateChannelMemberRoles(channel.id, user.id, 'channel_user channel_admin');

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            await enableABAC(systemConsolePage.page);
            await adminClient.patchConfig({AccessControlSettings: {EnableAttributeBasedAccessControl: true}});

            const policyName = `PP Read Deny ${pw.random.id()}`;
            createdPolicyName = policyName;
            createdPolicyClient = adminClient;
            await createPermissionPolicy(systemConsolePage.page, {
                name: policyName,
                celExpression: 'user.attributes.Department == "NoSuchDepartment"',
                permissions: ['Channel Read Access'],
                adminClient,
            });

            const policyId = await getPolicyIdByName(adminClient, policyName);
            expect(policyId).toBeTruthy();
            await activatePolicy(adminClient, policyId!);

            const {page} = await pw.testBrowser.login(user);
            await page.goto('/', {waitUntil: 'domcontentloaded'});

            const denied = await page.evaluate(
                async ({channelId, teamId}: {channelId: string; teamId: string}) => {
                    const one = await fetch(`/api/v4/channels/${channelId}`);
                    const mine = await fetch(`/api/v4/users/me/teams/${teamId}/channels`);
                    return {
                        status: one.status,
                        id: (await one.json())?.id,
                        listStatus: mine.status,
                        listHasChannel: ((await mine.json()) || []).some((c: any) => c.id === channelId),
                    };
                },
                {channelId: channel.id, teamId: team.id},
            );

            expect(denied.status).toBe(403);
            expect(denied.id).toBe('api.channel.channel_read_access.abac_denied.app_error');

            expect(denied.listStatus).toBe(200);
            expect(denied.listHasChannel).toBe(false);

            await deletePermissionPolicyByName(adminClient, policyName);

            await expect
                .poll(
                    async () =>
                        page.evaluate(async (channelId: string) => {
                            const resp = await fetch(`/api/v4/channels/${channelId}`);
                            return resp.status;
                        }, channel.id),
                    {timeout: 30000},
                )
                .toBe(200);

            const member = await adminClient.getChannelMember(channel.id, user.id);
            expect(member?.roles).toContain('channel_admin');
        });
    },
);

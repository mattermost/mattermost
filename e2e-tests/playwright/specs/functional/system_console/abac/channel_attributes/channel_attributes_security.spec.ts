// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {
    channelAttributeFieldName,
    createChannelAttributeField,
    deleteChannelAttributeFields,
    expectApiStatus,
    findValue,
    purgeChannelAttributeFields,
    readChannelValues,
    writeChannelValue,
} from './helpers';

test.describe('Channel Attributes security foundation', {tag: ['@abac', '@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify channel attribute values use the existing channel and field permission gates.
     */
    test('enforces channel value permissions across channel types', async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminClient, userClient, user, team} = await pw.initSetup();
        const originalConfig = await adminClient.getConfig();
        const originalFlag = originalConfig.FeatureFlags.ChannelAttributes === true;

        const suffix = `${Date.now()}`;
        const fieldIds: string[] = [];
        const channelIds: string[] = [];

        try {
            await adminClient.patchConfig({FeatureFlags: {ChannelAttributes: true}} as any);
            await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);
            await purgeChannelAttributeFields(adminClient);

            const field = await createChannelAttributeField(
                adminClient,
                channelAttributeFieldName('security', suffix),
                {
                    permission: 'admin',
                    actions: [
                        'display_banner_top',
                        'display_banner_bottom',
                        'display_label_header',
                        'display_label_info',
                    ],
                },
            );
            fieldIds.push(field.id);

            const publicChannel = await adminClient.createChannel({
                team_id: team.id,
                name: `ca-public-${suffix}`,
                display_name: 'Channel Attributes Public',
                type: 'O',
            });
            const privateChannel = await adminClient.createChannel({
                team_id: team.id,
                name: `ca-private-${suffix}`,
                display_name: 'Channel Attributes Private',
                type: 'P',
            });
            channelIds.push(publicChannel.id, privateChannel.id);

            await adminClient.addToChannel(user.id, publicChannel.id);
            await adminClient.addToChannel(user.id, privateChannel.id);

            await expectApiStatus(
                () => writeChannelValue(userClient, publicChannel.id, field.id, 'member-attempt'),
                403,
                'plain channel member admin-tier write',
            );

            await adminClient.updateChannelMemberRoles(publicChannel.id, user.id, 'channel_user channel_admin');
            const written = await writeChannelValue(userClient, publicChannel.id, field.id, 'channel-admin-value');
            expect(findValue(written, field.id)?.value).toBe('channel-admin-value');

            const outsider = await pw.createNewUserProfile(adminClient, {prefix: 'channel-attributes-outsider'});
            const {client: outsiderClient} = await pw.makeClient(outsider);
            await expectApiStatus(
                () => readChannelValues(outsiderClient, publicChannel.id),
                403,
                'public channel non-member read',
            );
            await expectApiStatus(
                () => readChannelValues(outsiderClient, privateChannel.id),
                403,
                'private channel non-member read',
            );

            const dmPeer = await pw.createNewUserProfile(adminClient, {prefix: 'channel-attributes-dm'});
            const gmPeer = await pw.createNewUserProfile(adminClient, {prefix: 'channel-attributes-gm'});
            const dmChannel = await adminClient.createDirectChannel([user.id, dmPeer.id]);
            const gmChannel = await adminClient.createGroupChannel([user.id, dmPeer.id, gmPeer.id]);
            channelIds.push(dmChannel.id, gmChannel.id);

            await expectApiStatus(
                () => writeChannelValue(userClient, dmChannel.id, field.id, 'dm-member-attempt'),
                403,
                'DM participant admin-tier write',
            );
            await expectApiStatus(
                () => writeChannelValue(userClient, gmChannel.id, field.id, 'gm-member-attempt'),
                403,
                'GM participant admin-tier write',
            );

            const dmValues = await writeChannelValue(adminClient, dmChannel.id, field.id, 'dm-system-admin-value');
            const gmValues = await writeChannelValue(adminClient, gmChannel.id, field.id, 'gm-system-admin-value');
            expect(findValue(dmValues, field.id)?.value).toBe('dm-system-admin-value');
            expect(findValue(gmValues, field.id)?.value).toBe('gm-system-admin-value');
        } finally {
            await deleteChannelAttributeFields(adminClient, fieldIds);
            for (const channelId of channelIds) {
                await adminClient.deleteChannel(channelId).catch(() => undefined);
            }
            await adminClient.patchConfig({FeatureFlags: {ChannelAttributes: originalFlag}} as any);
        }
    });
});

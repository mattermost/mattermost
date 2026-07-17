// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, SystemConsolePage, expect, test} from '@mattermost/playwright-lib';

test.describe('LDAP channel management modes', () => {
    async function setup(pw: any) {
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
        const {adminClient, adminUser} = await pw.getAdminClient();
        await adminClient.initializeOpenLdap();
        const team = await adminClient.createTeam(await pw.random.team());
        await adminClient.addToTeam(team.id, adminUser.id);
        const channel = await adminClient.createPublicChannel(team.id, 'Test Channel');
        const {page} = await pw.testBrowser.login(adminUser);
        return {adminClient, channel, consolePage: new SystemConsolePage(page)};
    }

    /**
     * @objective Verify a system administrator can persist public and private channel modes
     */
    test(
        'MM-T4003_1 changes channel privacy in both directions using the mode toggle',
        {tag: '@ldap'},
        async ({pw}) => {
            const {adminClient, channel, consolePage} = await setup(pw);
            expect(channel.type).toBe('O');

            // # Change and save the public channel as private
            await consolePage.channelConfiguration.goto(channel.id);
            await consolePage.channelConfiguration.setPublic(false);
            await consolePage.channelConfiguration.save(true);

            // * Verify private mode is persisted
            await expect
                .poll(async () => (await adminClient.getChannel(channel.id)).type, {timeout: duration.half_min})
                .toBe('P');

            // # Change and save the private channel as public
            await consolePage.channelConfiguration.goto(channel.id);
            await consolePage.channelConfiguration.setPublic(true);
            await consolePage.channelConfiguration.save(true);

            // * Verify public mode is persisted
            await expect
                .poll(async () => (await adminClient.getChannel(channel.id)).type, {timeout: duration.half_min})
                .toBe('O');
        },
    );

    /**
     * @objective Verify resetting group synchronization does not change an unsaved channel privacy selection
     */
    test(
        'MM-T4003_2 preserves the channel privacy selection when group sync is toggled twice',
        {tag: '@ldap'},
        async ({pw}) => {
            const {channel, consolePage} = await setup(pw);
            await consolePage.channelConfiguration.goto(channel.id);

            // # Enable and disable group synchronization
            await consolePage.channelConfiguration.toggleSyncGroupMembers();
            await consolePage.channelConfiguration.toggleSyncGroupMembers();

            // * Verify the channel remains public
            await consolePage.channelConfiguration.expectMode('Public');

            // # Select private mode, then enable and disable group synchronization again
            await consolePage.channelConfiguration.setPublic(false);
            await consolePage.channelConfiguration.toggleSyncGroupMembers();
            await consolePage.channelConfiguration.toggleSyncGroupMembers();

            // * Verify the unsaved private selection remains selected
            await consolePage.channelConfiguration.expectMode('Private');
        },
    );
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import type {TeamType} from '@mattermost/types/teams';

import {makeClient} from './client';
import {createNewTeam} from './team';
import {createNewUserProfile} from './user';

import {DefaultChannel} from '@/constant';
import {getFileFromCommonAsset} from '@/file';
import {testConfig} from '@/test_config';

type InitSetupOptions = {
    userOptions?: Partial<Parameters<typeof createNewUserProfile>[1]>;
    teamsOptions?: Partial<Parameters<typeof createNewTeam>[1]>;
    withDefaultProfileImage?: boolean;
};

export async function initSetup({
    userOptions = {prefix: 'user', disableTutorial: true, disableOnboarding: true},
    teamsOptions = {name: 'team', displayName: 'Team', type: 'O' as TeamType, unique: true},
    withDefaultProfileImage = true,
}: Partial<InitSetupOptions> = {}) {
    try {
        // Login the admin user via API
        const {adminClient, adminUser} = await getAdminClient();
        if (!adminUser) {
            throw new Error('Failed to setup admin: Admin user not found.');
        }
        if (!adminClient) {
            throw new Error(
                "Failed to setup admin: Check that you're able to access the server using the same admin credential.",
            );
        }

        // Create new team
        const team = await createNewTeam(adminClient, teamsOptions);

        // Create new user and add to newly created team
        const user = await createNewUserProfile(adminClient, userOptions);
        await adminClient.addToTeam(team.id, user.id);

        // Log in new user via API
        const {client: userClient} = await makeClient(user);

        if (withDefaultProfileImage) {
            const file = getFileFromCommonAsset('mattermost-icon_128x128.png');
            await userClient.uploadProfileImage(user.id, file);
        }

        // the team's default channels, which the user joined with the team
        const [townSquare, offTopic] = await Promise.all([
            adminClient.getChannelByName(team.id, DefaultChannel.TownSquare),
            adminClient.getChannelByName(team.id, DefaultChannel.OffTopic),
        ]);

        return {
            adminClient,
            adminUser,
            user,
            userClient,
            team,
            townSquare,
            offTopic,
            offTopicUrl: getUrl(team.name, DefaultChannel.OffTopic),
            townSquareUrl: getUrl(team.name, DefaultChannel.TownSquare),
        };
    } catch (error) {
        expect(error, 'Should not throw an error').toBeFalsy();
        throw error;
    }
}

export async function getAdminClient(opts: {skipLog: boolean} = {skipLog: false}) {
    const {client: adminClient, user: adminUser} = await makeClient(
        {
            username: testConfig.adminUsername,
            password: testConfig.adminPassword,
        },
        opts,
    );

    return {adminClient, adminUser};
}

function getUrl(teamName: string, channelName: string) {
    return `/${teamName}/channels/${channelName}`;
}

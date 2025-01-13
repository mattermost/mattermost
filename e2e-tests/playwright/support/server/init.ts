// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';

import {PreferenceType} from '@mattermost/types/preferences';
import testConfig from '@e2e-test.config';
import {getFileDataFromAsset} from '@e2e-support/file';

import {makeClient} from '.';
import {getOnPremServerConfig} from './default_config';
import {createRandomTeam} from './team';
import {createRandomUser} from './user';

export async function initSetup({
    userPrefix = 'user',
    teamPrefix = {name: 'team', displayName: 'Team'},
    withDefaultProfileImage = true,
} = {}) {
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

        // Reset server config
        const adminConfig = await adminClient.updateConfig(getOnPremServerConfig());

        // Create new team
        const team = await adminClient.createTeam(createRandomTeam(teamPrefix.name, teamPrefix.displayName));

        // Create new user and add to newly created team
        const randomUser = createRandomUser(userPrefix);
        const user = await adminClient.createUser(randomUser, '', '');
        user.password = randomUser.password;
        await adminClient.addToTeam(team.id, user.id);

        // Log in new user via API
        const {client: userClient} = await makeClient(user);

        if (withDefaultProfileImage) {
            const {file} = getFileDataFromAsset('mattermost-icon_128x128.png', 'image/png');
            await userClient.uploadProfileImage(user.id, file);
        }

        // Update user preference
        const preferences: PreferenceType[] = [
            {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
            {
                user_id: user.id,
                category: 'drafts',
                name: 'drafts_tour_tip_showed',
                value: JSON.stringify({drafts_tour_tip_showed: true}),
            },
            {user_id: user.id, category: 'crt_thread_pane_step', name: user.id, value: '999'},
        ];
        await userClient.savePreferences(user.id, preferences);

        return {
            adminClient,
            adminUser,
            adminConfig,
            user,
            userClient,
            team,
            offTopicUrl: getUrl(team.name, 'off-topic'),
            townSquareUrl: getUrl(team.name, 'town-square'),
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

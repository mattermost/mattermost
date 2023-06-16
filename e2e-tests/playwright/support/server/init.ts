// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import path from 'node:path';
import {expect} from '@playwright/test';
import chalk from 'chalk';

import {ClientError} from '@mattermost/client/client4';
import {PreferenceType} from '@mattermost/types/preferences';
import testConfig from '@e2e-test.config';

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
        if (!adminClient) {
            throw new Error(
                "Failed to setup admin: Check that you're able to access the server using the same admin credential."
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
            // Set user profile image
            const fullPath = path.join(path.resolve(__dirname), '../', 'asset/mattermost-icon_128x128.png');
            await userClient.uploadProfileImageX(user.id, fullPath);
        }

        // Update user preference
        const preferences: PreferenceType[] = [
            {user_id: user.id, category: 'tutorial_step', name: user.id, value: '999'},
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
        // log an error for debugging
        // eslint-disable-next-line no-console
        const err = error as ClientError;
        if (err.message === 'Could not parse multipart form.') {
            // eslint-disable-next-line no-console
            console.log(chalk.yellow(`node version: ${process.version}\nNODE_OPTIONS: ${process.env.NODE_OPTIONS}`));

            // eslint-disable-next-line no-console
            console.log(
                chalk.green(
                    `This failed due to the experimental fetch support in Node.js starting v18.0.0.\nYou may set environment variable: "export NODE_OPTIONS='--no-experimental-fetch'", then try again.'`
                )
            );
        }
        expect(err, 'Should not throw an error').toBeFalsy();
        throw err;
    }
}

export async function getAdminClient() {
    const {client: adminClient, user: adminUser} = await makeClient({
        username: testConfig.adminUsername,
        password: testConfig.adminPassword,
    });

    return {adminClient, adminUser};
}

function getUrl(teamName: string, channelName: string) {
    return `/${teamName}/channels/${channelName}`;
}

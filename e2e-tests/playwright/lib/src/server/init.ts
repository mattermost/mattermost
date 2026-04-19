// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import {TeamType} from '@mattermost/types/teams';

import {makeClient} from './client';
import {createNewTeam} from './team';
import {createNewUserProfile} from './user';

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

        // Read the current server config — DO NOT reset it.
        //
        // Historically this line was `adminClient.updateConfig(getOnPremServerConfig())`,
        // which REPLACES the entire server configuration with a baseline. That was
        // catastrophic under PW_WORKERS >= 2: every test's initSetup wiped any config
        // patches that concurrent tests had set, producing widespread non-deterministic
        // failures in specs that call patchConfig() (ABAC, PrivacySettings,
        // AutoTranslationSettings, ContentFlaggingSettings, etc.). See PR #36054
        // investigation: after shard sharding was fixed, ~12 spec files were still
        // failing purely because of this global-config race.
        //
        // Callers that need a reset-to-defaults must do it explicitly via
        // adminClient.updateConfig(...) with a narrow, scoped patch and restore their
        // changes in afterAll/afterEach. initSetup now only creates per-test resources
        // (team + user) and returns a snapshot of the current config for reference.
        const adminConfig = await adminClient.getConfig();

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

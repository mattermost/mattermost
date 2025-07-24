// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {UserProfile} from '@mattermost/types/users';
import {PluginManifest} from '@mattermost/types/plugins';
import {PreferenceType} from '@mattermost/types/preferences';

import {defaultTeam} from './util';
import {createRandomTeam, getAdminClient, getDefaultAdminUser, makeClient} from './server';
import {testConfig} from './test_config';

export async function baseGlobalSetup() {
    let adminClient: Client4;
    let adminUser: UserProfile | null;
    ({adminClient, adminUser} = await getAdminClient({skipLog: true}));

    if (!adminUser) {
        const firstClient = new Client4();
        firstClient.setUrl(testConfig.baseURL);
        const defaultAdmin = getDefaultAdminUser();
        await firstClient.createUser(defaultAdmin, '', '');

        ({client: adminClient, user: adminUser} = await makeClient(defaultAdmin));
    }

    // Print playwright configs
    printPlaywrightTestConfig();

    await sysadminSetup(adminClient, adminUser);
}

async function sysadminSetup(client: Client4, user: UserProfile | null) {
    // Ensure admin's email is verified.
    if (!user) {
        await client.verifyUserEmail(client.token);
    }

    // Log license and config info
    await printLicenseInfo(client);
    await printClientInfo(client);

    // Create default team if not present.
    // Otherwise, create other teams and channels other than the default team cna channels (town-square and off-topic).
    const myTeams = await client.getMyTeams();
    const myDefaultTeam = myTeams && myTeams.length > 0 && myTeams.find((team) => team.name === defaultTeam.name);
    if (!myDefaultTeam) {
        await client.createTeam(createRandomTeam(defaultTeam.name, defaultTeam.displayName, 'O', false));
    } else if (myDefaultTeam && testConfig.resetBeforeTest) {
        await Promise.all(
            myTeams.filter((team) => team.name !== defaultTeam.name).map((team) => client.deleteTeam(team.id)),
        );

        const myChannels = await client.getMyChannels(myDefaultTeam.id);
        await Promise.all(
            myChannels
                .filter((channel) => {
                    return (
                        channel.team_id === myDefaultTeam.id &&
                        channel.name !== 'town-square' &&
                        channel.name !== 'off-topic'
                    );
                })
                .map((channel) => client.deleteChannel(channel.id)),
        );
    }

    // Set default preferences
    await savePreferences(client, user?.id ?? '');

    // Log plugin details
    await printPluginDetails(client);
}

function printPlaywrightTestConfig() {
    // eslint-disable-next-line no-console
    console.log(`Playwright Test Config:
  - Headless  = ${testConfig.headless}
  - SlowMo    = ${testConfig.slowMo}
  - Workers   = ${testConfig.workers}`);
}

async function printLicenseInfo(client: Client4) {
    const license = await client.getClientLicenseOld();
    // eslint-disable-next-line no-console
    console.log(`Server License:
  - IsLicensed      = ${license.IsLicensed}
  - IsTrial         = ${license.IsTrial}
  - SkuName         = ${license.SkuName}
  - SkuShortName    = ${license.SkuShortName}
  - Cloud           = ${license.Cloud}
  - Users           = ${license.Users}`);
}

async function printClientInfo(client: Client4) {
    const config = await client.getClientConfigOld();
    // eslint-disable-next-line no-console
    console.log(`Build Info:
  - BuildNumber                 = ${config.BuildNumber}
  - BuildDate                   = ${config.BuildDate}
  - Version                     = ${config.Version}
  - BuildHash                   = ${config.BuildHash}
  - BuildHashEnterprise         = ${config.BuildHashEnterprise}
  - BuildEnterpriseReady        = ${config.BuildEnterpriseReady}
  - TelemetryId                 = ${config.TelemetryId}
  - ServiceEnvironment          = ${config.ServiceEnvironment}`);

    const {LogSettings, ServiceSettings, PluginSettings, FeatureFlags} = await client.getConfig();
    // eslint-disable-next-line no-console
    console.log(`Notable Server Config:
  - ServiceSettings.EnableSecurityFixAlert  = ${ServiceSettings?.EnableSecurityFixAlert}
  - LogSettings.EnableDiagnostics           = ${LogSettings?.EnableDiagnostics}`);

    // eslint-disable-next-line no-console
    console.log('Feature Flags:');
    // eslint-disable-next-line no-console
    console.log(
        Object.entries(FeatureFlags)
            .map(([key, value]) => `  - ${key} = ${value}`)
            .join('\n'),
    );

    // eslint-disable-next-line no-console
    console.log(`Plugin Settings:
  - Enable  = ${PluginSettings?.Enable}
  - EnableUploads  = ${PluginSettings?.EnableUploads}
  - AutomaticPrepackagedPlugins  = ${PluginSettings?.AutomaticPrepackagedPlugins}`);
}

async function printPluginDetails(client: Client4) {
    const plugins = await client.getPlugins();

    if (plugins.active.length) {
        // eslint-disable-next-line no-console
        console.log('Active plugins:');
    }

    plugins.active.forEach((plugin: PluginManifest) => {
        // eslint-disable-next-line no-console
        console.log(`  - ${plugin.id}@${plugin.version} | min_server@${plugin.min_server_version}`);
    });

    if (plugins.inactive.length) {
        // eslint-disable-next-line no-console
        console.log('Inactive plugins:');
    }

    plugins.inactive.forEach((plugin: PluginManifest) => {
        // eslint-disable-next-line no-console
        console.log(`  - ${plugin.id}@${plugin.version} | min_server@${plugin.min_server_version}`);
    });

    // eslint-disable-next-line no-console
    console.log('');
}

async function savePreferences(client: Client4, userId: UserProfile['id']) {
    try {
        if (!userId) {
            throw new Error('userId is not defined');
        }

        const preferences: PreferenceType[] = [
            {user_id: userId, category: 'tutorial_step', name: userId, value: '999'},
            {user_id: userId, category: 'crt_thread_pane_step', name: userId, value: '999'},
        ];

        await client.savePreferences(userId, preferences);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Error saving preferences', error);
    }
}

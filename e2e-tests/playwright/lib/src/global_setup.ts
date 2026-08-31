// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import type {PluginManifest} from '@mattermost/types/plugins';
import type {PreferenceType} from '@mattermost/types/preferences';
import type {UserProfile} from '@mattermost/types/users';

import {
    createNewTeam,
    disableUnexpectedPlugins,
    getAdminClient,
    getDefaultAdminUser,
    makeClient,
    runMmctlLocal,
} from './server';
import {testConfig} from './test_config';
import {isUpgradePathProjectSelected} from './upgrade_env';
import {defaultTeam} from './util';

export async function baseGlobalSetup() {
    let adminClient: Client4;
    let adminUser: UserProfile | null;
    ({adminClient, adminUser} = await getAdminClient({skipLog: true}));

    if (!adminUser) {
        await enableEmailNotifications();

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

// SendEmailNotifications is off in the server's own defaults, so creating the very first sysadmin
// logs "Failed to send welcome email on create user from signup". No admin exists yet to
// authenticate patchConfig with, so this goes through mmctl's --local socket rather than boot env —
// the server's env surface stays the same as any other run.
async function enableEmailNotifications(): Promise<void> {
    if (!testConfig.useTestContainers) {
        return;
    }

    try {
        const {exitCode, output} = await runMmctlLocal([
            'config',
            'set',
            'EmailSettings.SendEmailNotifications',
            'true',
        ]);
        if (exitCode !== 0) {
            throw new Error(`mmctl exited with code ${exitCode}: ${output}`);
        }
    } catch (error) {
        // Costs only a warn-level log line during first-user creation — never worth failing setup over.
        // eslint-disable-next-line no-console
        console.log('Could not enable email notifications before creating the first user', error);
    }
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
        await createNewTeam(client, {name: defaultTeam.name, displayName: defaultTeam.displayName});
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

    await resetPluginState(client);
    await printPluginDetails(client);
}

/**
 * Deactivates plugins a previous run left enabled, so they cannot alter the webapp for the specs
 * that follow. Skipped for the upgrade-path projects, where surviving plugin state is under test.
 */
async function resetPluginState(client: Client4) {
    if (isUpgradePathProjectSelected()) {
        return;
    }

    try {
        const disabled = await disableUnexpectedPlugins(client, testConfig.ensurePluginsInstalled);
        if (disabled.length) {
            // eslint-disable-next-line no-console
            console.log(`Disabled plugins left active by an earlier run: ${disabled.join(', ')}`);
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Could not reset plugin state', error);
    }
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
    const config = await client.getClientConfig();
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
            {user_id: userId, category: 'onboarding_task_list', name: 'onboarding_task_list_show', value: 'false'},
            {user_id: userId, category: 'onboarding_task_list', name: 'onboarding_task_list_open', value: 'false'},
        ];

        await client.savePreferences(userId, preferences);
    } catch (error) {
        // eslint-disable-next-line no-console
        console.log('Error saving preferences', error);
    }
}

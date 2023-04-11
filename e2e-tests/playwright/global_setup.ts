// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect} from '@playwright/test';
import {UserProfile} from '@mattermost/types/users';

import {Client, createRandomTeam, getAdminClient, getDefaultAdminUser, makeClient} from './support/server';
import {defaultTeam} from './support/util';
import testConfig from './test.config';

async function globalSetup() {
    let adminClient: Client;
    let adminUser: UserProfile | null;
    ({adminClient, adminUser} = await getAdminClient());

    if (!adminUser) {
        const {client: firstClient} = await makeClient();
        const defaultAdmin = getDefaultAdminUser();
        await firstClient.createUser(defaultAdmin, '', '');

        ({client: adminClient, user: adminUser} = await makeClient(defaultAdmin));
    }

    await sysadminSetup(adminClient, adminUser);

    return function () {
        // placeholder for teardown setup
    };
}

async function sysadminSetup(client: Client, user: UserProfile | null) {
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
            myTeams.filter((team) => team.name !== defaultTeam.name).map((team) => client.deleteTeam(team.id))
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
                .map((channel) => client.deleteChannel(channel.id))
        );
    }

    // Ensure all products as plugin are installed and active.
    await ensurePluginsLoaded(client);

    // Log plugin details
    await printPluginDetails(client);

    // Ensure server deployment type is as expected
    await ensureServerDeployment(client);
}

async function printLicenseInfo(client: Client) {
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

async function printClientInfo(client: Client) {
    const config = await client.getClientConfigOld();
    // eslint-disable-next-line no-console
    console.log(`Build Info:
  - BuildNumber                 = ${config.BuildNumber}
  - BuildDate                   = ${config.BuildDate}
  - Version                     = ${config.Version}
  - BuildHash                   = ${config.BuildHash}
  - BuildHashEnterprise         = ${config.BuildHashEnterprise}
  - BuildEnterpriseReady        = ${config.BuildEnterpriseReady}
  - FeatureFlagAppsEnabled      = ${config.FeatureFlagAppsEnabled}
  - FeatureFlagCallsEnabled     = ${config.FeatureFlagCallsEnabled}
  - TelemetryId                 = ${config.TelemetryId}`);
}

async function ensurePluginsLoaded(client: Client) {
    const pluginStatus = await client.getPluginStatuses();
    const plugins = await client.getPlugins();

    testConfig.ensurePluginsInstalled.forEach(async (pluginId) => {
        const isInstalled = pluginStatus.some((plugin) => plugin.plugin_id === pluginId);
        if (!isInstalled) {
            // eslint-disable-next-line no-console
            console.log(`${pluginId} is not installed. Related visual test will fail.`);
            return;
        }

        const isActive = plugins.active.some((plugin) => plugin.id === pluginId);
        if (!isActive) {
            await client.enablePlugin(pluginId);

            // eslint-disable-next-line no-console
            console.log(`${pluginId} is installed and has been activated.`);
        } else {
            // eslint-disable-next-line no-console
            console.log(`${pluginId} is installed and active.`);
        }
    });
}

async function printPluginDetails(client: Client) {
    const plugins = await client.getPlugins();

    if (plugins.active.length) {
        // eslint-disable-next-line no-console
        console.log('Active plugins:');
    }

    plugins.active.forEach((plugin) => {
        // eslint-disable-next-line no-console
        console.log(`  - ${plugin.id}@${plugin.version} | min_server@${plugin.min_server_version}`);
    });

    if (plugins.inactive.length) {
        // eslint-disable-next-line no-console
        console.log('Inactive plugins:');
    }

    plugins.inactive.forEach((plugin) => {
        // eslint-disable-next-line no-console
        console.log(`  - ${plugin.id}@${plugin.version} | min_server@${plugin.min_server_version}`);
    });

    // eslint-disable-next-line no-console
    console.log('');
}

async function ensureServerDeployment(client: Client) {
    if (testConfig.haClusterEnabled) {
        const {haClusterNodeCount, haClusterName} = testConfig;

        const {Enable, ClusterName} = (await client.getConfig()).ClusterSettings;
        expect(Enable, Enable ? '' : 'Should have cluster enabled').toBe(true);

        const sameClusterName = ClusterName === haClusterName;
        expect(
            sameClusterName,
            sameClusterName
                ? ''
                : `Should have cluster name set and as expected. Got "${ClusterName}" but expected "${haClusterName}"`
        ).toBe(true);

        const clusterInfo = await client.getClusterStatus();
        const sameCount = clusterInfo?.length === haClusterNodeCount;
        expect(
            sameCount,
            sameCount
                ? ''
                : `Should match number of nodes in a cluster as expected. Got "${clusterInfo?.length}" but expected "${haClusterNodeCount}"`
        ).toBe(true);

        clusterInfo.forEach((info) =>
            // eslint-disable-next-line no-console
            console.log(`hostname: ${info.hostname}, version: ${info.version}, config_hash: ${info.config_hash}`)
        );
    }
}

export default globalSetup;

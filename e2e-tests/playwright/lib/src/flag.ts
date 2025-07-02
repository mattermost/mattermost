// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'node:os';

import {expect, test} from '@playwright/test';
import {PluginManifest} from '@mattermost/types/plugins';

import {callsPluginId} from './constant';
import {getAdminClient} from './server/init';
import {testConfig} from './test_config';

export async function shouldHaveCallsEnabled(enabled = true) {
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getConfig();

    const callsEnabled = config.PluginSettings.PluginStates[callsPluginId].Enable;

    const matched = callsEnabled === enabled;
    expect(matched, matched ? '' : `Calls expect "${enabled}" but actual "${callsEnabled}"`).toBeTruthy();
}

export async function shouldHaveFeatureFlag(name: string, value: string | boolean) {
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getConfig();

    const matched = config.FeatureFlags[name] === value;
    expect(
        matched,
        matched ? '' : `FeatureFlags["${name}'] expect "${value}" but actual "${config.FeatureFlags[name]}"`,
    ).toBeTruthy();
}

export async function shouldRunInLinux() {
    const platform = os.platform();
    expect(platform, 'Run in Linux or Playwright docker image only').toBe('linux');
}

export async function ensureLicense() {
    const {adminClient} = await getAdminClient();
    let license = await adminClient.getClientLicenseOld();

    if (license?.IsLicensed !== 'true') {
        const config = await adminClient.getClientConfigOld();
        expect(
            config.ServiceEnvironment === 'dev',
            'The trial license request fails in the local development environment. Please manually upload the test license.',
        ).toBeFalsy();

        await requestTrialLicense();

        license = await adminClient.getClientLicenseOld();
    }

    expect(license?.IsLicensed === 'true', 'Ensure server has license').toBeTruthy();
}

export async function requestTrialLicense() {
    const {adminClient} = await getAdminClient();
    const admin = await adminClient.getMe();
    try {
        await adminClient.requestTrialLicense({
            receive_emails_accepted: true,
            terms_accepted: true,
            users: 100,
            contact_name: admin.first_name + ' ' + admin.last_name,
            contact_email: admin.email,
            company_name: 'Mattermost Playwright E2E Tests',
            company_size: '101-250',
            company_country: 'United States',
        });
    } catch (error) {
        expect(error, 'Failed to request trial license').toBeFalsy();
        throw error;
    }
}

export async function skipIfNoLicense() {
    const {adminClient} = await getAdminClient();
    const license = await adminClient.getClientLicenseOld();

    test.skip(license.IsLicensed === 'false', 'Skipping test - server not licensed');
}

export async function skipIfFeatureFlagNotSet(name: string, value: string | boolean) {
    const {adminClient} = await getAdminClient();
    const cfg = await adminClient.getConfig();

    test.skip(cfg.FeatureFlags[name] !== value, `Skipping test - Feature Flag ${name} needs to be set to ${value}`);
}

// ensureServerDeployment is used to ensure server deployment type is as expected.
// If server is not deployed as expected, test will fail.
export async function ensureServerDeployment() {
    const {adminClient} = await getAdminClient();

    // Based on test config, ensure server is on an HA cluster.
    if (testConfig.haClusterEnabled) {
        const {haClusterNodeCount, haClusterName} = testConfig;

        const {Enable, ClusterName} = (await adminClient.getConfig()).ClusterSettings;
        expect(Enable, Enable ? '' : 'Should have cluster enabled').toBe(true);

        const sameClusterName = ClusterName === haClusterName;
        expect(
            sameClusterName,
            sameClusterName
                ? ''
                : `Should have cluster name set and as expected. Got "${ClusterName}" but expected "${haClusterName}"`,
        ).toBe(true);

        const clusterInfo = await adminClient.getClusterStatus();
        const sameCount = clusterInfo?.length === haClusterNodeCount;
        expect(
            sameCount,
            sameCount
                ? ''
                : `Should match number of nodes in a cluster as expected. Got "${clusterInfo?.length}" but expected "${haClusterNodeCount}"`,
        ).toBe(true);

        clusterInfo.forEach((info) =>
            // eslint-disable-next-line no-console
            console.log(`hostname: ${info.hostname}, version: ${info.version}, config_hash: ${info.config_hash}`),
        );
    }
}

// ensurePluginsLoaded is used to ensure all pluginIds including from testConfig.ensurePluginsInstalled are installed and active.
// If any pluginId is not installed, test will fail.
// testConfig.ensurePluginsInstalled is derived from `PW_ENSURE_PLUGINS_INSTALLED` environment variable.
export async function ensurePluginsLoaded(pluginIds: string[] = []) {
    const {adminClient} = await getAdminClient();

    const pluginStatus = await adminClient.getPluginStatuses();
    const plugins = await adminClient.getPlugins();

    // Ensure all plugins are installed and active.
    testConfig.ensurePluginsInstalled
        .concat(pluginIds)
        .filter((pluginId) => Boolean(pluginId))
        .forEach(async (pluginId) => {
            const isInstalled = pluginStatus.some((plugin) => plugin.plugin_id === pluginId);

            // If not installed, test will fail.
            expect(isInstalled, `${pluginId} is not installed. Related test will fail.`).toBe(true);

            const isActive = plugins.active.some((plugin: PluginManifest) => plugin.id === pluginId);
            if (!isActive) {
                await adminClient.enablePlugin(pluginId);

                // eslint-disable-next-line no-console
                console.log(`${pluginId} is installed and has been activated.`);
            } else {
                // eslint-disable-next-line no-console
                console.log(`${pluginId} is installed and active.`);
            }
        });
}

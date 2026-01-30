// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'node:os';

import chalk from 'chalk';
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
    const config = await adminClient.getClientConfig();

    // Skip trial license request for team edition (not enterprise-ready)
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    if (!isEnterpriseReady) {
        // Team edition cannot have a license, just return without error
        return;
    }

    let license = await adminClient.getClientLicenseOld();

    if (license?.IsLicensed !== 'true') {
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

export type LicenseSkuShortName = '' | 'entry' | 'professional' | 'enterprise' | 'advanced';
export type ServerEdition = 'team' | 'enterprise';

export async function skipIfNoLicense(...skuShortNames: LicenseSkuShortName[]) {
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getClientConfig();

    // Team edition (not enterprise-ready) can never have a license
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    if (!isEnterpriseReady) {
        test.skip(true, 'Skipping test - server is Team Edition (not enterprise-ready)');
        return;
    }

    const license = await adminClient.getClientLicenseOld();

    const isLicensed = license?.IsLicensed === 'true';
    const matchesSku =
        skuShortNames.length === 0 || skuShortNames.includes(license?.SkuShortName as LicenseSkuShortName);

    test.skip(
        !isLicensed || !matchesSku,
        skuShortNames.length > 0
            ? `Skipping test - server not licensed for ${skuShortNames.join(', ')} SKU`
            : 'Skipping test - server not licensed',
    );
}

export async function requireLicense(...skuShortNames: LicenseSkuShortName[]) {
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getClientConfig();

    // Team edition (not enterprise-ready) can never have a license
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    if (!isEnterpriseReady) {
        // eslint-disable-next-line no-console
        console.log(chalk.yellow('^ Warning: Requires license but server is Team Edition (not enterprise-ready)'));
        return;
    }

    const license = await adminClient.getClientLicenseOld();

    const isLicensed = license?.IsLicensed === 'true';
    const matchesSku =
        skuShortNames.length === 0 || skuShortNames.includes(license?.SkuShortName as LicenseSkuShortName);

    if (!isLicensed || !matchesSku) {
        const actualSku = license?.SkuShortName || 'unknown';
        const message =
            skuShortNames.length > 0
                ? `^ Warning: Requires license (${skuShortNames.join(', ')}) but got ${actualSku}`
                : '^ Warning: Requires server license';
        // eslint-disable-next-line no-console
        console.log(chalk.yellow(message));
    }
}

export async function requireNoLicense() {
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getClientConfig();

    // Team edition (not enterprise-ready) can never have a license
    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    if (!isEnterpriseReady) {
        return;
    }

    const license = await adminClient.getClientLicenseOld();
    const isLicensed = license?.IsLicensed === 'true';

    if (isLicensed) {
        const skuShortName = license?.SkuShortName || 'unknown';
        // eslint-disable-next-line no-console
        console.log(chalk.yellow(`^ Warning: Requires no license but server is licensed (${skuShortName})`));
    }
}

export async function requireEdition(edition: ServerEdition) {
    const {adminClient} = await getAdminClient();
    const config = await adminClient.getClientConfig();

    const isEnterpriseReady = config.BuildEnterpriseReady === 'true';
    const actualEdition: ServerEdition = isEnterpriseReady ? 'enterprise' : 'team';

    if (actualEdition !== edition) {
        // eslint-disable-next-line no-console
        console.log(chalk.yellow(`^ Warning: Requires ${edition} edition but server is ${actualEdition} edition`));
    }
}

export async function requireTeamEdition() {
    await requireEdition('team');
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

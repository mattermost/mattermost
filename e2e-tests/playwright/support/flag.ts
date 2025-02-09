// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'node:os';

import {expect} from '@playwright/test';

import {test} from './test_fixture';
import {callsPluginId} from './constant';
import {getAdminClient} from './server/init';

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
    try {
        // @ts-expect-error This may fail requesting for trial license
        await adminClient.requestTrialLicense({
            receive_emails_accepted: true,
            terms_accepted: true,
            users: 100,
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

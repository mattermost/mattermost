// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import os from 'node:os';

import {expect, test} from '@playwright/test';

import {callsPluginId} from './constant';
import {getAdminClient} from './server/init';
import {isSmallScreen} from './util';

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
        matched ? '' : `FeatureFlags["${name}'] expect "${value}" but actual "${config.FeatureFlags[name]}"`
    ).toBeTruthy();
}

export function shouldSkipInSmallScreen() {
    test.skip(({viewport}) => isSmallScreen(viewport), 'Not applicable to mobile device');
}

export async function shouldRunInLinux() {
    const platform = os.platform();
    await expect(platform, 'Run in Linux or Playwright docker image only').toBe('linux');
}

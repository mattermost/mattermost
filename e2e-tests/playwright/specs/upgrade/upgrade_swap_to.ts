// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, getUpgradeToServerImage, test as setup} from '@mattermost/playwright-lib';

import {readServerIdentity, readUpgradeBaseline} from './upgrade_fixtures';

setup('swap to to-image without MM_LICENSE env', {timeout: duration.four_min}, async ({pw}) => {
    const toImage = getUpgradeToServerImage();
    const baseline = readUpgradeBaseline();

    await pw.upgradeServerImage(toImage, {}, {omitProcessEnvLicense: true});

    const {adminClient} = await pw.getAdminClient();
    const identity = await readServerIdentity(adminClient);
    expect(`${identity.serverVersion}+${identity.buildNumber}`).not.toBe(
        `${baseline.serverVersion}+${baseline.buildNumber}`,
    );
});

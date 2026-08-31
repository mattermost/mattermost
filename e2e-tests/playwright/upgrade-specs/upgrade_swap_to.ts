// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, expect, getUpgradeToServerImage, test as setup} from '@mattermost/playwright-lib';

import {readServerIdentity, readUpgradeBaseline} from './upgrade_fixtures';

setup('swap to to-image', async ({pw}) => {
    // Image pull + container restart + migrations can exceed the default 1m test timeout.
    setup.setTimeout(duration.four_min);

    const toImage = getUpgradeToServerImage();
    const baseline = readUpgradeBaseline();

    try {
        // # Swap to the to-image with the same boot env as upgrade-from (including host MM_LICENSE).
        // Plugin enablement is not forced via env — baseline compare in upgrade-to covers that.
        await pw.upgradeServerImage(toImage);

        // * Confirm the running server is no longer the from-image identity captured in the baseline
        const {adminClient} = await pw.getAdminClient();
        const identity = await readServerIdentity(adminClient);
        expect(`${identity.serverVersion}+${identity.buildNumber}`).not.toBe(
            `${baseline.serverVersion}+${baseline.buildNumber}`,
        );
        // eslint-disable-next-line no-console
        console.log(`upgrade-swap-to: running server version=${identity.serverVersion} build=${identity.buildNumber}`);
    } finally {
        // Capture to-image logs even if the swap/identity assert fails (overwritten by upgrade-to afterAll on success).
        await pw.saveUpgradePhaseLogs('to');
    }
});

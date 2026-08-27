// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test as setup, testConfig} from '@mattermost/playwright-lib';

setup('swap to to-image', async ({pw}) => {
    // Read fresh from testConfig (ultimately SERVER_IMAGE) in THIS process — never a value
    // captured by upgrade_swap_from.ts, which may have run in a different OS process entirely.
    await pw.upgradeServerImage(testConfig.serverImage);
});

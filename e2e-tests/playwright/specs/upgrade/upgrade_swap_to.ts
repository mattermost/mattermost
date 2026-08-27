// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test as setup, testConfig} from '@mattermost/playwright-lib';

setup('swap to to-image', async ({pw}) => {
    await pw.upgradeServerImage(testConfig.serverImage);
    await pw.ensureLocalFile();
});

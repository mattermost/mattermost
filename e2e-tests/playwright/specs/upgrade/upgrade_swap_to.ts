// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getUpgradeToServerImage, test as setup} from '@mattermost/playwright-lib';

setup('swap to to-image', async ({pw}) => {
    await pw.upgradeServerImage(getUpgradeToServerImage());
    await pw.ensureLocalFile();
});

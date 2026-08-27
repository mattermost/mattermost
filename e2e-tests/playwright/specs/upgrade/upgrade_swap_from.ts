// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getUpgradeFromServerImage, test as setup} from '@mattermost/playwright-lib';

setup('swap to from-image', async ({pw}) => {
    await pw.upgradeServerImage(getUpgradeFromServerImage());
});

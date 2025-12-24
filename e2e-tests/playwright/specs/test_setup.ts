// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test as setup, getAdminClient, installAIPlugin} from '@mattermost/playwright-lib';

setup('ensure plugins are loaded', async ({pw}) => {
    // Ensure all products as plugin are installed and active.
    await pw.ensurePluginsLoaded();
});

setup('ensure server deployment', async ({pw}) => {
    // Ensure server is on expected deployment type.
    await pw.ensureServerDeployment();
});

setup('install AI plugin if configured', async () => {
    // Install AI plugin from local path if PW_AI_PLUGIN_PATH is set
    const {adminClient} = await getAdminClient();
    await installAIPlugin(adminClient);
});

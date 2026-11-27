// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {duration, isUpgradePathProjectSelected, test as setup} from '@mattermost/playwright-lib';

import {ensureAbacSuiteBaseline} from './functional/system_console/abac/support';

setup('ensure plugins are loaded', async ({pw}) => {
    // Ensure all products as plugin are installed and active.
    await pw.ensurePluginsLoaded();
});

setup('ensure server deployment', async ({pw}) => {
    // Ensure server is on expected deployment type.
    await pw.ensureServerDeployment();
});

setup('ensure demo plugin', async ({pw}) => {
    // The server downloads the plugin tarball from GitHub on first install, which can take
    // well over the default 60s on a slow link.
    setup.setTimeout(duration.four_min);

    // Upgrade-path runs install and version-pin the demo plugin themselves (see
    // upgrade-specs/upgrade_fixtures.ts) to exercise it across the upgrade boundary —
    // skip the generic setup here so it doesn't fight that.
    if (isUpgradePathProjectSelected()) {
        return;
    }

    // Installed and configured once for the entire run, but left inactive — activation is
    // a cheap, idempotent enablePlugin call, so individual specs call pw.ensureDemoPlugin()
    // themselves to activate it rather than inheriting already-on state from setup.
    await pw.ensureDemoPlugin({activate: false});
});

setup('ensure ABAC is configured', async ({pw}) => {
    // On an upgrade path this runs against the from-image. The upgrade links any attribute created
    // there to a Global Attribute template, after which the CPA API refuses to edit or delete it.
    // Patching AccessControlSettings on older from-images also logs unrecognized sysconsole
    // permission tags and attachment-sanitization noise. upgrade-to seeds the same baseline on the
    // to-image instead.
    if (isUpgradePathProjectSelected()) {
        return;
    }

    // Use getAdminClient (not initSetup) to avoid calling updateConfig(defaultConfig)
    // which resets the entire server config and broadcasts via WebSocket to all open
    // browser sessions across the 13 parallel shards starting simultaneously.
    const {adminClient} = await pw.getAdminClient();
    await ensureAbacSuiteBaseline(adminClient);
});

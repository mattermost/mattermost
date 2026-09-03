// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify a FeatureFlags entry can be switched via a server restart, since FeatureFlags
 * are never re-read from a running server's config store and only take effect through a boot-time
 * MM_FEATUREFLAGS_* env var.
 *
 * @precondition
 * Full (Testcontainers) mode, so the server can be restarted with a different feature flag env var.
 */
test('flips a feature flag by restarting the server with it set', async ({pw}) => {
    // Ensure prerequisites
    await pw.ensureFeatureFlag('TestBoolFeature', true);

    const {adminClient} = await pw.getAdminClient();
    const config = await adminClient.getConfig();

    expect(String(config.FeatureFlags?.TestBoolFeature)).toBe('true');
});

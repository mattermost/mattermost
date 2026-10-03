// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * The ChannelAttributesRequired feature flag, ON.
 *
 * Every test in this file runs under the same {ChannelAttributes: true,
 * ChannelAttributesRequired: true} configuration — see the companion "off" spec,
 * channel_attributes_required_kill_switch_off.spec.ts, for the flag turned off (the
 * server default). Splitting by flag combination, one ensureFeatureFlag call per file
 * in a single top-level beforeAll, keeps each file to at most one Testcontainers
 * server restart.
 */

import {ensureFeatureFlag, expect, test} from '@mattermost/playwright-lib';

import {requireGlobalAttributesEnabled} from './global_attributes_helpers';

test.describe(
    'System Console - ChannelAttributesRequired feature flag (on)',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        // The "page"/"context" fixtures that `pw` depends on are per-test, not available in
        // beforeAll, so the restart must go through the bare import instead of pw.ensureFeatureFlag.
        test.beforeAll(async () => {
            await ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        });

        /**
         * @objective Ensure the System Console shows the Required toggle for a
         * channel-resource attribute when ChannelAttributesRequired is on.
         */
        test('shows the Required toggle for channel attributes when ChannelAttributesRequired is on', async ({pw}) => {
            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            const {attributeAppliesToChannels} = globalAttributes;

            await globalAttributes.gotoNewAttribute();
            await globalAttributes.setDisplayName(`Required Toggle On ${suffix}`);
            await attributeAppliesToChannels.addResource();

            // * Required toggle is visible — enforcement is on
            await expect(attributeAppliesToChannels.requiredToggle).toBeVisible();

            // The form was never saved, so there is no attribute field to clean up.
        });
    },
);

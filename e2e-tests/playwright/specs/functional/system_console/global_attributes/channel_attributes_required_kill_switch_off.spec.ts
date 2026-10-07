// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * ChannelAttributesRequired OFF (server default).
 */

import {expect, test} from '@mattermost/playwright-lib';

import {requireGlobalAttributesEnabled} from './global_attributes_helpers';

test.describe(
    'System Console - ChannelAttributesRequired feature flag (off)',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        /**
         * @objective Ensure the System Console hides the Required toggle for a
         * channel-resource attribute when ChannelAttributesRequired is off — there is
         * no admin path to freshly mark a field required while enforcement is disabled.
         */
        test('hides the Required toggle for channel attributes when ChannelAttributesRequired is off', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: false});

            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();

            const {systemConsolePage} = await pw.testBrowser.login(adminUser);
            const {globalAttributes} = systemConsolePage;
            const {attributeAppliesToChannels} = globalAttributes;

            await globalAttributes.gotoNewAttribute();
            await globalAttributes.setDisplayName(`Required Toggle Off ${suffix}`);
            await attributeAppliesToChannels.addResource();

            // * Required toggle hidden — enforcement is off, no admin path to mark required
            await expect(attributeAppliesToChannels.requiredToggle).toHaveCount(0);

            // The form was never saved, so there is no attribute field to clean up.
        });
    },
);

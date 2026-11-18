// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * ChannelAttributesRequired OFF (server default).
 */

import {expect, test} from '@mattermost/playwright-lib';

import {addChannelResource, openNewAttribute, requireGlobalAttributesEnabled} from './global_attributes_helpers';

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

            const {app} = await pw.testBrowser.login(adminUser);
            const form = await openNewAttribute(app);
            await form.displayName.container.fill(`Required Toggle Off ${suffix}`);
            await expect(form.displayName.container).toHaveValue(`Required Toggle Off ${suffix}`);
            const settings = await addChannelResource(form);

            // * The channel settings show, but the Required toggle is hidden — enforcement is off, no admin
            // path to mark required
            await expect(settings.changePolicyButton).toBeVisible();
            await expect(settings.requiredSwitch).toHaveCount(0);

            // The form was never saved, so there is no attribute field to clean up.
        });
    },
);

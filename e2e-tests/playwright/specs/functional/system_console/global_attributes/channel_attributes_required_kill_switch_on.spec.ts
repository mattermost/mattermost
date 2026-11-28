// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * ChannelAttributesRequired ON. See the companion "off" spec,
 * channel_attributes_required_kill_switch_off.spec.ts.
 */

import {expect, test} from '@mattermost/playwright-lib';

import {addChannelResource, openNewAttribute, requireGlobalAttributesEnabled} from './global_attributes_helpers';

test.describe(
    'System Console - ChannelAttributesRequired feature flag (on)',
    {tag: ['@system_console', '@channel_attributes']},
    () => {
        /**
         * @objective Ensure the System Console shows the Required toggle for a
         * channel-resource attribute when ChannelAttributesRequired is on.
         */
        test('shows the Required toggle for channel attributes when ChannelAttributesRequired is on', async ({pw}) => {
            await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});

            const {adminUser} = await requireGlobalAttributesEnabled(pw);

            const suffix = pw.random.id();

            const {app} = await pw.testBrowser.login(adminUser);
            const form = await openNewAttribute(app);
            await form.displayName.container.fill(`Required Toggle On ${suffix}`);
            await expect(form.displayName.container).toHaveValue(`Required Toggle On ${suffix}`);
            const settings = await addChannelResource(form);

            // * Required toggle is visible — enforcement is on
            await expect(settings.requiredSwitch).toBeVisible();

            // The form was never saved, so there is no attribute field to clean up.
        });
    },
);

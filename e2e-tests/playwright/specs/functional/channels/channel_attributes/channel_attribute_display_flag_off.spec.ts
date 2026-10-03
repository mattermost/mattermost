// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Split out of channel_attribute_display.spec.ts: this is the only test in that
 * suite needing the ChannelAttributes feature flag off, the opposite of every
 * other test there, so it belongs in its own file under the
 * one-ensureFeatureFlag-call-per-file convention.
 */

import type {PropertyField} from '@mattermost/types/properties';

import {ensureFeatureFlag, expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_LABEL_HEADER,
    DISPLAY_LABEL_INFO,
    attributeName,
    createAttribute,
    deleteAttributes,
    optionId,
    setChannelValue,
} from './helpers';

test.describe('Channel attribute display and editing (flag off)', {tag: ['@channel_attributes']}, () => {
    // The "page"/"context" fixtures that `pw` depends on are per-test, not available in
    // beforeAll, so the restart must go through the bare import instead of pw.ensureFeatureFlag.
    test.beforeAll(async () => {
        await ensureFeatureFlag('ChannelAttributes', false);
    });

    /**
     * @objective Verify every surface reverts when the feature flag is off.
     */
    test('renders no attribute surfaces with the flag off', async ({pw}) => {
        await pw.skipIfNoLicense();

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            const marking = await createAttribute(adminClient, attributeName('flagoff', suffix), {
                options: ['HIDDEN'],
                actions: [DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO],
            });
            created.push(marking);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-flagoff-${suffix}`,
                display_name: `Attr FlagOff ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'HIDDEN'));

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // The value stays in the database; only the surfaces disappear.
            await expect(page.getByTestId('channelAttributeLabels-info-header')).toHaveCount(0);
            await expect(page.getByText('HIDDEN')).toHaveCount(0);

            await page.locator('#channel-info-btn').click();
            await expect(page.getByTestId('channelInfoAttributes')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

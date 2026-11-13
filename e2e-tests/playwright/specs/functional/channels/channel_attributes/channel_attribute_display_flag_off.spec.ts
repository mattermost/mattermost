// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

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
    /**
     * @objective Verify every surface reverts when the feature flag is off.
     */
    test('renders no attribute surfaces with the flag off', async ({pw}) => {
        await pw.ensureFeatureFlag('ChannelAttributes', false);
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

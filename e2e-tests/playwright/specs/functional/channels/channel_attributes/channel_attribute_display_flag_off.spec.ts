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
import {openChannel, openChannelInfo} from './surface';

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

            const app = await openChannel(pw, user, team, channel);

            // The value stays in the database; only the surfaces disappear.
            await expect(app.channelHeader.infoButton).toBeVisible();
            await expect(app.channelHeader.attributes).toHaveCount(0);

            await openChannelInfo(app);
            await expect(app.rhs.channelInfo.about.attributes).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

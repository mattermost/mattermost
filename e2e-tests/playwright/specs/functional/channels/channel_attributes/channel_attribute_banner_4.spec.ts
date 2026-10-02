// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    TEST_LEVELS,
    deleteClassificationFieldsIfExist,
    setupClassificationWithChannelField,
} from '../channel_classification/helpers';

import {
    DISPLAY_BANNER_TOP,
    assertNoForeignRequiredAttributes,
    attributeName,
    createAttribute,
    createChannelForAttributes,
    deleteAttributes,
    optionId,
    purgeAttributes,
} from './helpers';

const BANNER_COLOR = '#1e325c';

test.describe('Channel attribute banner composition', {tag: ['@channel_attributes']}, () => {
    /**
     * @objective Verify that when classification is banner-designated, Channel Settings
     * locks the color picker to the selected level's color and the user cannot override it.
     */
    test('color picker is locked to the classification level color when classification is banner-designated', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();

        // Provision the classification template + channel-linked field ourselves:
        // this test must not depend on state left behind by other spec files.
        const {channelFieldId, levels} = await setupClassificationWithChannelField(adminClient, TEST_LEVELS);
        const level = levels.find((l) => l.color);
        if (!level) {
            throw new Error('setupClassificationWithChannelField did not return a coloured level');
        }

        try {
            // Designate classification for the banner
            await adminClient.patchPropertyField('access_control', 'channel', channelFieldId, {
                attrs: {actions: ['display_banner_top']},
            } as never);

            const channel = await createChannelForAttributes(adminClient, team, `class-banner-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                {field_id: channelFieldId, value: level.id},
            ] as never);

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();

            const colorInput = configuration.container.locator(
                '#channel_banner_banner_background_color_picker-inputColorValue',
            );

            // * Color picker is disabled — the level colour is authoritative
            await expect(colorInput).toBeDisabled();

            // * It shows the classification level's colour
            await expect(colorInput).toHaveValue(level.color.toUpperCase());
        } finally {
            await deleteClassificationFieldsIfExist(adminClient);
        }
    });

    /**
     * @objective Verify that when a required attribute is banner-designated, the banner
     * toggle in Channel Settings is locked and cannot be turned off.
     */
    test('banner toggle is disabled when a required attribute designates the banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const marker = await createAttribute(adminClient, attributeName('req_banner', suffix), {
                options: ['RESTRICTED'],
                required: true,
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {RESTRICTED: BANNER_COLOR},
            });
            created.push(marker);

            // Required attributes must be seeded at channel creation time
            const channel = await createChannelForAttributes(adminClient, team, `req-banner-${suffix}`, undefined, [
                {field_id: marker.id, value: optionId(marker, 'RESTRICTED')},
            ]);
            await adminClient.addToChannel(adminUser.id, channel.id);

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();

            // * Toggle is locked — a required attribute mandates the banner
            await expect(configuration.container.getByTestId('channelBannerToggle-button')).toBeDisabled();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

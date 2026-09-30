// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_BANNER_TOP,
    attributeName,
    attributeToken,
    createAttribute,
    createChannelForAttributes,
    deleteAttributes,
    optionId,
    purgeAttributes,
    setChannelValue,
} from './helpers';

const BANNER_COLOR = '#1e325c';

test.describe('Channel attribute banner composition', {tag: ['@channel_attributes']}, () => {
    /**
     * @objective Verify a banner keeps resolving after the attribute's display name changes,
     * because tokens key off the machine name.
     */
    test('keeps resolving after the attribute display name changes', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('renamed', suffix), {
                options: ['ORCON'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {ORCON: BANNER_COLOR},
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `banner-rename-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'ORCON'));

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();
            await configuration.enableChannelBanner();
            await configuration.clearBannerText();
            await configuration.insertBannerToken(marking.name);
            await configuration.setChannelBannerBackgroundColor(BANNER_COLOR.replace('#', ''));
            await configuration.save();
            await settings.close();

            // * Exactly what was authored is persisted, tokens unresolved
            const saved = await adminClient.getChannel(channel.id);
            expect(saved.banner_info?.text).toBe(attributeToken(marking.name));

            await channelsPage.centerView.assertChannelBanner('ORCON', BANNER_COLOR);

            // # Rename the attribute as an administrator would
            await adminClient.patchPropertyField('access_control', 'channel', marking.id, {
                attrs: {...marking.attrs, display_name: `Renamed ${suffix}`},
            } as never);

            // * The authored token still resolves, because it keys off the machine name
            await channelsPage.page.reload();
            await channelsPage.toBeVisible();
            await channelsPage.centerView.assertChannelBanner('ORCON', BANNER_COLOR);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify classification is composed as one attribute among many once channel
     * attributes are on, rather than through its own dedicated controls.
     */
    test('treats classification as one attribute among many', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const classification = await createAttribute(adminClient, attributeName('classification', suffix), {
                options: ['SECRET'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {SECRET: BANNER_COLOR},
            });
            created.push(classification);

            const channel = await createChannelForAttributes(adminClient, team, `banner-class-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, classification, optionId(classification, 'SECRET'));

            const {page, channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();

            // * The dedicated classification controls are gone
            await expect(page.locator('#channelClassificationToggle')).toHaveCount(0);
            await expect(page.getByTestId('channelClassificationLevel')).toHaveCount(0);

            // * The same marking is offered as an ordinary banner token instead
            await configuration.enableChannelBanner();
            await configuration.bannerTokenButton.click();
            await expect(page.getByTestId(`bannerAttributeToken-${classification.name}`)).toBeVisible();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify that a non-classification banner attribute leaves the color picker
     * editable and the banner toggle unlocked.
     */
    test('color picker is editable and toggle is unlocked when a non-classification attribute drives the banner', async ({
        pw,
    }) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('colour_editable', suffix), {
                options: ['ORCON'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {ORCON: BANNER_COLOR},
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `colour-editable-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'ORCON'));

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();

            // * Color picker is editable — no classification in the banner
            await expect(
                configuration.container.locator('#channel_banner_banner_background_color_picker-inputColorValue'),
            ).toBeEnabled();

            // * Toggle is also not locked
            await expect(configuration.container.getByTestId('channelBannerToggle-button')).not.toBeDisabled();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

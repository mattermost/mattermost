// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {deleteClassificationFieldsIfExist, setupClassificationWithChannelField} from '../channel_classification/helpers';

import {
    DISPLAY_BANNER_TOP,
    attributeName,
    createAttribute,
    createChannelForAttributes,
    deleteAttributes,
    optionId,
    purgeAttributes,
    setChannelValue,
} from './helpers';

const BANNER_COLOR = '#1e325c';
const CUSTOM_COLOR = '#3a7d44';
const COLOR_INPUT = '#channel_banner_banner_background_color_picker-inputColorValue';

// The channel-linked classification field is always named this.
const CLASSIFICATION = 'classification';

test.describe('Channel attribute banner settings', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify the colour picker is locked to the classification colour only while
     * classification is in the banner text, and is the channel's to set once it is removed.
     */
    test('locks the colour to classification only while its token is in the banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();

        const {channelFieldId, levels} = await setupClassificationWithChannelField(adminClient);
        const level = levels.find((l) => l.color);
        if (!level) {
            throw new Error('setupClassificationWithChannelField did not return a coloured level');
        }

        try {
            await purgeAttributes(adminClient);
            await adminClient.patchPropertyField('access_control', 'channel', channelFieldId, {
                attrs: {actions: [DISPLAY_BANNER_TOP]},
            } as never);

            const channel = await createChannelForAttributes(adminClient, team, `class-colour-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                {field_id: channelFieldId, value: level.id},
            ] as never);

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            let settings = await channelsPage.openChannelSettings();
            let configuration = await settings.openConfigurationTab();
            let colorInput = configuration.container.locator(COLOR_INPUT);

            // * Classification is in the banner, so its colour is authoritative
            await expect(configuration.bannerTokenChip(CLASSIFICATION)).toBeVisible();
            await expect(colorInput).toBeDisabled();
            await expect(colorInput).toHaveValue(level.color.toUpperCase());

            // # Take classification out of the banner
            await configuration.removeBannerToken(CLASSIFICATION);

            // * Nothing would display, so there is nothing to colour yet
            await expect(colorInput).toBeDisabled();

            // # Author a banner of its own
            await configuration.typeBannerText('Handle with care');

            // * The colour is the channel's again
            await expect(colorInput).toBeEnabled();
            await configuration.setChannelBannerBackgroundColor(CUSTOM_COLOR.replace('#', ''));
            await configuration.save();
            await settings.close();

            // * Members see the channel's colour, not the classification's
            await channelsPage.centerView.assertChannelBanner('Handle with care', CUSTOM_COLOR);

            // # Put classification back
            settings = await channelsPage.openChannelSettings();
            configuration = await settings.openConfigurationTab();
            colorInput = configuration.container.locator(COLOR_INPUT);
            await expect(colorInput).toBeEnabled();
            await configuration.insertBannerToken(CLASSIFICATION);

            // * The picker locks to the classification colour again
            await expect(colorInput).toBeDisabled();
            await expect(colorInput).toHaveValue(level.color.toUpperCase());
        } finally {
            await deleteClassificationFieldsIfExist(adminClient);
        }
    });

    /**
     * @objective Verify a banner the channel emptied on purpose is not refilled with the
     * designated attributes when it is switched back on.
     */
    test('keeps a deliberately emptied banner empty when it is switched back on', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('emptied', suffix), {
                options: ['SECRET'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {SECRET: BANNER_COLOR},
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `banner-emptied-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'SECRET'));

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // # Remove every attribute from the banner and switch it off
            let settings = await channelsPage.openChannelSettings();
            let configuration = await settings.openConfigurationTab();
            await expect(configuration.bannerTokenChip(marking.name)).toBeVisible();
            await configuration.clearBannerText();
            await configuration.disableChannelBanner();
            await configuration.save();
            await settings.close();

            // * The emptied text is what was stored
            const stored = await adminClient.getChannel(channel.id);
            expect(stored.banner_info?.text).toBe('');
            expect(stored.banner_info?.enabled).toBe(false);

            // # Switch the banner back on
            settings = await channelsPage.openChannelSettings();
            configuration = await settings.openConfigurationTab();
            await configuration.enableChannelBanner();

            // * The designated attribute is not seeded back in
            await expect(configuration.bannerTextEditor).toHaveText('');
            await expect(configuration.bannerTokenChip(marking.name)).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify the unsaved-changes panel comes back for an edit made after a save.
     */
    test('offers to save an edit made after a previous save', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('resave', suffix), {
                options: ['SECRET'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {SECRET: BANNER_COLOR},
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `banner-resave-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'SECRET'));

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();
            const unsaved = configuration.container.getByText('You have unsaved changes');

            // # Save a first edit, and let the saved notice close. Typed into a cleared
            // # editor: End does not reliably land the caret after a trailing chip.
            await configuration.clearBannerText();
            await configuration.typeBannerText('first');
            await expect(unsaved).toBeVisible();
            await configuration.save();
            await expect(unsaved).toHaveCount(0);

            // # Edit the text again, then the colour
            await configuration.typeBannerText(' · second');

            // * The tab reports the new edit
            await expect(unsaved).toBeVisible();
            await configuration.save();
            await expect(unsaved).toHaveCount(0);

            await configuration.setChannelBannerBackgroundColor(CUSTOM_COLOR.replace('#', ''));
            await expect(unsaved).toBeVisible();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify switching off an attribute-driven banner hides it from the channel,
     * and switching it back on restores it.
     */
    test('hides an attribute-driven banner once it is switched off', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('switched', suffix), {
                options: ['SECRET'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {SECRET: BANNER_COLOR},
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `banner-switched-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'SECRET'));

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * The attribute drives the banner before anyone touches the settings
            await channelsPage.centerView.assertChannelBanner('SECRET', BANNER_COLOR);

            // # Switch the banner off
            let settings = await channelsPage.openChannelSettings();
            let configuration = await settings.openConfigurationTab();
            await expect(configuration.container.getByTestId('channelBannerToggle-button')).toHaveAttribute(
                'aria-pressed',
                'true',
            );
            await configuration.disableChannelBanner();
            await configuration.save();
            await settings.close();

            // * No banner, and off is what was stored
            await channelsPage.centerView.assertChannelBannerNotVisible();
            expect((await adminClient.getChannel(channel.id)).banner_info?.enabled).toBe(false);

            // # Switch it back on
            settings = await channelsPage.openChannelSettings();
            configuration = await settings.openConfigurationTab();
            await expect(configuration.container.getByTestId('channelBannerToggle-button')).toHaveAttribute(
                'aria-pressed',
                'false',
            );
            await configuration.enableChannelBanner();
            await configuration.save();
            await settings.close();

            // * The banner is back. Saving it stores the colour the picker showed, so
            // * only the text is the attribute's.
            await expect(channelsPage.page.getByTestId('channel_banner_text')).toHaveText('SECRET');
            expect((await adminClient.getChannel(channel.id)).banner_info?.enabled).toBe(true);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

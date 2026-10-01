// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_BANNER_TOP,
    DISPLAY_LABEL_INFO,
    attributeName,
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
     * @objective Verify a banner authored as custom text plus a token renders both in the channel.
     */
    test('saves a banner mixing custom text with a token', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('mixed', suffix), {
                options: ['NOFORN'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {NOFORN: BANNER_COLOR},
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `banner-mixed-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'NOFORN'));

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();
            await configuration.enableChannelBanner();

            await configuration.clearBannerText();
            await configuration.typeBannerText('Handling: ');
            await configuration.insertBannerToken(marking.name);
            await configuration.setChannelBannerBackgroundColor(BANNER_COLOR.replace('#', ''));
            await configuration.save();
            await settings.close();

            // * The channel banner shows the literal and the resolved token together
            await channelsPage.centerView.assertChannelBanner('Handling: NOFORN', BANNER_COLOR);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a separator between two tokens is dropped when one of them has no value.
     */
    test('tidies the separator when one of two tokens is unset', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('tidy_set', suffix), {
                options: ['SECRET'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {SECRET: BANNER_COLOR},
                sortOrder: 0,
            });

            // Deliberately left without a value on this channel.
            const program = await createAttribute(adminClient, attributeName('tidy_unset', suffix), {
                options: ['AURORA'],
                actions: [DISPLAY_LABEL_INFO],
                sortOrder: 1,
            });
            created.push(marking, program);

            const channel = await createChannelForAttributes(adminClient, team, `banner-tidy-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'SECRET'));

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();
            await configuration.enableChannelBanner();
            await configuration.clearBannerText();
            await configuration.insertBannerToken(marking.name);
            await configuration.typeBannerText(' · ');
            await configuration.insertBannerToken(program.name);

            // * The stranded separator is collapsed, not rendered next to nothing
            await expect(configuration.bannerTokenPreview).toContainText('SECRET');
            await expect(configuration.bannerTokenPreview).not.toContainText('·');

            await configuration.setChannelBannerBackgroundColor(BANNER_COLOR.replace('#', ''));
            await configuration.save();
            await settings.close();

            await channelsPage.centerView.assertChannelBanner('SECRET', BANNER_COLOR);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a template whose tokens are all unset says so rather than previewing a blank line.
     */
    test('says so when every token in the template is unset', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('empty_preview', suffix), {
                options: ['UNUSED'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {UNUSED: BANNER_COLOR},
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `banner-empty-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();
            await configuration.enableChannelBanner();
            await configuration.insertBannerToken(marking.name);

            // * A warning notice replaces the preview instead of rendering nothing
            await expect(configuration.bannerTokenPreviewEmptyNotice).toContainText('The banner will not be displayed');
            await expect(configuration.bannerTokenPreview).not.toBeVisible();

            await settings.close();

            // * And no banner is rendered from a template that resolves to nothing
            await channelsPage.centerView.assertChannelBannerNotVisible();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

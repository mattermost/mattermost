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
     * @objective Verify an attribute token can be inserted from Channel Settings and previews its resolved value.
     */
    test('inserts an attribute token from the Attributes menu and previews the resolved text', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('preview', suffix), {
                options: ['RESTRICTED'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {RESTRICTED: BANNER_COLOR},
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `banner-preview-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'RESTRICTED'));

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // The composer seeds itself with the banner already on screen, so clear it
            // to author from a known template.
            // # Insert the attribute
            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();
            await configuration.enableChannelBanner();
            await configuration.clearBannerText();
            await configuration.insertBannerToken(marking.name);

            // * The token reads as the attribute's label, not its machine name, and
            // * the preview resolves it to this channel's value
            await expect(configuration.bannerTokenChip(marking.name)).toBeVisible();
            await expect(configuration.bannerTextEditor).not.toContainText(attributeToken(marking.name));
            await expect(configuration.bannerTokenPreview).toContainText('RESTRICTED');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify every banner-designated attribute shares one banner, and that
     * Channel Settings seeds them as chips the channel is free to edit afterward.
     */
    test('composes one banner from every designated attribute', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('multi_marking', suffix), {
                options: ['SECRET'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {SECRET: BANNER_COLOR},
                sortOrder: 1,
            });
            const programme = await createAttribute(adminClient, attributeName('multi_programme', suffix), {
                type: 'text',
                actions: [DISPLAY_BANNER_TOP],
                sortOrder: 2,
            });
            created.push(marking, programme);

            const channel = await createChannelForAttributes(adminClient, team, `banner-multi-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'SECRET'));
            await setChannelValue(adminClient, channel.id, programme, 'AURORA');

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * Both designated attributes share the one banner, in sort order
            await expect(channelsPage.page.getByTestId('channel_banner_text')).toHaveText('SECRET · AURORA');

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();

            // * The composer opens showing what the banner is made of
            await expect(configuration.bannerTokenChip(marking.name)).toBeVisible();
            await expect(configuration.bannerTokenChip(programme.name)).toBeVisible();

            // * Seeding those chips is not an edit, so the tab opens clean
            await expect(configuration.container.getByTestId('SaveChangesPanel__save-btn')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify the banner section reads as enabled when an attribute drives the
     * banner, even though banner_info stays disabled for that channel.
     */
    test('shows the banner section as on when an attribute drives the banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('driven', suffix), {
                options: ['SECRET'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {SECRET: BANNER_COLOR},
            });
            created.push(marking);

            const channel = await createChannelForAttributes(adminClient, team, `banner-driven-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'SECRET'));

            const {channelsPage} = await pw.testBrowser.login(adminUser);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * The channel shows a banner, so its settings must not claim it is off
            await expect(channelsPage.page.getByTestId('channel_banner_text')).toContainText('SECRET');

            const settings = await channelsPage.openChannelSettings();
            const configuration = await settings.openConfigurationTab();

            await expect(configuration.container.getByTestId('channelBannerToggle-button')).toHaveAttribute(
                'aria-pressed',
                'true',
            );
            await expect(configuration.bannerTextEditor).toBeVisible();

            // * Opening the tab changes nothing, so it must not offer to save
            await expect(configuration.container.getByTestId('SaveChangesPanel__save-btn')).toHaveCount(0);

            // * The preview still shows what members see, from the value alone
            await expect(configuration.bannerTokenPreview).toContainText('SECRET');

            // * banner_info itself stays disabled: the value is what renders the banner
            const stored = await adminClient.getChannel(channel.id);
            expect(stored.banner_info?.enabled ?? false).toBe(false);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_BANNER_TOP,
    DISPLAY_LABEL_INFO,
    assertNoForeignRequiredAttributes,
    attributeName,
    attributeToken,
    createAttribute,
    createChannelForAttributes,
    deleteAttributes,
    optionId,
    purgeAttributes,
    setChannelValue,
} from './helpers';
import {findChannelField} from '../../system_console/global_attributes/applies_to_helpers';

const BANNER_COLOR = '#1e325c';

test.describe('Channel attribute banner composition', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify an attribute token can be inserted from Channel Settings and previews its resolved value.
     */
    test('inserts an attribute token from the Attributes menu and previews the resolved text', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
     * Channel Settings shows them as chips the channel cannot remove.
     */
    test('composes one banner from every designated attribute and locks their chips', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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

            // * Designated attributes cannot be taken out of the banner
            await expect(configuration.bannerTokenChipRemove(marking.name)).toHaveCount(0);
            await expect(configuration.bannerTokenChipRemove(programme.name)).toHaveCount(0);

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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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

    /**
     * @objective Verify a banner authored as custom text plus a token renders both in the channel.
     */
    test('saves a banner mixing custom text with a token', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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

            // * The preview names the empty result instead of rendering nothing
            await expect(configuration.bannerTokenPreview).toContainText('no values are set');

            await settings.close();

            // * And no banner is rendered from a template that resolves to nothing
            await channelsPage.centerView.assertChannelBannerNotVisible();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a banner keeps resolving after the attribute's display name changes,
     * because tokens key off the machine name.
     */
    test('keeps resolving after the attribute display name changes', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
    test('color picker is editable and toggle is unlocked when a non-classification attribute drives the banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
            await expect(configuration.container.locator(
                '#channel_banner_banner_background_color_picker-inputColorValue',
            )).toBeEnabled();

            // * Toggle is also not locked
            await expect(configuration.container.getByTestId('channelBannerToggle-button')).not.toBeDisabled();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify that when classification is banner-designated, Channel Settings
     * locks the color picker to the selected level's color and the user cannot override it.
     */
    test('color picker is locked to the classification level color when classification is banner-designated', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, adminUser, team} = await pw.initSetup();
        const suffix = pw.random.id();

        const classificationField = await findChannelField(adminClient, 'classification');
        if (!classificationField) {
            test.skip();
            return;
        }

        const originalAttrs = classificationField.attrs;

        try {
            // Designate classification for the banner
            await adminClient.patchPropertyField('access_control', 'channel', classificationField.id, {
                attrs: {...originalAttrs, actions: ['display_banner_top']},
            } as never);

            // Pick the first level that carries a colour
            const options = (originalAttrs?.options ?? []) as Array<{id: string; name: string; color: string}>;
            const level = options.find((o) => o.color);
            if (!level) {
                test.skip();
                return;
            }

            const channel = await createChannelForAttributes(adminClient, team, `class-banner-${suffix}`);
            await adminClient.addToChannel(adminUser.id, channel.id);
            await adminClient.patchPropertyValues('access_control', 'channel', channel.id, [
                {field_id: classificationField.id, value: level.id},
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
            await adminClient.patchPropertyField('access_control', 'channel', classificationField.id, {
                attrs: originalAttrs,
            } as never);
        }
    });

    /**
     * @objective Verify that when a required attribute is banner-designated, the banner
     * toggle in Channel Settings is locked and cannot be turned off.
     */
    test('banner toggle is disabled when a required attribute designates the banner', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
            const channel = await createChannelForAttributes(
                adminClient,
                team,
                `req-banner-${suffix}`,
                undefined,
                [{field_id: marker.id, value: optionId(marker, 'RESTRICTED')}],
            );
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

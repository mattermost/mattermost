// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_BANNER_TOP,
    DISPLAY_LABEL_HEADER,
    DISPLAY_LABEL_INFO,
    assertNoForeignRequiredAttributes,
    attributeName,
    createAttribute,
    deleteAttributes,
    optionId,
    purgeAttributes,
    setChannelValue,
} from './helpers';

test.describe('Channel attribute lifecycle', {tag: ['@channel_attributes']}, () => {
    /**
     * @objective Verify the banner renders attribute tokens, and that a manual banner text still wins.
     */
    test('renders a token banner and honours a manual override', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('bannertoken', suffix), {
                options: ['RESTRICTED'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {RESTRICTED: '#c8102e'},
                sortOrder: 0,
            });
            const program = await createAttribute(adminClient, attributeName('bannerprogram', suffix), {
                options: ['AURORA'],
                actions: [DISPLAY_LABEL_INFO],
                sortOrder: 1,
            });
            created.push(marking, program);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-token-${suffix}`,
                display_name: `Attr Token ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'RESTRICTED'));
            await setChannelValue(adminClient, channel.id, program, optionId(program, 'AURORA'));

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // No manual text: falls back to the value name.
            await expect(page.getByTestId('channel_banner_text')).toContainText('RESTRICTED');

            // A two-attribute template resolves against this channel.
            await adminClient.patchChannel(channel.id, {
                banner_info: {
                    enabled: true,
                    text: `{{${marking.name}}} · {{${program.name}}}`,
                    background_color: '#c8102e',
                },
            } as never);

            await expect(page.getByTestId('channel_banner_text')).toContainText('RESTRICTED · AURORA');

            // A literal passes through untouched.
            await adminClient.patchChannel(channel.id, {
                banner_info: {enabled: true, text: 'Handle with care', background_color: '#c8102e'},
            } as never);

            await expect(page.getByTestId('channel_banner_text')).toContainText('Handle with care');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a direct message shows no attribute chips even when values exist through the API.
     */
    test('shows no chips on a direct message', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('dm', suffix), {
                options: ['PRIVATE'],
                actions: [DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO],
            });
            created.push(marking);

            const other = await pw.createNewUserProfile(adminClient);
            await adminClient.addToTeam(team.id, other.id);

            const dm = await adminClient.createDirectChannel([user.id, other.id]);

            // Not blocked at the API level, but no DM surface displays them.
            await setChannelValue(adminClient, dm.id, marking, optionId(marking, 'PRIVATE'));

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();
            await page.goto(`/${team.name}/messages/@${other.username}`);

            await expect(page.getByTestId('channelAttributeLabels-info-header')).toHaveCount(0);
            await expect(page.getByText('PRIVATE')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify the configured colour reaches the chip, since a marking's colour is part of how it is read.
     */
    test('applies the configured colour to a chip', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('coloured', suffix), {
                options: ['DARKBG'],
                actions: [DISPLAY_LABEL_HEADER],
                optionColors: {DARKBG: '#1e325c'},
            });
            created.push(marking);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-colour-${suffix}`,
                display_name: `Attr Colour ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'DARKBG'));

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const chip = page.getByTestId('attributeChip').filter({hasText: 'DARKBG'}).first();
            await expect(chip).toBeVisible();
            await expect(chip).toHaveCSS('background-color', 'rgb(30, 50, 92)');

            // Contrast is derived, so a dark background must produce light text.
            await expect(chip).toHaveCSS('color', 'rgb(255, 255, 255)');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

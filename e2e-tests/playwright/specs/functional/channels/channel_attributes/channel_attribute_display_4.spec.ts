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

test.describe('Channel attribute display and editing', {tag: ['@channel_attributes']}, () => {
    /**
     * @objective Verify a text banner attribute banners the channel with the string it stores.
     */
    test('banners a text attribute filled while creating the channel', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const note = await createAttribute(adminClient, attributeName('bannertext', suffix), {
                type: 'text',
                required: true,
                actions: [DISPLAY_BANNER_TOP],
            });
            created.push(note);

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(`Attr Banner Text ${suffix}`);
            await page.getByLabel(note.name, {exact: true}).fill('HANDLE WITH CARE');

            await modal.create();
            await expect(modal.container).not.toBeVisible();

            // A text attribute has no options, so the stored string is the banner.
            await expect(page.getByTestId('channel_banner_text')).toContainText('HANDLE WITH CARE');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a user without the setter tier sees values but no editing affordance.
     */
    test('hides editing from a user without the setter tier', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            // admin tier resolves to manage_channel_roles, which a member lacks.
            const adminOnly = await createAttribute(adminClient, attributeName('admin_tier', suffix), {
                options: ['SET'],
                actions: [DISPLAY_LABEL_INFO],
                permissionValues: 'admin',
            });
            created.push(adminOnly);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-tier-${suffix}`,
                display_name: `Attr Tier ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, adminOnly, optionId(adminOnly, 'SET'));

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();
            await page.locator('#channel-info-btn').click();

            await expect(page.getByTestId(`channelInfoAttributeRow-${adminOnly.name}`)).toContainText('SET');
            await expect(page.getByTestId(`channelInfoAttributeEdit-${adminOnly.name}`)).toHaveCount(0);

            // Asserted per attribute rather than on the button as a whole: the button
            // is shared, so any other attribute this user *can* set would keep it on
            // screen and say nothing about this one.
            const addButton = page.getByTestId('channelInfoAddAttributeButton');
            if (await addButton.count()) {
                await addButton.click();
                await expect(page.getByTestId(`channelInfoAddAttribute-${adminOnly.name}`)).toHaveCount(0);
            }
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify every surface reverts when the feature flag is off.
     */
    test('renders no attribute surfaces with the flag off', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', false);

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

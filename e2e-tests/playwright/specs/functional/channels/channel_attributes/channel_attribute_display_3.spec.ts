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
     * @objective Verify an optional attribute is absent from creation, addable from Channel Info, and produces no chip.
     */
    test('adds an optional attribute from Channel Info', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const optional = await createAttribute(adminClient, attributeName('optional', suffix), {
                options: ['LATER'],
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(optional);

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            const displayName = `Attr Optional ${suffix}`;
            await modal.fillDisplayName(displayName);

            // Optional attributes are not asked for at creation.
            await expect(page.getByTestId(`channelAttributeRow-${optional.name}`)).toHaveCount(0);

            await modal.create();
            await expect(modal.container).not.toBeVisible();

            const info = await channelsPage.openChannelInfo();
            await info.attributes.add(optional.name, 'LATER');

            await expect(page.getByTestId(`channelInfoAttributeRow-${optional.name}`)).toContainText('LATER');

            const channel = await adminClient.getChannelByName(team.id, displayName.toLowerCase().replace(/\s+/g, '-'));
            await expect
                .poll(async () => {
                    const values = await adminClient.getPropertyValues('access_control', 'channel', channel.id);
                    return values?.find((value) => value.field_id === optional.id)?.value;
                })
                .toBe(optionId(optional, 'LATER'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a banner-designated attribute drives the channel banner.
     */
    test('renders a banner from a banner-designated attribute', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const marking = await createAttribute(adminClient, attributeName('banner', suffix), {
                options: ['RESTRICTED'],
                actions: [DISPLAY_BANNER_TOP],
                optionColors: {RESTRICTED: '#c8102e'},
            });
            created.push(marking);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-banner-${suffix}`,
                display_name: `Attr Banner ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, marking, optionId(marking, 'RESTRICTED'));

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // Falls back to the value name, reproducing today's classification banner.
            await expect(page.getByTestId('channel_banner_text')).toContainText('RESTRICTED');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a multiselect banner attribute set at channel creation banners the new channel immediately.
     */
    test('banners a multiselect attribute filled while creating the channel', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            // Required so the create dialog asks for it, which is how a channel gets
            // a banner value before anyone has opened Channel Settings.
            const caveats = await createAttribute(adminClient, attributeName('bannermulti', suffix), {
                type: 'multiselect',
                options: ['NOFORN', 'ORCON'],
                required: true,
                actions: [DISPLAY_BANNER_TOP, DISPLAY_LABEL_HEADER],
            });
            created.push(caveats);

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name);
            await channelsPage.toBeVisible();

            const modal = await channelsPage.openNewChannelModal();
            await modal.fillDisplayName(`Attr Banner Multi ${suffix}`);

            // The menu closes on each pick, so the second value needs it reopened.
            await page.getByTestId(`channelAttribute-${caveats.name}`).click();
            await page.getByText('NOFORN', {exact: true}).click();
            await page.getByTestId(`channelAttribute-${caveats.name}`).click();
            await page.getByText('ORCON', {exact: true}).click();

            await modal.create();
            await expect(modal.container).not.toBeVisible();

            // No reload, no Channel Settings visit: creation alone has to banner it.
            await expect(page.getByTestId('channel_banner_text')).toContainText('NOFORN, ORCON');

            // Selections may each carry a different colour, so none of them wins and
            // the banner falls back rather than rendering transparent.
            await expect(page.getByTestId('channel_banner_container')).toHaveCSS(
                'background-color',
                'rgb(221, 221, 221)',
            );
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
    DISPLAY_BANNER_TOP,
    DISPLAY_LABEL_HEADER,
    DISPLAY_LABEL_INFO,
    attributeName,
    createAttribute,
    deleteAttributes,
    optionId,
    purgeAttributes,
    setChannelValue,
} from './helpers';

test.describe('Channel attribute display and editing', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify a designated attribute renders as a header chip and a Channel Info row for a channel member.
     */
    test('shows a designated attribute in the header and Channel Info', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('shown', suffix), {
                options: ['AURORA'],
                actions: [DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO],
                optionColors: {AURORA: '#1e325c'},
            });

            // Stored but undesignated: reaches the data layer, never a chip.
            const hidden = await createAttribute(adminClient, attributeName('undesignated', suffix), {
                options: ['QUIET'],
            });
            created.push(program, hidden);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-display-${suffix}`,
                display_name: `Attr Display ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);

            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, program, optionId(program, 'AURORA'));
            await setChannelValue(adminClient, channel.id, hidden, optionId(hidden, 'QUIET'));

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // Visible to an ordinary member, not just whoever set it.
            const chips = page.getByTestId('attributeChip');
            await expect(chips.filter({hasText: 'AURORA'}).first()).toBeVisible();
            await expect(page.getByText('QUIET')).toHaveCount(0);

            await page.locator('#channel-info-btn').click();
            await expect(page.getByTestId('channelInfoAttributes')).toBeVisible();
            await expect(page.getByTestId(`channelInfoAttributeRow-${program.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelInfoAttributeRow-${hidden.name}`)).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify chips collapse into +N at a narrow viewport without displacing the header controls.
     */
    test('collapses overflowing chips into +N without moving header controls', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-overflow-${suffix}`,
                display_name: `Attr Overflow ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);

            for (let i = 0; i < 5; i++) {
                const field = await createAttribute(adminClient, attributeName(`overflow${i}`, suffix), {
                    options: [`LONG_VALUE_NUMBER_${i}`],
                    actions: [DISPLAY_LABEL_HEADER],
                    sortOrder: i,
                });
                created.push(field);
                await setChannelValue(adminClient, channel.id, field, optionId(field, `LONG_VALUE_NUMBER_${i}`));
            }

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await page.setViewportSize({width: 900, height: 800});
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const infoButton = page.locator('#channel-info-btn');
            const before = await infoButton.boundingBox();

            await expect(page.getByTestId('channelAttributeLabelsOverflow')).toBeVisible();

            // Chips yield space rather than claiming it.
            const after = await infoButton.boundingBox();
            expect(after?.x).toBeCloseTo(before?.x ?? 0, 0);

            await page.getByTestId('channelAttributeLabelsOverflow').click();
            await expect(page.getByTestId('channelAttributeLabelsPopover')).toBeVisible();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a locked attribute renders read-only with its reason, and that the lock key itself is validated server-side.
     *
     * `editable: false` is client-side only — the server validates the key's type
     * but does not reject a write for a locked attribute. The last assertion pins
     * that as current behaviour; invert it if server enforcement lands.
     */
    test('renders a locked attribute read-only and validates the lock key server-side', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

            const locked = await createAttribute(adminClient, attributeName('locked', suffix), {
                options: ['FIXED', 'OTHER'],
                actions: [DISPLAY_LABEL_INFO],
                editable: false,
            });
            created.push(locked);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-locked-${suffix}`,
                display_name: `Attr Locked ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, locked, optionId(locked, 'FIXED'));

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();
            await page.locator('#channel-info-btn').click();

            // Shown with the reason: hiding it looks like a missing marking.
            await expect(page.getByTestId(`channelInfoAttributeRow-${locked.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelInfoAttributeEdit-${locked.name}`)).toHaveCount(0);

            // The key is type-validated, so a truthy string cannot smuggle past it.
            await expect(
                adminClient.patchPropertyField(
                    'access_control',
                    'channel',
                    locked.id,
                    {attrs: {...locked.attrs, editable: 'yes'}} as never,
                ),
            ).rejects.toThrow();

            // Succeeds today: nothing server-side consults the key.
            await setChannelValue(adminClient, channel.id, locked, optionId(locked, 'OTHER'));
            const values = await adminClient.getPropertyValues('access_control', 'channel', channel.id);
            expect(values?.find((value) => value.field_id === locked.id)?.value).toBe(optionId(locked, 'OTHER'));
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify an optional attribute is absent from creation, addable from Channel Info, and produces no chip.
     */
    test('adds an optional attribute from Channel Info', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

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

            await page.locator('#channel-info-btn').click();
            await page.getByTestId('channelInfoAddAttributeButton').click();
            await page.getByText(optional.name, {exact: false}).last().click();

            await page.getByTestId(`channelAttributeEdit-${optional.name}`).click();
            await page.getByText('LATER', {exact: true}).click();

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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

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
     * @objective Verify a user without the setter tier sees values but no editing affordance.
     */
    test('hides editing from a user without the setter tier', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);

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
            await expect(page.getByTestId('channelInfoAddAttributeButton')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify every surface reverts when the feature flag is off.
     */
    test('renders no attribute surfaces with the flag off', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', false);

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
            await expect(page.getByTestId('channelAttributeLabels')).toHaveCount(0);
            await expect(page.getByText('HIDDEN')).toHaveCount(0);

            await page.locator('#channel-info-btn').click();
            await expect(page.getByTestId('channelInfoAttributes')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

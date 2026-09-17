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
    createChannelForAttributes,
    deleteAttributes,
    optionId,
    purgeAttributes,
    setChannelValue,
} from './helpers';

test.describe('Channel attribute display and editing', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify a designated attribute renders in both header slots, and that an
     * undesignated one still reaches the Channel Info panel, read-only, for a channel member.
     */
    test('shows a designated attribute in both header slots and Channel Info', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            const program = await createAttribute(adminClient, attributeName('shown', suffix), {
                options: ['AURORA'],
                actions: [DISPLAY_LABEL_HEADER, DISPLAY_LABEL_INFO],
                optionColors: {AURORA: '#1e325c'},
            });

            // Undesignated: never a chip, but still reachable in Channel Info.
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

            // Visible to an ordinary member, not just whoever set it. Designated for
            // both slots, so it renders in both.
            const {attributes, infoAttributes} = channelsPage.centerView.header;
            await expect(attributes.chip('AURORA')).toBeVisible();
            await expect(infoAttributes.chip('AURORA')).toBeVisible();
            await expect(attributes.chip('QUIET')).toHaveCount(0);
            await expect(infoAttributes.chip('QUIET')).toHaveCount(0);

            // Channel Info lists what the channel holds regardless of display
            // designation -- it is the only surface a value can be edited from, so a
            // display setting must not be able to strand one.
            await page.locator('#channel-info-btn').click();
            await expect(page.getByTestId('channelInfoAttributes')).toBeVisible();
            await expect(page.getByTestId(`channelInfoAttributeRow-${program.name}`)).toBeVisible();
            await expect(page.getByTestId(`channelInfoAttributeRow-${hidden.name}`)).toBeVisible();

            // A member reads, never writes.
            await expect(page.getByTestId(`channelInfoAttributeEdit-${hidden.name}`)).toHaveCount(0);
            await expect(page.getByTestId('channelInfoAddAttributeButton')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a channel admin can reach and fill an attribute that is designated
     * for no display location at all.
     *
     * Channel Info is the only surface a value can be edited from, so gating it on the
     * display locations would leave a required attribute permanently unset with no way to
     * fix it. The panel therefore lists by role, not by designation.
     */
    test('keeps an undesignated required attribute editable in Channel Info for a channel admin', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            // The channel comes first: a required attribute is refused at create time
            // unless the call carries a value for it. Marking an attribute required
            // after the fact is what leaves an existing channel incomplete, which is
            // the case that needs a way out.
            const channel = await createChannelForAttributes(adminClient, team, `nodisplay-${suffix}`);

            const channelAdmin = await pw.createNewUserProfile(adminClient, {prefix: 'chanadmin'});
            await adminClient.addToTeam(team.id, channelAdmin.id);
            await adminClient.addToChannel(channelAdmin.id, channel.id);
            await adminClient.updateChannelMemberSchemeRoles(channel.id, channelAdmin.id, true, true);
            await adminClient.addToChannel(user.id, channel.id);

            const undesignated = await createAttribute(adminClient, attributeName('nodisplay', suffix), {
                options: ['FILLED'],
                actions: [],
                required: true,
            });
            created.push(undesignated);

            // # Look at the incomplete channel as an ordinary member
            const asMember = await pw.testBrowser.login(user);
            await asMember.channelsPage.goto(team.name, channel.name);
            await asMember.channelsPage.toBeVisible();

            // * The member is told nothing: an unset required attribute is not theirs
            // to fix, and an empty row they cannot fill only reads as a broken channel
            await asMember.channelsPage.openChannelInfo();
            await expect(asMember.page.getByTestId(`channelInfoAttributeRow-${undesignated.name}`)).toHaveCount(0);

            // # Look at the same channel as the channel admin
            const {channelsPage} = await pw.testBrowser.login(channelAdmin);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // * No chips on either header slot, because nothing was designated
            await expect(channelsPage.centerView.header.attributes.container).toHaveCount(0);
            await expect(channelsPage.centerView.header.infoAttributes.container).toHaveCount(0);

            // * But the row is there, saying the channel is incomplete, and it can be filled
            const info = await channelsPage.openChannelInfo();
            await expect(info.attributes.unset(undesignated.name)).toBeVisible();
            await info.attributes.select(undesignated.name, 'FILLED');
            await expect(info.attributes.chip(undesignated.name)).toHaveText('FILLED');

            // * And once filled it reaches the member too, still read-only
            const asMemberAgain = await pw.testBrowser.login(user);
            await asMemberAgain.channelsPage.goto(team.name, channel.name);
            await asMemberAgain.channelsPage.toBeVisible();
            const memberInfo = await asMemberAgain.channelsPage.openChannelInfo();
            await expect(memberInfo.attributes.chip(undesignated.name)).toHaveText('FILLED');
            await expect(memberInfo.attributes.editButton(undesignated.name)).toHaveCount(0);
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
            await assertNoForeignRequiredAttributes(adminClient);

            const channel = await adminClient.createChannel({
                team_id: team.id,
                name: `attr-overflow-${suffix}`,
                display_name: `Attr Overflow ${suffix}`,
                type: 'O',
            } as Parameters<typeof adminClient.createChannel>[0]);
            await adminClient.addToChannel(user.id, channel.id);

            for (let i = 0; i < 5; i++) {
                // The inline slot: the one that shares its row with the header controls,
                // so it is the only one where yielding space is an invariant.
                const field = await createAttribute(adminClient, attributeName(`overflow${i}`, suffix), {
                    options: [`LONG_VALUE_NUMBER_${i}`],
                    actions: [DISPLAY_LABEL_INFO],
                    sortOrder: i,
                });
                created.push(field);
                await setChannelValue(adminClient, channel.id, field, optionId(field, `LONG_VALUE_NUMBER_${i}`));
            }

            const {page, channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            const infoButton = page.locator('#channel-info-btn');
            const row = channelsPage.centerView.header.infoAttributes.visibleRow;

            await expect(page.getByTestId('attributeChip').first()).toBeVisible();
            const wideX = (await infoButton.boundingBox())?.x ?? 0;

            // The invariant, at every width: the row never scrolls. A chip clipped by
            // overflow:hidden with no +N beside it is a marking silently hidden.
            // Narrow, but still desktop: below 768px the header switches to the mobile
            // layout and the icon row is not rendered at all.
            await page.setViewportSize({width: 800, height: 800});

            await expect(page.getByTestId('channelAttributeLabelsOverflow-info')).toBeVisible();

            // Fewer chips shown than exist, and the remainder is reachable.
            const shown = await page.getByTestId('attributeChip').count();
            expect(shown).toBeGreaterThan(0);
            expect(shown).toBeLessThan(5);

            // The row yields space rather than claiming it, so the controls after it
            // are not pushed further right as the window narrows.
            const narrowX = (await infoButton.boundingBox())?.x ?? 0;
            expect(narrowX).toBeLessThanOrEqual(wideX);

            // The row is bounded by its container: whatever it cannot show goes to
            // the popover rather than spilling across the header.
            const spill = await row.evaluate((el: HTMLElement) => {
                const parent = el.parentElement!.parentElement!;
                return el.getBoundingClientRect().right - parent.getBoundingClientRect().right;
            });
            expect(spill).toBeLessThanOrEqual(1);

            await page.getByTestId('channelAttributeLabelsOverflow-info').click();
            await expect(page.getByTestId('channelAttributeLabelsPopover-info')).toBeVisible();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a locked attribute renders read-only with its reason, and that the lock is enforced server-side.
     *
     * `editable: false` with no change_policy reads as "never", so the lock is a
     * server-side invariant and not only a hidden pencil.
     */
    test('renders a locked attribute read-only and validates the lock key server-side', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

        const {adminClient, user, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

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
                adminClient.patchPropertyField('access_control', 'channel', locked.id, {
                    attrs: {...locked.attrs, editable: 'yes'},
                } as never),
            ).rejects.toThrow();

            // Refused for a system admin too: the lock is a property of the attribute,
            // not a permission tier.
            await expect(setChannelValue(adminClient, channel.id, locked, optionId(locked, 'OTHER'))).rejects.toThrow();

            const values = await adminClient.getPropertyValues('access_control', 'channel', channel.id);
            expect(values?.find((value) => value.field_id === locked.id)?.value).toBe(optionId(locked, 'FIXED'));
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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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

    /**
     * @objective Verify a text banner attribute banners the channel with the string it stores.
     */
    test('banners a text attribute filled while creating the channel', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
        await pw.skipIfFeatureFlagNotSet('ChannelAttributes', true);

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
            await expect(page.getByTestId('channelAttributeLabels-header')).toHaveCount(0);
            await expect(page.getByTestId('channelAttributeLabels-info')).toHaveCount(0);
            await expect(page.getByText('HIDDEN')).toHaveCount(0);

            await page.locator('#channel-info-btn').click();
            await expect(page.getByTestId('channelInfoAttributes')).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

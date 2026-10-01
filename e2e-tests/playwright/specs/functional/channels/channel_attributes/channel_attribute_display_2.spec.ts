// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
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
        await pw.ensureFeatureFlag('ChannelAttributes', true);
        await pw.ensureFeatureFlag('ChannelAttributesRequired', true);

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

            // * No chips in the header, because nothing was designated
            await expect(channelsPage.centerView.header.attributes.container).toHaveCount(0);

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
        await pw.ensureFeatureFlag('ChannelAttributes', true);

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
            const row = channelsPage.centerView.header.attributes.visibleRow;

            await expect(page.getByTestId('attributeChip').first()).toBeVisible();
            const wideX = (await infoButton.boundingBox())?.x ?? 0;

            // The invariant, at every width: the row never scrolls. A chip clipped by
            // overflow:hidden with no +N beside it is a marking silently hidden.
            // Narrow, but still desktop: below 768px the header switches to the mobile
            // layout and the icon row is not rendered at all.
            await page.setViewportSize({width: 900, height: 800});

            const overflowButton = page.getByTestId('channelAttributeLabelsOverflow-info-header');
            await expect(overflowButton).toBeVisible();

            // The row keeps re-measuring itself for a moment after the resize; wait for
            // the overflow count to settle before reading it or clicking it.
            let lastLabel: string | null = null;
            await expect
                .poll(async () => {
                    const label = await overflowButton.getAttribute('aria-label');
                    const isStable = lastLabel !== null && label === lastLabel;
                    lastLabel = label;
                    return isStable;
                })
                .toBe(true);

            // Fewer chips shown than exist, and the remainder is reachable.
            const shown = await page.getByTestId('attributeChip').count();
            expect(shown).toBeGreaterThan(0);
            expect(shown).toBeLessThan(5);

            // The row yields space rather than claiming it, so the controls after it
            // are not pushed further right as the window narrows.
            const narrowX = (await infoButton.boundingBox())?.x ?? 0;
            expect(narrowX).toBeLessThanOrEqual(wideX);

            // The row is bounded by its container: whatever it cannot show goes to
            // the popover rather than spilling across the header. The overflow
            // count can be stable while the surviving chip is still a frame or two
            // from its final width, so poll rather than reading this once.
            await expect
                .poll(() =>
                    row.evaluate((el: HTMLElement) => {
                        const parent = el.parentElement!.parentElement!;
                        return el.getBoundingClientRect().right - parent.getBoundingClientRect().right;
                    }),
                )
                .toBeLessThanOrEqual(1);

            await overflowButton.click();
            await expect(page.getByTestId('channelAttributeLabelsPopover-info-header')).toBeVisible();
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
        await pw.ensureFeatureFlag('ChannelAttributes', true);

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
});

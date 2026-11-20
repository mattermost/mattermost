// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CollapsedThreads} from '@mattermost/types/config';
import type {PropertyField} from '@mattermost/types/properties';

import {Api, settle, expect, test, DefaultChannel} from '@mattermost/playwright-lib';

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
import {
    add,
    chip,
    labelChip,
    labelChips,
    openAttributeControl,
    openChannel,
    openChannelInfo,
    openGlobalThread,
    openNewChannelModal,
    openOverflow,
    pickListOption,
    row,
    select,
} from './surface';

test.describe('Channel attribute display and editing', {tag: ['@channel_attributes']}, () => {
    test.describe.configure({mode: 'serial'});

    /**
     * @objective Verify a designated attribute renders in both header slots, and that an
     * undesignated one still reaches the Channel Info panel, read-only, for a channel member.
     */
    test('shows a designated attribute in both header slots and Channel Info', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();

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

            const app = await openChannel(pw, user, team, channel);

            // Visible to an ordinary member, not just whoever set it. Undesignated
            // values never become chips.
            const {attributes} = app.channelHeader;
            await expect(await labelChip(attributes, 'AURORA')).toBeVisible();
            await expect(labelChips(attributes, 'QUIET')).toHaveCount(0);

            // Channel Info lists what the channel holds regardless of display
            // designation -- it is the only surface a value can be edited from, so a
            // display setting must not be able to strand one.
            await openChannelInfo(app);
            await expect(app.rhs.channelInfo.about.attributes).toBeVisible();
            await expect(row(app.rhs.channelInfo.about.attributes, program)).toBeVisible();
            await expect(row(app.rhs.channelInfo.about.attributes, hidden)).toBeVisible();

            // A member reads, never writes.
            await expect(row(app.rhs.channelInfo.about.attributes, hidden).editButton).toHaveCount(0);
            await expect(app.rhs.channelInfo.about.attributes.addButton).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a thread carries the channel's header chips whether it is opened
     * from the channel or from the global Threads view.
     *
     * Global Threads never mounts the channel header, so the thread pane is the only
     * thing that can say which channel's markings a reply is about.
     */
    test('shows the channel chips on a thread opened from the channel and from global Threads', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);

            // Global Threads only exists with collapsed reply threads on, and other
            // specs turn it off without putting it back.
            await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: CollapsedThreads.ALWAYS_ON}});

            // One per slot: the thread header merges them, so an info-designated
            // attribute has to reach it too.
            const program = await createAttribute(adminClient, attributeName('threadheader', suffix), {
                options: ['AURORA'],
                actions: [DISPLAY_LABEL_HEADER],
                optionColors: {AURORA: '#1e325c'},
            });
            const caveat = await createAttribute(adminClient, attributeName('threadinfo', suffix), {
                options: ['NOFORN'],
                actions: [DISPLAY_LABEL_INFO],
            });
            created.push(program, caveat);

            const channel = await createChannelForAttributes(adminClient, team, `thread-${suffix}`);
            await adminClient.addToChannel(user.id, channel.id);
            await setChannelValue(adminClient, channel.id, program, optionId(program, 'AURORA'));
            await setChannelValue(adminClient, channel.id, caveat, optionId(caveat, 'NOFORN'));

            // Authored by the viewer, so the thread is followed and appears in Threads.
            const root = await userClient.createPost({
                channel_id: channel.id,
                message: `Root ${suffix}`,
            });
            await userClient.createPost({
                channel_id: channel.id,
                root_id: root.id,
                message: 'Reply',
            });

            const app = await openChannel(pw, user, team, channel);

            // # Open the thread from the channel
            const post = app.center.postList.post(root);
            await post.container.hover();
            await post.menu.replyButton.clickTo(app.rhs.thread.post(root).container);
            const threadAttributes = app.rhs.thread.header.attributes;

            // * Both chips are on the thread header, scoped to the thread chrome since
            // the channel header behind it carries the same merged row
            await expect(await labelChip(threadAttributes, 'AURORA')).toBeVisible();
            await expect(await labelChip(threadAttributes, 'NOFORN')).toBeVisible();

            // # Open the same thread from global Threads, which never mounts the channel header
            const {threads} = await openGlobalThread(app, team, root);

            // * The chips follow the thread rather than the view it was opened from, and
            // the channel name they belong to is still legible beside them
            await expect(threads.pane.channelButton).toContainText(channel.display_name);
            await expect(await labelChip(threads.pane.attributes, 'AURORA')).toBeVisible();
            await expect(await labelChip(threads.pane.attributes, 'NOFORN')).toBeVisible();

            // * Here they are labels only: Channel Info is bound to the channel being
            // viewed, and this route has none, so a chip must not open a panel that
            // would sit there loading forever
            // The label has a click handler without an interactive role.
            await (await labelChip(threads.pane.attributes, 'AURORA')).click();
            await expect(app.rhs.channelInfo.header).toHaveCount(0);
            await expect(await labelChip(threads.pane.attributes, 'AURORA')).toBeVisible();
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify the thread header chips collapse into +N rather than displacing the
     * thread controls when the pane is narrow.
     *
     * The thread header is one 56px row shared with Follow and the popout controls, so it
     * is tighter than the channel header the same component also renders in.
     *
     * @knownIssue useLabelsOverflow's availableWidthForLabels only measures the width of the
     * chip row's own flex box (its closest .channel-header__title, or else its parentElement).
     * In the thread pane, Header renders `heading` (back button, title, chips) and `right`
     * (Follow, popout, menu) as two independent flex children, so the chip row's parent box
     * has no idea how much room `right` actually needs; it only sees the siblings inside its
     * own `heading` box. At 900px wide the hook believes there is still ~880px available and
     * keeps 4 of 5 chips visible, so the row's right edge (879px) lands well past the Follow
     * button's left edge (745px) instead of yielding to it. Fixing this needs the hook to
     * measure against the Header's overall row, not just the chip row's own flex ancestor.
     */
    test.fixme('collapses the thread header chips into +N without moving the thread controls', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        const {adminClient, user, userClient, team} = await pw.initSetup();
        const suffix = pw.random.id();
        const created: PropertyField[] = [];

        try {
            await purgeAttributes(adminClient);
            await assertNoForeignRequiredAttributes(adminClient);
            await adminClient.patchConfig({ServiceSettings: {CollapsedThreads: CollapsedThreads.ALWAYS_ON}});

            const channel = await createChannelForAttributes(adminClient, team, `threadoverflow-${suffix}`);
            await adminClient.addToChannel(user.id, channel.id);

            for (let i = 0; i < 5; i++) {
                const field = await createAttribute(adminClient, attributeName(`threadoverflow${i}`, suffix), {
                    options: [`LONG_VALUE_NUMBER_${i}`],
                    actions: [DISPLAY_LABEL_HEADER],
                    sortOrder: i,
                });
                created.push(field);
                await setChannelValue(adminClient, channel.id, field, optionId(field, `LONG_VALUE_NUMBER_${i}`));
            }

            const root = await userClient.createPost({
                channel_id: channel.id,
                message: `Root ${suffix}`,
            });
            await userClient.createPost({
                channel_id: channel.id,
                root_id: root.id,
                message: 'Reply',
            });

            const {app} = await pw.testBrowser.login(user);
            const {threads} = await openGlobalThread(app, team, root);
            const labels = threads.pane.attributes;

            await expect(await labels.chipList.first()).toBeVisible();

            // # Narrow the window, staying above the mobile breakpoint
            await app.page.setViewportSize({width: 900, height: 800});

            // * Whatever no longer fits is reachable through +N instead of being clipped
            await expect(labels.overflowButton).toBeVisible();
            await expect
                .poll(() => labels.chipList.locator.count(), {
                    message: 'the narrow header should move some chips into +N',
                })
                .toBeLessThan(5);

            // * The row yields to the thread controls rather than growing over them,
            // which is the invariant the 56px header slot has to hold
            const follow = threads.pane.followButton.locator;
            await expect(follow).toBeVisible();
            const rowRight = await labels.locator.evaluate((row: HTMLElement) => row.getBoundingClientRect().right);
            const controlsLeft = await follow.evaluate((control: HTMLElement) => control.getBoundingClientRect().left);
            expect(rowRight).toBeLessThanOrEqual(controlsLeft);

            const paneRight = app.page.viewportSize()!.width;
            const controlsRight = await follow.evaluate(
                (control: HTMLElement) => control.getBoundingClientRect().right,
            );
            expect(controlsRight).toBeLessThanOrEqual(paneRight);

            const popover = await openOverflow(labels);
            await expect(popover).toContainText('LONG_VALUE_NUMBER_4');
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
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
        // required: true below needs the kill switch on; the server refuses to mark
        // any field required while it is off (model.IsChannelAttributesRequiredEnabled).
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
            const asMember = await openChannel(pw, user, team, channel);

            // * The member is told nothing: an unset required attribute is not theirs
            // to fix, and an empty row they cannot fill only reads as a broken channel
            const memberAttributes = await openChannelInfo(asMember);
            await expect(asMember.rhs.channelInfo.header).toBeVisible();
            await expect(row(memberAttributes, undesignated)).toHaveCount(0);

            // # Look at the same channel as the channel admin
            const app = await openChannel(pw, channelAdmin, team, channel);

            // * No chips in the header, because nothing was designated
            await expect(app.channelHeader.attributes).toHaveCount(0);

            // * But the row is there, saying the channel is incomplete, and it can be filled
            const info = {attributes: await openChannelInfo(app)};
            await expect(row(info.attributes, undesignated).unsetText).toBeVisible();
            await select(app, info.attributes, undesignated, 'FILLED');
            await expect(await chip(info.attributes, undesignated)).toHaveText('FILLED');

            // * And once filled it reaches the member too, still read-only
            const asMemberAgain = await openChannel(pw, user, team, channel);
            const memberInfo = {attributes: await openChannelInfo(asMemberAgain)};
            await expect(await chip(memberInfo.attributes, undesignated)).toHaveText('FILLED');
            await expect(row(memberInfo.attributes, undesignated).editButton).toHaveCount(0);
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify chips collapse into +N at a narrow viewport without displacing the header controls.
     *
     * @knownIssue At this width, .channel-header__icons shrinks (via its deliberate min-width:0,
     * see use_labels_overflow.ts) to less room than its own non-shrinking children (the Members,
     * Channel files, and plugin icon buttons) require on their own -- their combined width alone
     * (~99px) already exceeds the box flexbox gives .channel-header__icons (~87px) at this
     * viewport. ChannelAttributeLabels is the only child allowed to shrink, so flexbox collapses
     * it to 0 width and positions it right after the fixed buttons -- past .channel-header__icons'
     * own right edge by the ~12px shortfall. useLabelsOverflow still forces one visible chip plus
     * the +N button in this surface (allowEmptyVisible is false here), so that forced content
     * renders outside the icons box instead of being clipped away, which is the spill this test
     * catches. A fix needs either availableWidthForLabels to detect when even one chip has no
     * real room left here and collapse to empty, or the icons/chip-row CSS reworked so a
     * zero-width chip container cannot push its content past its own bounds.
     */
    test.fixme('collapses overflowing chips into +N without moving header controls', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
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
                // The chip strip shares its row with the header controls, so yielding
                // space rather than pushing them is the invariant under test.
                const field = await createAttribute(adminClient, attributeName(`overflow${i}`, suffix), {
                    options: [`LONG_VALUE_NUMBER_${i}`],
                    actions: [DISPLAY_LABEL_INFO],
                    sortOrder: i,
                });
                created.push(field);
                await setChannelValue(adminClient, channel.id, field, optionId(field, `LONG_VALUE_NUMBER_${i}`));
            }

            const app = await openChannel(pw, user, team, channel);

            const infoButton = app.channelHeader.infoButton.locator;
            const labels = app.channelHeader.attributes;

            await expect(await labels.chipList.first()).toBeVisible();
            const wideX = (await infoButton.boundingBox())?.x ?? 0;

            // The invariant, at every width: the row never scrolls. A chip clipped by
            // overflow:hidden with no +N beside it is a marking silently hidden.
            // Narrow, but still desktop: below 768px the header switches to the mobile
            // layout and the icon row is not rendered at all.
            await app.page.setViewportSize({width: 800, height: 800});

            await expect(labels.overflowButton).toBeVisible();

            // Fewer chips shown than exist, and the remainder is reachable. Polled:
            // the strip re-measures after the resize.
            const visibleChips = labels.chipList.locator;
            await expect.poll(() => visibleChips.count()).toBeLessThan(5);
            await expect.poll(() => visibleChips.count()).toBeGreaterThan(0);

            // The row yields space rather than claiming it, so the controls after it
            // are not pushed further right as the window narrows.
            const narrowX = (await infoButton.boundingBox())?.x ?? 0;
            expect(narrowX).toBeLessThanOrEqual(wideX);

            // The row is bounded by its container: whatever it cannot show goes to
            // the popover rather than spilling across the header.
            const spill = await labels.locator.evaluate((el: HTMLElement) => {
                const parent = el.parentElement!;
                return el.getBoundingClientRect().right - parent.getBoundingClientRect().right;
            });
            expect(spill).toBeLessThanOrEqual(1);

            await openOverflow(labels);
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
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
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

            const app = await openChannel(pw, user, team, channel);
            await openChannelInfo(app);

            // Shown with the reason: hiding it looks like a missing marking.
            await expect(row(app.rhs.channelInfo.about.attributes, locked)).toBeVisible();
            await expect(row(app.rhs.channelInfo.about.attributes, locked).editButton).toHaveCount(0);

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
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
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

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const modal = await openNewChannelModal(app);
            const displayName = `Attr Optional ${suffix}`;
            await modal.name.container.fill(displayName);

            // Optional attributes are not asked for at creation.
            await expect(modal.name.container).toHaveValue(displayName);
            await expect(modal.attributes.attribute(optional)).toHaveCount(0);

            await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
            await expect(modal).not.toBeVisible();

            const info = {attributes: await openChannelInfo(app)};
            await add(app, info.attributes, optional, 'LATER');

            await expect(row(app.rhs.channelInfo.about.attributes, optional)).toContainText('LATER');

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
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
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

            const app = await openChannel(pw, user, team, channel);

            // Falls back to the value name, reproducing today's classification banner.
            await expect(app.center.channelBanner.textText).toContainText('RESTRICTED');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a multiselect banner attribute set at channel creation banners the new channel immediately.
     */
    test('banners a multiselect attribute filled while creating the channel', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
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

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const modal = await openNewChannelModal(app);
            await modal.name.container.fill(`Attr Banner Multi ${suffix}`);
            await expect(modal.name.container).toHaveValue(`Attr Banner Multi ${suffix}`);

            // The menu closes on each pick, so the second value needs it reopened.
            await openAttributeControl(modal, caveats);
            await pickListOption(app, 'NOFORN');
            await openAttributeControl(modal, caveats);
            await pickListOption(app, 'ORCON');

            await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
            await expect(modal).not.toBeVisible();

            // No reload, no Channel Settings visit: creation alone has to banner it.
            await expect(app.center.channelBanner.textText).toContainText('NOFORN, ORCON');

            // Selections may each carry a different colour, so none of them wins and
            // the banner falls back rather than rendering transparent.
            await expect(app.center.channelBanner).toHaveCSS('background-color', 'rgb(221, 221, 221)');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a text banner attribute banners the channel with the string it stores.
     */
    test('banners a text attribute filled while creating the channel', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
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

            const app = await openChannel(pw, user, team, {name: DefaultChannel.TownSquare});
            const modal = await openNewChannelModal(app);
            await modal.name.container.fill(`Attr Banner Text ${suffix}`);
            await modal.attributes.attribute(note).valueInput.container.fill('HANDLE WITH CARE');

            await settle(modal.confirmButton, {wait: Api.CreateChannel}).click();
            await expect(modal).not.toBeVisible();

            // A text attribute has no options, so the stored string is the banner.
            await expect(app.center.channelBanner.textText).toContainText('HANDLE WITH CARE');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });

    /**
     * @objective Verify a user without the setter tier sees values but no editing affordance.
     */
    test('hides editing from a user without the setter tier', async ({pw}) => {
        await pw.ensureFeatureFlag({ChannelAttributes: true, ChannelAttributesRequired: true});
        await pw.skipIfNoLicense();
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

            const app = await openChannel(pw, user, team, channel);
            await openChannelInfo(app);

            await expect(row(app.rhs.channelInfo.about.attributes, adminOnly)).toContainText('SET');
            await expect(row(app.rhs.channelInfo.about.attributes, adminOnly).editButton).toHaveCount(0);

            // Asserted per attribute rather than on the button as a whole: the button
            // is shared, so any other attribute this user *can* set would keep it on
            // screen and say nothing about this one.
            const addButton = app.rhs.channelInfo.about.attributes.addButton.locator;
            if (await addButton.count()) {
                await addButton.click();
                await expect(app.rhs.channelInfo.about.attributes.addMenu.attribute(adminOnly)).toHaveCount(0);
            }
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {CollapsedThreads} from '@mattermost/types/config';
import type {PropertyField} from '@mattermost/types/properties';

import {expect, test} from '@mattermost/playwright-lib';

import {
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
    /**
     * @objective Verify a designated attribute renders in the channel header, and that an
     * undesignated one still reaches the Channel Info panel, read-only, for a channel member.
     */
    test('shows a designated attribute in the header and Channel Info', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

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

            // Visible to an ordinary member, not just whoever set it.
            const {attributes} = channelsPage.centerView.header;
            await expect(attributes.chip('AURORA')).toBeVisible();
            await expect(attributes.chip('QUIET')).toHaveCount(0);

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
     * @objective Verify a thread carries the channel's header chips whether it is opened
     * from the channel or from the global Threads view.
     *
     * Global Threads never mounts the channel header, so the thread pane is the only
     * thing that can say which channel's markings a reply is about.
     */
    test('shows the channel chips on a thread opened from the channel and from global Threads', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

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

            const {page, channelsPage, threadsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, channel.name);
            await channelsPage.toBeVisible();

            // # Open the thread from the channel
            const post = await channelsPage.centerView.getLastPost();
            await post.reply();
            await channelsPage.sidebarRight.toBeVisible();

            // * Both chips are on the thread header, scoped to the thread chrome since
            // the channel header behind it carries the same merged row
            await expect(channelsPage.sidebarRight.threadAttributes.chip('AURORA')).toBeVisible();
            await expect(channelsPage.sidebarRight.threadAttributes.chip('NOFORN')).toBeVisible();

            // # Open the same thread from global Threads, which never mounts the channel header
            await threadsPage.goto(team.name);
            await threadsPage.toBeVisible();
            await threadsPage.selectThread(`Root ${suffix}`);

            // * The chips follow the thread rather than the view it was opened from, and
            // the channel name they belong to is still legible beside them
            await expect(threadsPage.threadPane).toContainText(channel.display_name);
            await expect(threadsPage.attributes.chip('AURORA')).toBeVisible();
            await expect(threadsPage.attributes.chip('NOFORN')).toBeVisible();

            // * Here they are labels only: Channel Info is bound to the channel being
            // viewed, and this route has none, so a chip must not open a panel that
            // would sit there loading forever
            await threadsPage.attributes.chip('AURORA').click();
            await expect(page.locator('#sidebar-right')).toHaveCount(0);
            await expect(threadsPage.attributes.chip('AURORA')).toBeVisible();
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
     */
    test('collapses the thread header chips into +N without moving the thread controls', async ({pw}) => {
        await pw.skipIfNoLicense();
        await pw.ensureFeatureFlag('ChannelAttributes', true);

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

            const {page, threadsPage} = await pw.testBrowser.login(user);
            await threadsPage.goto(team.name);
            await threadsPage.toBeVisible();
            await threadsPage.selectThread(`Root ${suffix}`);

            await expect(threadsPage.attributes.chips.first()).toBeVisible();

            // # Narrow the window, staying above the mobile breakpoint
            await page.setViewportSize({width: 900, height: 800});

            // * Whatever no longer fits is reachable through +N instead of being clipped
            const overflowButton = threadsPage.attributes.overflowButton;
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

            expect(await threadsPage.attributes.chips.count()).toBeLessThan(5);

            // * The row yields to the thread controls rather than growing over them,
            // which is the invariant the 56px header slot has to hold
            await expect(threadsPage.followButton).toBeVisible();
            const rowRight = await threadsPage.attributes.container.evaluate(
                (row: HTMLElement) => row.getBoundingClientRect().right,
            );
            const controlsLeft = await threadsPage.followButton.evaluate(
                (control: HTMLElement) => control.getBoundingClientRect().left,
            );
            expect(rowRight).toBeLessThanOrEqual(controlsLeft);

            const paneRight = await threadsPage.threadPane.evaluate(
                (pane: HTMLElement) => pane.getBoundingClientRect().right,
            );
            const controlsRight = await threadsPage.followButton.evaluate(
                (control: HTMLElement) => control.getBoundingClientRect().right,
            );
            expect(controlsRight).toBeLessThanOrEqual(paneRight);

            const popover = await threadsPage.attributes.openOverflow();
            await expect(popover).toContainText('LONG_VALUE_NUMBER_4');
        } finally {
            await deleteAttributes(adminClient, created);
        }
    });
});

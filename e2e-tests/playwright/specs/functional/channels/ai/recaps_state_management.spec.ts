// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {createRecapAndWaitForStatus, createUnreadChannelFixture, setupRecapBridge} from './support';

/**
 * @objective Verify marking a recap as read moves it from the Unread tab to the Read tab
 */
test('moves a recap from unread to read when marked read', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Read state recap ${pw.random.id()}`;
    const recapHighlight = `Read state highlight ${pw.random.id()}`;
    const sourceMessage = `Read state source ${pw.random.id()}`;

    // # Initialize the test server state, configure the recap bridge, and seed a completed recap for the user.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            pw.recapCompletion({
                highlights: [recapHighlight],
                actionItems: [],
            }),
        ],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Read state channel',
        sourceMessage,
    );
    await createRecapAndWaitForStatus(pw, userClient, recapTitle, [channel.id], agent.id, 'completed');

    // # Open the unread recap and mark it as read from the recap card.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const unreadRecap = recapsPage.getRecap(recapTitle);
    await unreadRecap.toBeVisible();
    await unreadRecap.clickMarkRead();

    // * Verify the recap disappears from the Unread tab and appears in the Read tab with the inline Mark read button removed.
    await recapsPage.expectRecapNotVisible(recapTitle);
    await recapsPage.switchToRead();

    const readRecap = recapsPage.getRecap(recapTitle);
    await readRecap.toBeVisible();
    await expect(readRecap.markReadButton).not.toBeVisible();
    await expect(readRecap.menuButton).toBeVisible();
});

/**
 * @objective Verify deleting a recap removes it from the recaps list
 */
test('deletes a recap from the recaps page', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Delete recap ${pw.random.id()}`;
    const recapHighlight = `Delete recap highlight ${pw.random.id()}`;
    const sourceMessage = `Delete recap source ${pw.random.id()}`;

    // # Initialize the test server state, configure the recap bridge, and seed a completed recap for the user.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            pw.recapCompletion({
                highlights: [recapHighlight],
                actionItems: [],
            }),
        ],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Delete recap channel',
        sourceMessage,
    );
    await createRecapAndWaitForStatus(pw, userClient, recapTitle, [channel.id], agent.id, 'completed');

    // # Open the recap, trigger the delete action, and confirm the delete modal.
    const {recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const recap = recapsPage.getRecap(recapTitle);
    await recap.toBeVisible();
    await recap.clickDelete();
    await recapsPage.confirmDelete();

    // * Verify the recap disappears from the list and the page returns to the setup placeholder.
    await recapsPage.expectRecapNotVisible(recapTitle);
    await recapsPage.expectSetupPlaceholder();
});

/**
 * @objective Verify recap channel card actions can mark a source channel as read and navigate back into that channel
 */
test('executes recap channel card actions', {tag: '@ai_recaps'}, async ({pw}) => {
    const recapTitle = `Channel actions recap ${pw.random.id()}`;
    const recapHighlight = `Channel action highlight ${pw.random.id()}`;
    const sourceMessage = `Channel action source ${pw.random.id()}`;

    // # Initialize the test server state, configure the recap bridge, and seed a completed recap with one unread channel.
    const {adminClient, adminUser, team, user, userClient} = await pw.initSetup();
    if (!adminUser) {
        throw new Error('Failed to create admin user');
    }

    const {agent} = await setupRecapBridge(pw, adminClient, {
        completions: [
            pw.recapCompletion({
                highlights: [recapHighlight],
                actionItems: [],
            }),
        ],
    });

    const channel = await createUnreadChannelFixture(
        pw,
        adminClient,
        adminUser.id,
        user.id,
        team.id,
        'Channel action recap',
        sourceMessage,
    );
    await createRecapAndWaitForStatus(pw, userClient, recapTitle, [channel.id], agent.id, 'completed');

    // # Open the recap, mark the recap channel as read from the channel card, and then navigate back into the source channel.
    const {page, recapsPage} = await pw.testBrowser.login(user);
    await recapsPage.goto(team.name);
    await recapsPage.toBeVisible();

    const recap = recapsPage.getRecap(recapTitle);
    await recap.expand();

    const recapChannelCard = recap.getChannelCard(channel.display_name);
    await recapChannelCard.toBeVisible();
    await recapChannelCard.openMenuAction('Mark this channel as read');

    // * Verify the recap channel read action clears the unread count for the summarized channel.
    await pw.waitUntil(
        async () => {
            const channelMember = await userClient.getMyChannelMember(channel.id);
            return channelMember.mention_count === 0;
        },
        {timeout: pw.duration.one_min},
    );

    // # Use the channel card to navigate back into the original channel.
    await recapChannelCard.clickChannelName();

    // * Verify the user lands back in the source channel route.
    await expect(page).toHaveURL(new RegExp(`/${team.name}/channels/${channel.name}$`));
});

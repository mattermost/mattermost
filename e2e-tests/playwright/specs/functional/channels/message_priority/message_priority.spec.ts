// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {ChannelsPage, PlaywrightExtended, PriorityOption} from '@mattermost/playwright-lib';

async function verifyPostedMessage(channelsPage: ChannelsPage, message: string) {
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toBeVisible();
    await lastPost.toContainText(message);
    return lastPost;
}

async function openThreadAndGetRootPost(channelsPage: ChannelsPage, postId: string) {
    const lastPost = await channelsPage.getLastPost();
    await lastPost.reply();
    await channelsPage.sidebarRight.toBeVisible();
    return channelsPage.sidebarRight.getPostById(postId);
}

async function postWithPriorityAndVerify(pw: PlaywrightExtended, priority: Exclude<PriorityOption, 'Standard'>) {
    // # Setup test environment
    const {user, team} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Open priority menu
    await channelsPage.centerView.postCreate.openPriorityMenu();

    // * Verify priority dialog appears
    await channelsPage.messagePriority.verifyPriorityDialog();

    // # Select the requested priority
    await channelsPage.messagePriority.selectPriority(priority);

    if (priority === 'Urgent') {
        // * Verify persistent notifications are offered only for urgent messages
        await expect(channelsPage.messagePriority.persistentNotificationsToggle).toBeVisible();
    } else {
        await expect(channelsPage.messagePriority.persistentNotificationsToggle).not.toBeVisible();
    }

    // # Apply the selected priority
    await channelsPage.messagePriority.apply();

    // * Verify the composer shows the selected priority label
    await channelsPage.messagePriority.verifyPriorityLabel(channelsPage.centerView.postCreate.container, priority);

    // # Post a message with the selected priority
    const testMessage = `${priority} priority ${pw.random.id()}`;
    await channelsPage.postMessage(testMessage);

    // * Verify the posted message shows the priority label
    const lastPost = await verifyPostedMessage(channelsPage, testMessage);
    await channelsPage.messagePriority.verifyPriorityLabel(lastPost.container, priority);

    // # Open post in right-hand sidebar
    const postId = await lastPost.getId();
    const rhsPost = await openThreadAndGetRootPost(channelsPage, postId);

    // * Verify the priority label also appears in the thread view
    await rhsPost.toBeVisible();
    await rhsPost.toContainText(testMessage);
    await channelsPage.messagePriority.verifyPriorityLabel(rhsPost.container, priority);

    // * Verify RHS formatting bar doesn't include priority button
    await expect(channelsPage.sidebarRight.postCreate.priorityButton).not.toBeVisible();
}

/**
 * @objective Verify that standard message priority is the default, posts without a priority
 * label, and that replies cannot set priority.
 */
test(
    'MM-T5139_1 posts message with standard priority and verifies no priority labels appear',
    {tag: ['@smoke', '@message_priority']},
    async ({pw}) => {
        // # Setup test environment
        const {user, team} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Visit default channel page
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // * Verify the priority control is available while the system setting is enabled
        await expect(channelsPage.centerView.postCreate.priorityButton).toBeVisible();

        // # Open priority menu
        await channelsPage.centerView.postCreate.openPriorityMenu();

        // * Verify priority dialog appears with standard option selected
        await channelsPage.messagePriority.verifyPriorityDialog();
        await channelsPage.messagePriority.verifyStandardPrioritySelected();

        // # Close priority menu
        await channelsPage.messagePriority.closePriorityMenu();

        // # Post a message with standard priority
        const testMessage = `Standard priority ${pw.random.id()}`;
        await channelsPage.postMessage(testMessage);

        // * Verify message posts correctly with no priority label
        const lastPost = await verifyPostedMessage(channelsPage, testMessage);
        await channelsPage.messagePriority.verifyNoPriorityLabelIn(lastPost.container);

        // # Open post in right-hand sidebar
        const postId = await lastPost.getId();
        const rhsPost = await openThreadAndGetRootPost(channelsPage, postId);

        // * Verify post content appears correctly in RHS without a priority label
        await rhsPost.toBeVisible();
        await rhsPost.toContainText(testMessage);
        await channelsPage.messagePriority.verifyNoPriorityLabelIn(rhsPost.container);

        // * Verify RHS formatting bar doesn't include priority button
        await expect(channelsPage.sidebarRight.postCreate.priorityButton).not.toBeVisible();
    },
);

/**
 * @objective Verify that disabling the Message Priority system setting hides the priority control.
 */
test(
    'MM-T5139_2 hides the priority control when the Message Priority system setting is disabled',
    {tag: '@message_priority'},
    async ({pw}) => {
        // # Setup test environment
        const {user, team, adminClient} = await pw.initSetup();
        const originalPostPriority = (await adminClient.getConfig()).ServiceSettings.PostPriority;

        try {
            // # Disable Message Priority in system settings
            await adminClient.patchConfig({ServiceSettings: {PostPriority: false}});

            // # Log in as a user after the setting is disabled
            const {channelsPage} = await pw.testBrowser.login(user);
            await channelsPage.goto(team.name, 'town-square');
            await channelsPage.toBeVisible();

            // * Verify the priority control is hidden
            await expect(channelsPage.centerView.postCreate.priorityButton).not.toBeVisible();
        } finally {
            await adminClient.patchConfig({ServiceSettings: {PostPriority: originalPostPriority}});
        }
    },
);

/**
 * @objective Verify that Important priority can be selected, appears on the composer, and
 * labels the posted message in the center channel and thread view.
 */
test(
    'MM-T5140 posts message with important priority and shows the Important label',
    {tag: '@message_priority'},
    async ({pw}) => {
        // # Select Important priority, post a message, and verify the label
        // * Verify the Important label appears in the composer, center channel, and RHS
        await postWithPriorityAndVerify(pw, 'Important');
    },
);

/**
 * @objective Verify that Urgent priority can be selected, offers persistent notifications,
 * and labels the posted message in the center channel and thread view.
 */
test(
    'MM-T5142 posts message with urgent priority and shows the Urgent label',
    {tag: '@message_priority'},
    async ({pw}) => {
        // # Select Urgent priority, post a message, and verify the label
        // * Verify the Urgent label appears in the composer, center channel, and RHS
        await postWithPriorityAndVerify(pw, 'Urgent');
    },
);

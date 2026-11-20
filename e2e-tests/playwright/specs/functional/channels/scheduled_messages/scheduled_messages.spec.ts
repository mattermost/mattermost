// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, settle, test, type App} from '@mattermost/playwright-lib';

import {expectIndicator, expectScheduledPost, expectSidebarCount, pickTime, scheduleMessage} from './support';

test.beforeEach(async ({pw}) => {
    // Ensure license but skip test if no license which is required for "Scheduled Drafts"
    await pw.ensureLicense();
    await pw.skipIfNoLicense();
});

type Post = ReturnType<App['center']['postList']['post']>;
type ScheduledPost = ReturnType<App['drafts']['scheduled']['post']>;

/** The center channel's last post, once the list has one. */
async function lastCenterPost(app: App): Promise<Post> {
    const {postList} = app.center;
    await expect.poll(async () => (await postList.postList.keys()).length).toBeGreaterThan(0);
    return postList.post({id: (await postList.postList.keys()).at(-1)!});
}

/** Sends a message from a composer. */
async function send(composer: App['center']['postCreate'] | App['rhs']['postCreate'], message: string) {
    await composer.message.container.fill(message);
    await settle(composer.sendButton, {wait: Api.CreatePost}).click();
}

/**
 * Sends a scheduled post now from its row and confirms the dialog. The dialog is the shared confirm dialog, which has
 * no test id of its own, so it is found by its accessible name.
 */
async function sendNow(app: App, post: ScheduledPost) {
    await post.container.hover();
    await post.sendNowButton.click();
    const dialog = app.page.getByRole('dialog', {name: 'Send message now'});
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', {name: 'Yes, send now'}).click();
    await expect(dialog).not.toBeVisible();
}

/** Follows a link to the scheduled posts page. */
async function openScheduledPosts(app: App, link: {click(): Promise<void>}) {
    await link.click();
    await expect(app.page).toHaveURL(/.*scheduled_posts/);
}

/**
 * @objective Verify the ability to create a scheduled message from a channel.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test.fixme(
    'MM-T5643_1 creates scheduled message from channel and posts at scheduled time',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        // Set test timeout to 4 mins to wait for the scheduled message to be sent
        // which is expected within 2 mins.
        test.setTimeout(pw.duration.four_min);

        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a scheduled message with short delay
        const scheduled = await scheduleMessage(app, app.center.postCreate, draftMessage, 0, 1);

        // * Verify scheduled post indicator shows correct date and time
        await expectIndicator(app.center.postCreate.scheduledPostIndicator, scheduled);

        // * Verify scheduled post badge in left sidebar shows count of 1
        await expectSidebarCount(app, 1);

        // # Navigate to scheduled posts page via "See all" link
        await openScheduledPosts(app, app.center.postCreate.scheduledPostIndicator.seeAllLink);

        // * Verify scheduled post appears with correct information
        await expectScheduledPost(app, {...scheduled, message: draftMessage, count: 1});

        // # Return to the channels page
        await app.page.goBack();

        // * Verify scheduled message was posted successfully
        await expect
            .poll(async () => (await lastCenterPost(app)).message.container.text(), {timeout: pw.duration.two_min})
            .toContain(draftMessage);

        // * Verify scheduled indicators are removed after posting
        await expect(app.center.postCreate.scheduledPostIndicator.container).not.toBeVisible();
        await expect(app.lhs.drafts.scheduledPostBadgeText).not.toBeVisible();
    },
);

/**
 * @objective Verify that a weekly recurring scheduled message does not pin the channel indicator above the composer.
 *
 * @precondition
 * A test server with valid license and the RecurringScheduledPosts feature flag enabled
 */
test(
    'creates weekly recurring scheduled message from channel without showing the channel indicator',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        await pw.ensureFeatureFlag('RecurringScheduledPosts', true);

        const draftMessage = `Weekly Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a weekly recurring scheduled message for tomorrow
        const scheduled = await scheduleMessage(app, app.center.postCreate, draftMessage, 1, 0, true);

        // * Verify scheduled post badge appears with count of 1
        await expectSidebarCount(app, 1);

        // * Verify the channel indicator stays hidden since every scheduled post is recurring
        await expect(app.center.postCreate.scheduledPostIndicator.container).not.toBeVisible();

        // # Navigate to scheduled posts page
        await app.scheduledPostsPage.goto({team});

        // * Verify scheduled post appears with recurring weekly details
        const scheduledPost = await expectScheduledPost(app, {
            ...scheduled,
            message: draftMessage,
            count: 1,
            repeatWeekly: true,
        });

        // * Verify one-time send now control is not available for recurring scheduled posts
        await expect(scheduledPost.sendNowButton).toHaveCount(0);
    },
);

/**
 * @objective Verify the ability to create a scheduled message in a thread.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5643_6 creates scheduled message in thread and posts in thread conversation',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Threaded Message ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a root message in the channel
        await send(app.center.postCreate, 'Root Message');
        const root = await lastCenterPost(app);
        await expect(root.message.container).toContainText('Root Message');

        // # Start a thread by replying to the message
        await root.container.hover();
        await root.menu.replyButton.clickTo(app.rhs.postCreate);
        await send(app.rhs.postCreate, 'Replying to a thread');
        await expect(app.rhs.thread.postList).toHaveKeyCount(2);

        // # Create a scheduled message within the thread
        const scheduled = await scheduleMessage(app, app.rhs.postCreate, draftMessage, 1);

        // * Verify scheduled post indicator shows correct date and time
        await expectIndicator(app.rhs.postCreate.scheduledPostIndicator, scheduled);

        // # Navigate to scheduled posts page using indicator link
        await openScheduledPosts(app, app.rhs.postCreate.scheduledPostIndicator.seeAllLink);

        // * Verify scheduled post appears with correct information
        const scheduledPost = await expectScheduledPost(app, {...scheduled, message: draftMessage, count: 1});

        // # Send the scheduled message immediately
        await sendNow(app, scheduledPost);

        // * Verify message is posted in the thread
        await expect(app.rhs.postCreate).toBeVisible();
        await expect(app.rhs.thread.postList).toHaveKeyCount(3);
        await expect((await app.rhs.thread.postList.last()).message.container).toContainText(draftMessage);

        // * Verify all scheduled message indicators are removed
        await expect(app.rhs.postCreate.scheduledPostIndicator.container).not.toBeVisible();
        await expect(app.drafts.scheduled.postList).toHaveKeyCount(0);
        await expect(app.drafts.tabs.scheduledCountText).not.toBeVisible();
        await expect(app.lhs.drafts.scheduledPostBadgeText).not.toBeVisible();
    },
);

/**
 * @objective Verify the ability to reschedule a scheduled message.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5644_2 reschedules message to a future date from scheduled posts page',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a scheduled message for tomorrow
        const scheduled = await scheduleMessage(app, app.center.postCreate, draftMessage, 1);

        // * Verify scheduled message indicator shows correct date and time
        await expectIndicator(app.center.postCreate.scheduledPostIndicator, scheduled);

        // * Verify scheduled post badge appears with count of 1
        await expectSidebarCount(app, 1);

        // # Navigate to scheduled posts page via indicator link
        await openScheduledPosts(app, app.center.postCreate.scheduledPostIndicator.seeAllLink);

        // * Verify scheduled post appears with correct information
        const scheduledPost = await expectScheduledPost(app, {...scheduled, message: draftMessage, count: 1});

        // # Reschedule the message to a different date (2 days from now)
        await scheduledPost.container.hover();
        const modal = await scheduledPost.rescheduleButton.clickTo(app.dateTimePickerModal);
        const rescheduled = await pickTime(modal, 2);

        // # Return to channel page
        await app.channelsPage.goto({team, channel: townSquare});

        // * Verify indicator shows the updated scheduled time
        await expectIndicator(app.center.postCreate.scheduledPostIndicator, rescheduled);
    },
);

/**
 * @objective Verify rescheduling a weekly recurring scheduled message keeps its weekly recurrence.
 *
 * @precondition
 * A test server with valid license and the RecurringScheduledPosts feature flag enabled
 */
test(
    'reschedules weekly recurring scheduled message from scheduled posts page and keeps weekly recurrence',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        await pw.ensureFeatureFlag('RecurringScheduledPosts', true);

        const draftMessage = `Weekly Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a weekly recurring scheduled message for tomorrow
        const scheduled = await scheduleMessage(app, app.center.postCreate, draftMessage, 1, 0, true);

        // # Navigate to scheduled posts page
        await app.scheduledPostsPage.goto({team});

        // * Verify scheduled post appears with recurring weekly details
        const scheduledPost = await expectScheduledPost(app, {
            ...scheduled,
            message: draftMessage,
            count: 1,
            repeatWeekly: true,
        });

        // # Open the reschedule modal for the recurring scheduled message
        await scheduledPost.container.hover();
        const modal = await scheduledPost.rescheduleButton.clickTo(app.dateTimePickerModal);

        // * Verify the weekly recurrence option remains selected in the reschedule modal
        await expect(modal.repeatWeeklyCheckbox).toBeChecked();

        // # Reschedule the recurring message to a different future date
        const rescheduled = await pickTime(modal, 2);

        // * Verify the rescheduled post still appears as a weekly recurring message
        const rescheduledPost = await expectScheduledPost(app, {
            ...rescheduled,
            message: draftMessage,
            count: 1,
            repeatWeekly: true,
        });
        await expect(rescheduledPost.sendNowButton).toHaveCount(0);

        // # Return to channel page
        await app.channelsPage.goto({team, channel: townSquare});

        // * Verify the channel indicator stays hidden since every scheduled post is recurring
        await expectSidebarCount(app, 1);
        await expect(app.center.postCreate.scheduledPostIndicator.container).not.toBeVisible();
    },
);

/**
 * @objective Verify the ability to delete a scheduled message.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5645 deletes scheduled message from scheduled posts page and removes all indicators',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a scheduled message for tomorrow
        const scheduled = await scheduleMessage(app, app.center.postCreate, draftMessage, 1);

        // * Verify scheduled message indicator shows correct date and time
        await expectIndicator(app.center.postCreate.scheduledPostIndicator, scheduled);

        // # Navigate to scheduled posts page via indicator link
        await openScheduledPosts(app, app.center.postCreate.scheduledPostIndicator.seeAllLink);

        // * Verify scheduled post appears with correct information
        const scheduledPost = await expectScheduledPost(app, {...scheduled, message: draftMessage, count: 1});

        // # Delete the scheduled message
        await scheduledPost.container.hover();
        const modal = await scheduledPost.deleteButton.clickTo(app.deleteScheduledPostModal);

        // # Confirm deletion in the modal (its confirm button has no test id of its own)
        await modal.container.locator.getByRole('button', {name: 'Yes, delete'}).click();
        await expect(modal).not.toBeVisible();

        // * Verify the scheduled message is removed and no longer appears
        await expect(app.drafts.scheduled.postList).toHaveKeyCount(0);
        await expect(app.drafts.tabs.scheduledCountText).not.toBeVisible();
        await expect(app.lhs.drafts.scheduledPostBadgeText).not.toBeVisible();
    },
);

/**
 * @objective Verify the ability to send a scheduled message immediately.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5643_9 sends scheduled message immediately from scheduled posts page',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare, townSquareUrl} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a scheduled message for tomorrow
        const scheduled = await scheduleMessage(app, app.center.postCreate, draftMessage, 1);

        // * Verify scheduled message indicator shows correct date and time
        await expectIndicator(app.center.postCreate.scheduledPostIndicator, scheduled);

        // # Navigate to scheduled posts page via indicator link
        await openScheduledPosts(app, app.center.postCreate.scheduledPostIndicator.seeAllLink);

        // * Verify scheduled post appears with correct information
        const scheduledPost = await expectScheduledPost(app, {...scheduled, message: draftMessage, count: 1});

        // # Send the scheduled message immediately instead of waiting
        await sendNow(app, scheduledPost);

        // * Verify page redirects to the channel
        await expect(app.page).toHavePath(townSquareUrl);

        // * Verify scheduled indicators are removed
        await expect(app.center.postCreate.scheduledPostIndicator.container).not.toBeVisible();
        await expect(app.lhs.drafts.scheduledPostBadgeText).not.toBeVisible();

        // * Verify message was posted in the channel
        await expect((await lastCenterPost(app)).message.container).toContainText(draftMessage);
    },
);

/**
 * @objective Verify the ability to create a scheduled message from a direct message (DM).
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5643_3 creates scheduled message from DM channel and posts at scheduled time',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test setup with main user and create a second user
        const {user, team, adminClient} = await pw.initSetup();
        const otherUser = await adminClient.createUser(await pw.random.user(), '', '');

        // # Login as first user and navigate to DM channel with second user
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, path: 'messages', channel: `@${otherUser.username}`});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a scheduled message for tomorrow in the DM
        const scheduled = await scheduleMessage(app, app.center.postCreate, draftMessage, 1);

        // * Verify appropriate scheduled message indicator appears
        const indicator = app.center.postCreate.scheduledPostIndicator;
        await expect(indicator.container).toBeVisible();
        const outsideRemoteHour = pw.isOutsideRemoteUserHour(otherUser.timezone);
        if (outsideRemoteHour) {
            // Special case for timezone - expect generic message
            await expect(indicator).toContainText('You have one scheduled message.');
        } else {
            // Normal case - verify the scheduled indicator
            await expectIndicator(indicator, scheduled);
        }

        // # Navigate to scheduled posts page using appropriate link
        if (outsideRemoteHour) {
            // The generic message links to the page from its own text, which has no test id of its own.
            await openScheduledPosts(app, indicator.container.locator.getByRole('link').first());
        } else {
            await openScheduledPosts(app, indicator.seeAllLink);
        }

        // * Verify scheduled post appears with correct information
        const scheduledPost = await expectScheduledPost(app, {...scheduled, message: draftMessage, count: 1});

        // # Send the scheduled message immediately instead of waiting
        await sendNow(app, scheduledPost);

        // * Verify page redirects to the DM channel
        await expect(app.page).toHavePath(`/${team.name}/messages/@${otherUser.username}`);

        // * Verify scheduled indicators are removed
        await expect(app.center.postCreate.scheduledPostIndicator.container).not.toBeVisible();
        await expect(app.lhs.drafts.scheduledPostBadgeText).not.toBeVisible();

        // * Verify message was posted in the DM channel
        await expect((await lastCenterPost(app)).message.container).toContainText(draftMessage);
    },
);

/**
 * @objective Verify the ability to convert a draft message to a scheduled message.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5648 converts draft message to scheduled message from drafts page',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a draft message without sending it
        await app.center.postCreate.message.container.fill(draftMessage);
        await expect(app.center.postCreate.message.container).toHaveValue(draftMessage);

        // # Navigate to the drafts page
        await app.teamPage.goto({team});
        await expect(app.lhs.drafts.container).toBeVisible();
        await app.lhs.drafts.container.click();

        // * Verify draft count badge shows one draft
        await expect(app.drafts.tabs.draftsCountText).toHaveText('1');

        // * Verify draft message content appears correctly
        await expect(app.drafts.saved.draftList).toHaveKeyCount(1);
        const draft = app.drafts.saved.draft(0);
        await expect(draft.message).toContainText(draftMessage);

        // # Schedule the draft for 2 days in the future. The draft's schedule action is an icon button without a
        // test id of its own, so it is found by the id its icon gives it.
        await draft.container.hover();
        await draft.container.locator.locator('#draft_icon-clock-send-outline_reschedule').click();
        const modal = app.dateTimePickerModal;
        await expect(modal).toBeVisible();
        const scheduled = await pickTime(modal, 2);

        // # Navigate to scheduled posts page
        await app.scheduledPostsPage.goto({team});

        // * Verify scheduled post appears with correct information
        await expectScheduledPost(app, {...scheduled, message: draftMessage, count: 1});
    },
);

/**
 * @objective Verify the ability to edit a scheduled message before it's sent.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5644_1 edits scheduled message content while preserving scheduled time',
    {tag: '@scheduled_messages'},
    async ({pw}) => {
        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare, townSquareUrl} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a scheduled message for 2 days in the future
        const scheduled = await scheduleMessage(app, app.center.postCreate, draftMessage, 2);

        // * Verify scheduled message indicator shows correct date and time
        await expectIndicator(app.center.postCreate.scheduledPostIndicator, scheduled);

        // * Verify scheduled post badge shows count of 1
        await expectSidebarCount(app, 1);

        // # Navigate to scheduled posts page via indicator link
        await openScheduledPosts(app, app.center.postCreate.scheduledPostIndicator.seeAllLink);

        // * Verify scheduled post appears with correct information
        const scheduledPost = await expectScheduledPost(app, {...scheduled, message: draftMessage, count: 1});

        // # Edit the scheduled message content
        await scheduledPost.container.hover();
        await scheduledPost.editButton.click();
        await expect(scheduledPost.editor.container).toBeVisible();
        const updatedText = 'updated text';
        await scheduledPost.editor.container.fill(updatedText);
        await scheduledPost.editor.saveButton.click();

        // * Verify the edited message content is updated
        await expect(scheduledPost.message).toContainText(updatedText);

        // * Verify scheduled date/time remains unchanged
        await expect(scheduledPost.header.timeText.locator).toContainText(scheduled.selectedTime);

        // # Send the edited message immediately
        await sendNow(app, scheduledPost);

        // * Verify page redirects to the channel
        await expect(app.page).toHavePath(townSquareUrl);

        // * Verify scheduled indicators are removed
        await expect(app.center.postCreate.scheduledPostIndicator.container).not.toBeVisible();
        await expect(app.lhs.drafts.scheduledPostBadgeText).not.toBeVisible();

        // * Verify edited message was posted in the channel
        await expect((await lastCenterPost(app)).message.container).toHaveText(updatedText);
    },
);

/**
 * @objective Verify the ability to copy a scheduled message to clipboard.
 *
 * @precondition
 * A test server with valid license to support scheduled message features
 */
test(
    'MM-T5650 copies scheduled message text to clipboard for reuse',
    {tag: '@scheduled_messages'},
    async ({pw, browserName}) => {
        // # Skip this test in Firefox since clipboard permissions are not supported
        test.skip(browserName === 'firefox', 'Test not supported in Firefox');

        const draftMessage = `Scheduled Draft ${pw.random.id()}`;

        // # Initialize test user, login and navigate to a channel
        const {user, team, townSquare} = await pw.initSetup();
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: townSquare});
        await expect(app.center.postCreate).toBeVisible();

        // # Create a scheduled message for tomorrow
        const scheduled = await scheduleMessage(app, app.center.postCreate, draftMessage, 1);

        // * Verify scheduled post badge shows count of 1
        await expectSidebarCount(app, 1);

        // # Navigate to scheduled posts page via indicator link
        await openScheduledPosts(app, app.center.postCreate.scheduledPostIndicator.seeAllLink);

        // * Verify scheduled post appears with correct information
        const scheduledPost = await expectScheduledPost(app, {...scheduled, message: draftMessage, count: 1});

        // # Copy the scheduled message text to clipboard
        await scheduledPost.container.hover();
        await scheduledPost.copyTextButton.click();
        await expect(scheduledPost.copyTextButton).toBeVisible();

        // # Return to the channel page
        await app.page.goBack();

        // # Paste the copied message into the post input box
        const input = app.center.postCreate.message.container;
        await input.focus();
        await input.press('ControlOrMeta+v');

        // * Verify the clipboard content was pasted correctly
        await expect(input).toHaveValue(draftMessage);
    },
);

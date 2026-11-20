// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App, type PlaywrightExtended, Msg, Api, settle} from '@mattermost/playwright-lib';

type Priority = 'important' | 'urgent';

/** The priority picker the composers' priority button opens (one picker at a time). */
function pickerOf(app: App) {
    return app.postPriorityPicker;
}

/** Sends a message from the center composer, and returns the new post once it shows. */
async function send(app: App, message: string) {
    const {postList} = app.center;
    const before = (await postList.postList.keys()).length;
    await app.center.postCreate.message.container.fill(message);
    await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
    await expect.poll(async () => (await postList.postList.keys()).length).toBeGreaterThan(before);
    const id = (await postList.postList.keys()).at(-1)!;
    const post = postList.post({id});
    await expect(post).toContainText(message);
    return {id, post};
}

/** Opens a post's thread, and returns the thread's copy of the root post. */
async function openThread(app: App, post: ReturnType<App['center']['postList']['post']>, id: string) {
    await post.container.hover();
    await post.menu.replyButton.click();
    await expect(app.rhs.postCreate.message.container).toBeVisible();
    const root = app.rhs.thread.post({id});
    await expect(root).toBeVisible();
    return root;
}

async function postWithPriorityAndVerify(pw: PlaywrightExtended, priority: Priority) {
    // # Setup test environment
    const {user, team, townSquare} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {app} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open priority menu
    const composer = app.center.postCreate;
    const picker = pickerOf(app);
    await picker.openButton.click();

    // * Verify priority dialog appears
    const {menu} = app.postPriorityPicker;
    await expect(menu.priority('standard')).toBeVisible();

    // # Select the requested priority
    const option = menu.priority(priority);
    await option.click();
    await expect(option).toHaveAttribute('aria-checked', 'true');

    if (priority === 'urgent') {
        // * Verify persistent notifications are offered only for urgent messages
        await expect(menu.persistentNotificationsMenuItemCheckbox).toBeVisible();
    } else {
        await expect(menu.persistentNotificationsMenuItemCheckbox).not.toBeVisible();
    }

    // # Apply the selected priority
    await menu.applyButton.click();
    await expect(menu.priority('standard')).not.toBeVisible();

    // * Verify the composer shows the selected priority label
    await expect(composer.priorityLabels.priority).toHaveText(new RegExp(priority, 'i'));

    // # Post a message with the selected priority
    const testMessage = `${priority} priority ${pw.random.id()}`;
    const {id, post} = await send(app, testMessage);

    // * Verify the posted message shows the priority label
    await expect(post.priorityLabel).toHaveText(new RegExp(priority, 'i'));

    // # Open post in right-hand sidebar
    const rhsPost = await openThread(app, post, id);

    // * Verify the priority label also appears in the thread view
    await expect(rhsPost).toContainText(testMessage);
    await expect(rhsPost.priorityLabel).toHaveText(new RegExp(priority, 'i'));

    // * Verify RHS formatting bar doesn't include priority button: the page keeps only the center composer's
    // (a driver cannot count its matches, so this one check reads the locator)
    await expect(pickerOf(app).openButton.locator).toHaveCount(1);
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
        const {user, team, townSquare} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {app} = await pw.testBrowser.login(user);

        // # Visit default channel page
        await app.channelsPage.goto({team, channel: townSquare});

        // * Verify the priority control is available while the system setting is enabled
        const picker = pickerOf(app);
        await expect(picker.openButton).toBeVisible();

        // # Open priority menu
        await picker.openButton.click();

        // * Verify priority dialog appears with standard option selected
        const {menu} = app.postPriorityPicker;
        await expect(menu.priority('standard')).toHaveAttribute('aria-checked', 'true');

        // # Close priority menu
        await app.page.keyboard.press('Escape');
        await expect(menu.priority('standard')).not.toBeVisible();

        // # Post a message with standard priority
        const testMessage = `Standard priority ${pw.random.id()}`;
        const {id, post} = await send(app, testMessage);

        // * Verify message posts correctly with no priority label
        await expect(post.priorityLabel).toHaveCount(0);

        // # Open post in right-hand sidebar
        const rhsPost = await openThread(app, post, id);

        // * Verify post content appears correctly in RHS without a priority label
        await expect(rhsPost).toContainText(testMessage);
        await expect(rhsPost.priorityLabel).toHaveCount(0);

        // * Verify RHS formatting bar doesn't include priority button: the page keeps only the center composer's
        // (a driver cannot count its matches, so this one check reads the locator)
        await expect(pickerOf(app).openButton.locator).toHaveCount(1);
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
        const {user, team, adminClient, townSquare} = await pw.initSetup();
        const originalPostPriority = (await adminClient.getConfig()).ServiceSettings.PostPriority;

        try {
            // # Disable Message Priority in system settings
            await adminClient.patchConfig({ServiceSettings: {PostPriority: false}});

            // # Log in as a user after the setting is disabled
            const {app} = await pw.testBrowser.login(user);
            await app.channelsPage.goto({team, channel: townSquare});

            // * Verify the priority control is hidden
            await expect(app.center.postCreate.message.container).toBeVisible();
            await expect(pickerOf(app).openButton).not.toBeVisible();
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
        await postWithPriorityAndVerify(pw, 'important');
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
        await postWithPriorityAndVerify(pw, 'urgent');
    },
);

/**
 * @objective Verify that the composer's remove-labels control becomes visible and shows its tooltip
 * on both pointer hover and keyboard focus, and that it removes the priority label when activated
 * with the keyboard.
 */
test(
    'MM-62078 reveals the remove-labels control with a tooltip on hover and on keyboard focus, and removes the label on Enter',
    {tag: ['@message_priority', '@accessibility']},
    async ({pw, isMobile}) => {
        // # Setup test environment
        const {user, team, townSquare} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {app} = await pw.testBrowser.login(user);

        // # Visit default channel page
        await app.channelsPage.goto({team, channel: townSquare});

        const composer = app.center.postCreate;
        const input = composer.message.container;
        const removeLabelsButton = composer.removeAllLabelsButton;
        const removeLabelsTooltip = app.page.getByRole('tooltip');

        // # Apply Important priority so the composer renders its labels row
        await pickerOf(app).openButton.click();
        await expect(app.postPriorityPicker.menu.priority('important')).toBeVisible();
        const {menu} = app.postPriorityPicker;
        await menu.priority('important').click();
        await expect(menu.priority('important')).toHaveAttribute('aria-checked', 'true');
        await menu.applyButton.click();

        // * Verify the composer shows the Important label
        const label = composer.priorityLabels.priority.locator;
        await expect(label).toHaveText(/important/i);

        // # Move the pointer into the message input, away from the labels row
        await input.hover();

        // * Verify the remove-labels control is transparent while it is neither hovered nor focused
        await expect(removeLabelsButton).toHaveCSS('opacity', '0');

        // # Hover the labels row
        await label.hover();

        // * Verify hovering anywhere in the row reveals the remove-labels control
        await expect(removeLabelsButton).toHaveCSS('opacity', '1');

        // # Hover the revealed control
        await removeLabelsButton.hover();

        // * Verify its tooltip appears
        await expect(removeLabelsTooltip).toHaveMessage(Msg.unified_labels.remove_all);

        // # Move the pointer back into the message input and put keyboard focus there
        await input.hover();
        await input.focus();

        // * Verify the control is transparent again and its tooltip is gone
        await expect(removeLabelsButton).toHaveCSS('opacity', '0');
        await expect(removeLabelsTooltip).toHaveCount(0);

        // # Tab backwards out of the message input
        await input.press('Shift+Tab');
        await expect(removeLabelsButton).toBeFocused();

        // * Verify keyboard focus lands on the remove-labels control, which is now opaque with its tooltip shown
        // toBeFocusedWithFocusVisible returns the :focus-visible result rather than asserting it
        expect(await pw.toBeFocusedWithFocusVisible(removeLabelsButton.locator)).toBe(true);
        await expect(removeLabelsButton).toHaveCSS('opacity', '1');
        await expect(removeLabelsTooltip).toHaveMessage(Msg.unified_labels.remove_all);

        // # Activate the focused control with the keyboard
        await removeLabelsButton.press('Enter');

        // * Verify the priority label is removed
        await expect(label).toHaveCount(0);
        await expect(removeLabelsButton).toHaveCount(0);

        // * Verify focus returns to the message input on non-mobile devices
        if (!isMobile) {
            await expect(input).toBeFocused();
        }
    },
);

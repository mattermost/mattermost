// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that focus is properly managed when opening and closing the notification preferences modal using keyboard
 */
test(
    'manages focus when opening and closing notification preferences modal with keyboard',
    {tag: ['@accessibility', '@notification_preferences']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to off-topic channel
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const notificationPreferencesModal = channelsPage.notificationPreferencesModal;

        // # Click on Notifications button in the intro channel section
        await channelsPage.channelIntro.toBeVisible();
        const notificationsButton = await channelsPage.channelIntro.notificationsButton;
        await notificationsButton.click();

        // * Notification preferences modal should be visible and focus should be on the modal
        await expect(notificationPreferencesModal.container).toBeVisible();
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.container);

        // # Press Tab and verify focus is on Close button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.closeButton);

        // # Press Enter and verify modal is closed and focus returns to the notifications button
        await page.keyboard.press('Enter');
        await expect(notificationPreferencesModal.container).not.toBeVisible();
        await pw.toBeFocusedWithFocusVisible(notificationsButton);

        // # Open notification preferences modal again
        await page.keyboard.press('Enter');
        await expect(notificationPreferencesModal.container).toBeVisible();

        // # Press Escape and verify modal is closed and focus returns to the notifications button
        await page.keyboard.press('Escape');
        await expect(notificationPreferencesModal.container).not.toBeVisible();
        await pw.toBeFocusedWithFocusVisible(notificationsButton);
    },
);

/**
 * @objective Verify that keyboard navigation works correctly through all interactive elements in the notification preferences modal
 */
test(
    'navigates on keyboard tab between interactive elements in notification preferences modal',
    {tag: ['@accessibility', '@notification_preferences']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to off-topic channel
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const notificationPreferencesModal = channelsPage.notificationPreferencesModal;

        // # Click on Notifications button in the intro channel section
        await channelsPage.channelIntro.toBeVisible();
        const notificationsButton = await channelsPage.channelIntro.notificationsButton;
        await notificationsButton.click();

        // * Notification preferences modal should be visible
        await expect(notificationPreferencesModal.container).toBeVisible();
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.container);

        // # Press Tab to move through interactive elements
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.closeButton);

        // # Press Tab to move to Mute channel checkbox
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.muteChannelCheckbox);

        // # Press Tab to move to Ignore mentions checkbox
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.ignoreMentionsCheckbox);

        // # Press Tab to move to Desktop notification radio group (only checked radio is tabbable)
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.desktopNotifyMentionRadio);

        // # Press Tab to move to Thread reply notifications checkbox
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.desktopReplyThreadsCheckbox);

        // # Press Tab to move to Desktop notification sounds checkbox
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.desktopNotificationSoundsCheckbox);

        // # Press Tab to move to Desktop notification sounds select
        await page.keyboard.press('Tab');
        const soundSelectInput = notificationPreferencesModal.desktopNotificationSoundsSelect.locator('input');
        await pw.toBeFocusedWithFocusVisible(soundSelectInput);

        // # Press Tab to move to Same mobile settings checkbox
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.sameMobileSettingsDesktopCheckbox);

        // # Press Tab to move to Auto follow threads checkbox
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.autoFollowThreadsCheckbox);

        // # Press Tab to move to Cancel button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.cancelButton);

        // # Press Tab to move to Save button
        await page.keyboard.press('Tab');
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.saveButton);
    },
);

/**
 * @objective Verify that checkboxes can be toggled using keyboard (Space key)
 */
test(
    'toggles checkboxes using keyboard in notification preferences modal',
    {tag: ['@accessibility', '@notification_preferences']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to off-topic channel
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const notificationPreferencesModal = channelsPage.notificationPreferencesModal;

        // # Click on Notifications button to open modal
        await channelsPage.channelIntro.toBeVisible();
        const notificationsButton = await channelsPage.channelIntro.notificationsButton;
        await notificationsButton.click();
        await expect(notificationPreferencesModal.container).toBeVisible();

        // # Navigate to Mute channel checkbox and verify initial state
        await notificationPreferencesModal.muteChannelCheckbox.focus();
        const initialMuteState = await notificationPreferencesModal.isMuteChannelChecked();

        // # Press Space to toggle checkbox
        await page.keyboard.press('Space');

        // * Verify checkbox state changed
        const newMuteState = await notificationPreferencesModal.isMuteChannelChecked();
        expect(newMuteState).toBe(!initialMuteState);

        // # Navigate to Ignore mentions checkbox and verify initial state
        await notificationPreferencesModal.ignoreMentionsCheckbox.focus();
        const initialIgnoreState = await notificationPreferencesModal.isIgnoreMentionsChecked();

        // # Press Space to toggle checkbox
        await page.keyboard.press('Space');

        // * Verify checkbox state changed
        const newIgnoreState = await notificationPreferencesModal.isIgnoreMentionsChecked();
        expect(newIgnoreState).toBe(!initialIgnoreState);
    },
);

/**
 * @objective Verify that radio buttons can be selected using keyboard (arrow keys)
 */
test(
    'selects radio buttons using arrow keys in notification preferences modal',
    {tag: ['@accessibility', '@notification_preferences']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to off-topic channel
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const notificationPreferencesModal = channelsPage.notificationPreferencesModal;

        // # Click on Notifications button to open modal
        await channelsPage.channelIntro.toBeVisible();
        const notificationsButton = await channelsPage.channelIntro.notificationsButton;
        await notificationsButton.click();
        await expect(notificationPreferencesModal.container).toBeVisible();

        // # Navigate to desktop notification radio group and verify default is "mention"
        await notificationPreferencesModal.desktopNotifyMentionRadio.focus();
        await expect(notificationPreferencesModal.desktopNotifyMentionRadio).toBeChecked();

        // # Press ArrowDown to select next option (none)
        await page.keyboard.press('ArrowDown');
        await expect(notificationPreferencesModal.desktopNotifyNoneRadio).toBeChecked();
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.desktopNotifyNoneRadio);

        // # Press ArrowDown to wrap around to first option (all)
        await page.keyboard.press('ArrowDown');
        await expect(notificationPreferencesModal.desktopNotifyAllRadio).toBeChecked();
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.desktopNotifyAllRadio);

        // # Press ArrowUp to select previous option (none)
        await page.keyboard.press('ArrowUp');
        await expect(notificationPreferencesModal.desktopNotifyNoneRadio).toBeChecked();
        await pw.toBeFocusedWithFocusVisible(notificationPreferencesModal.desktopNotifyNoneRadio);
    },
);

/**
 * @objective Verify that the notification preferences modal meets WCAG accessibility standards
 */
test(
    'passes accessibility scan on notification preferences modal',
    {tag: ['@accessibility', '@notification_preferences']},
    async ({pw, axe}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to off-topic channel
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const notificationPreferencesModal = channelsPage.notificationPreferencesModal;

        // # Click on Notifications button to open modal
        await channelsPage.channelIntro.toBeVisible();
        const notificationsButton = await channelsPage.channelIntro.notificationsButton;
        await notificationsButton.click();

        // * Notification preferences modal should be visible
        await expect(notificationPreferencesModal.container).toBeVisible();

        // * Analyze the notification preferences modal for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include(notificationPreferencesModal.getContainerId()) // Focus analysis on the modal container
            .analyze();

        // * Should have no violation
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

/**
 * @objective Verify ARIA structure and labels are properly implemented in notification preferences modal
 */
test(
    'verifies ARIA snapshot of notification preferences modal',
    {tag: ['@accessibility', '@notification_preferences', '@snapshots']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to off-topic channel
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const notificationPreferencesModal = channelsPage.notificationPreferencesModal;

        // # Click on Notifications button to open modal
        await channelsPage.channelIntro.toBeVisible();
        const notificationsButton = await channelsPage.channelIntro.notificationsButton;
        await notificationsButton.click();

        // * Notification preferences modal should be visible
        await expect(notificationPreferencesModal.container).toBeVisible();

        // * Verify ARIA snapshot of notification preferences modal
        await expect(notificationPreferencesModal.container).toMatchAriaSnapshot();
    },
);

/**
 * @objective Verify that screen reader announces modal title and channel name correctly
 */
test(
    'announces modal title and channel name for screen readers',
    {tag: ['@accessibility', '@notification_preferences']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to off-topic channel
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const notificationPreferencesModal = channelsPage.notificationPreferencesModal;

        // # Click on Notifications button to open modal
        await channelsPage.channelIntro.toBeVisible();
        const notificationsButton = await channelsPage.channelIntro.notificationsButton;
        await notificationsButton.click();

        // * Notification preferences modal should be visible
        await expect(notificationPreferencesModal.container).toBeVisible();

        // * Verify modal has proper ARIA attributes
        await expect(notificationPreferencesModal.container).toHaveAttribute('role', 'dialog');
        await expect(notificationPreferencesModal.container).toHaveAttribute('aria-modal', 'true');
        await expect(notificationPreferencesModal.container).toHaveAttribute('aria-labelledby', 'genericModalLabel');

        // * Verify modal title contains "Notification Preferences"
        await notificationPreferencesModal.verifyModalTitle();

        // * Verify channel name is displayed
        await notificationPreferencesModal.verifyChannelName('Off-Topic');

        // * Verify the fieldset has proper legend for screen readers
        const fieldset = notificationPreferencesModal.container.locator('fieldset').first();
        await expect(fieldset).toBeVisible();
        const legend = fieldset.locator('legend');
        await expect(legend).toHaveText('Mute or ignore');
    },
);

/**
 * @objective Verify that form controls have proper labels and descriptions
 */
test(
    'verifies form controls have proper labels and descriptions',
    {tag: ['@accessibility', '@notification_preferences']},
    async ({pw}) => {
        // # Create and sign in a new user
        const {user, team} = await pw.initSetup();

        // # Log in a user in new browser context
        const {channelsPage} = await pw.testBrowser.login(user);

        // # Navigate to off-topic channel
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const notificationPreferencesModal = channelsPage.notificationPreferencesModal;

        // # Click on Notifications button to open modal
        await channelsPage.channelIntro.toBeVisible();
        const notificationsButton = await channelsPage.channelIntro.notificationsButton;
        await notificationsButton.click();

        // * Notification preferences modal should be visible
        await expect(notificationPreferencesModal.container).toBeVisible();

        // * Verify Mute channel checkbox has proper label
        await expect(notificationPreferencesModal.muteChannelCheckbox).toHaveAttribute('id', 'mute-channel');
        const muteLabel = notificationPreferencesModal.container.locator('label[for="mute-channel"]');
        await expect(muteLabel).toContainText('Mute channel');

        // * Verify Ignore mentions checkbox has proper label
        await expect(notificationPreferencesModal.ignoreMentionsCheckbox).toHaveAttribute('id', 'ignore-mentions');
        const ignoreLabel = notificationPreferencesModal.container.locator('label[for="ignore-mentions"]');
        await expect(ignoreLabel).toContainText('Ignore mentions for @channel, @here and @all');

        // * Verify Desktop reply threads checkbox has proper label
        await expect(notificationPreferencesModal.desktopReplyThreadsCheckbox).toHaveAttribute(
            'id',
            'desktop-reply-threads',
        );
        const replyThreadsLabel = notificationPreferencesModal.container.locator('label[for="desktop-reply-threads"]');
        await expect(replyThreadsLabel).toContainText(/Notify me about replies to threads I.m following/);

        // * Verify Auto follow threads checkbox has proper label
        await expect(notificationPreferencesModal.autoFollowThreadsCheckbox).toHaveAttribute(
            'id',
            'auto-follow-threads',
        );
        const autoFollowLabel = notificationPreferencesModal.container.locator('label[for="auto-follow-threads"]');
        await expect(autoFollowLabel).toContainText('Automatically follow threads in this channel');

        // * Verify radio buttons have proper names for grouping
        await expect(notificationPreferencesModal.desktopNotifyAllRadio).toHaveAttribute('name', 'desktop');
        await expect(notificationPreferencesModal.desktopNotifyMentionRadio).toHaveAttribute('name', 'desktop');
        await expect(notificationPreferencesModal.desktopNotifyNoneRadio).toHaveAttribute('name', 'desktop');
    },
);

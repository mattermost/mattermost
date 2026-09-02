// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';
import type {ChannelsPage, PlaywrightExtended} from '@mattermost/playwright-lib';

test.describe('Mobile view schedule message menu', () => {
    // Shrink the window's width to trigger mobile view, where the menu renders as a modal
    test.use({viewport: {width: 400, height: 900}});

    test.beforeEach(async ({pw}) => {
        // Ensure license but skip test if no license which is required for scheduled messages
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    async function openScheduleMessageMenu(
        pw: PlaywrightExtended,
    ): Promise<{channelsPage: ChannelsPage; draftMessage: string}> {
        const {user} = await pw.initSetup();

        // # Log in as the test user and go to a channel
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        // # Write a draft message without sending it
        const draftMessage = `Mobile scheduled draft ${pw.random.id()}`;
        await channelsPage.centerView.postCreate.writeMessage(draftMessage);

        // # Open the schedule message menu
        await channelsPage.centerView.postCreate.scheduleMessageButton.click();

        // * Verify the menu opened as a mobile dialog rather than a popover
        await channelsPage.scheduleMessageMenu.toBeVisibleAsMobileDialog();

        return {channelsPage, draftMessage};
    }

    /**
     * @objective Selecting a preset time in the schedule message menu dismisses the menu and schedules
     * the draft exactly once, so the same draft cannot be scheduled again from a menu left open.
     *
     * @precondition
     * A test server with a valid license to support scheduled message features
     */
    test(
        'closes the schedule message menu and schedules once after selecting a preset time',
        {tag: ['@scheduled_messages', '@mobile']},
        async ({pw}) => {
            const {channelsPage} = await openScheduleMessageMenu(pw);
            const {scheduleMessageMenu, centerView} = channelsPage;

            // # Select the first preset time, which varies with the current weekday
            const presetTimeOption = scheduleMessageMenu.presetTimeMenuItems.first();
            await presetTimeOption.click();

            // * Verify the menu dismissed itself, leaving no option to click again
            await scheduleMessageMenu.toBeHidden();
            await expect(presetTimeOption).toHaveCount(0);

            // * Verify the draft was scheduled exactly once and the composer was cleared
            await centerView.scheduledPostIndicator.toBeVisible();
            await expect(centerView.scheduledPostIndicator.container).toContainText('Message scheduled for');
            await expect(centerView.postCreate.input).toHaveValue('');
        },
    );

    /**
     * @objective Tapping the dimmed area of the schedule message menu's dialog dismisses it without
     * scheduling anything.
     *
     * @precondition
     * A test server with a valid license to support scheduled message features
     */
    test(
        'closes the schedule message menu when tapping the dimmed area around it',
        {tag: ['@scheduled_messages', '@mobile']},
        async ({pw}) => {
            const {channelsPage, draftMessage} = await openScheduleMessageMenu(pw);
            const {scheduleMessageMenu, centerView} = channelsPage;

            // # Tap the dimmed area of the dialog, above the panel holding the menu items
            await scheduleMessageMenu.clickOutsideMobileDialog();

            // * Verify the menu dismissed itself
            await scheduleMessageMenu.toBeHidden();

            // * Verify nothing was scheduled and the draft is still in the composer
            await centerView.scheduledPostIndicator.toBeNotVisible();
            await expect(centerView.postCreate.input).toHaveValue(draftMessage);
        },
    );
});

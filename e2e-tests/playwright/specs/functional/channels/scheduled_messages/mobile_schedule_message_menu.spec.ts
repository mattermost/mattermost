// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, type App, type PlaywrightExtended} from '@mattermost/playwright-lib';

test.describe('Mobile view schedule message menu', () => {
    // Shrink the window's width to trigger mobile view, where the menu renders as a modal
    test.use({viewport: {width: 400, height: 900}});

    test.beforeEach(async ({pw}) => {
        // Ensure license but skip test if no license which is required for scheduled messages
        await pw.ensureLicense();
        await pw.skipIfNoLicense();
    });

    async function openScheduleMessageMenu(pw: PlaywrightExtended): Promise<{app: App; draftMessage: string}> {
        const {user, team} = await pw.initSetup();

        // # Log in as the test user and go to a channel
        const {app} = await pw.testBrowser.login(user);
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();

        // # Write a draft message without sending it
        const draftMessage = `Mobile scheduled draft ${pw.random.id()}`;
        await app.center.postCreate.message.container.fill(draftMessage);

        // # Open the schedule message menu
        await app.center.postCreate.sendOptions.openMenuButton.click();

        // * Verify the menu opened as a mobile dialog rather than a popover
        await expect(app.sendPostOptions.menu.customTimeMenuItem).toBeVisible();
        await expect(app.menuModal.items).toBeVisible();

        return {app, draftMessage};
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
            const {app} = await openScheduleMessageMenu(pw);
            const {menu} = app.sendPostOptions;
            const composer = app.center.postCreate;

            // # Select the first preset time, which varies with the current weekday
            const presetTimeOption = menu.tomorrow9AmMenuItem.locator
                .or(menu.monday9AmMenuItem.locator)
                .or(menu.nextMonday9AmMenuItem.locator)
                .first();
            await presetTimeOption.click();

            // * Verify the menu dismissed itself, leaving no option to click again
            await expect(app.menuModal.items).toBeHidden();
            await expect(presetTimeOption).toHaveCount(0);

            // * Verify the draft was scheduled exactly once and the composer was cleared
            await expect(composer.scheduledPostIndicator).toBeVisible();
            await expect(composer.scheduledPostIndicator).toContainText('Message scheduled for');
            await expect(composer.message).toHaveValue('');
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
            const {app, draftMessage} = await openScheduleMessageMenu(pw);
            const composer = app.center.postCreate;

            // # Tap the dimmed area of the dialog, above the panel holding the menu items
            await clickAboveMobileMenu(app);

            // * Verify the menu dismissed itself
            await expect(app.menuModal.items).toBeHidden();
            await expect(app.sendPostOptions.menu.customTimeMenuItem.locator).toBeHidden();

            // * Verify nothing was scheduled and the draft is still in the composer
            await expect(composer.scheduledPostIndicator).not.toBeVisible();
            await expect(composer.message).toHaveValue(draftMessage);
        },
    );
});

// The modal dialog fills the modal but for a margin at its top and bottom (a few pixels above, at 400x900): the
// dimmed area of the dialog starts this far below the modal's top edge.
const DIALOG_MARGIN = 50;

// Clicks the dimmed area of the open menu modal's dialog, halfway between its top and the menu.
async function clickAboveMobileMenu(app: App) {
    await expect(app.menuModal.locator).toHaveCSS('opacity', '1');
    const modalBox = await app.menuModal.locator.boundingBox();
    const listBox = await app.menuModal.items.locator.boundingBox();
    expect(modalBox).not.toBeNull();
    expect(listBox).not.toBeNull();

    const top = modalBox!.y + DIALOG_MARGIN;
    const dimmedAreaHeight = listBox!.y - top;
    expect(dimmedAreaHeight).toBeGreaterThan(20);

    await app.page.mouse.click(listBox!.x + listBox!.width / 2, top + dimmedAreaHeight / 2);
    await expect(app.menuModal.items).not.toBeVisible();
}

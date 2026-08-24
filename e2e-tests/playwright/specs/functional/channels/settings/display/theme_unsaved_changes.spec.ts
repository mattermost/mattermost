// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

// Selecting a premade theme applies it as a live preview, which sets these CSS variables.
const denimSidebarBg = '#1e325c';
const onyxSidebarBg = '#202228';

// The settings modal fades out over 300ms, which is the window the confirmation used to vanish in.
const modalFadeMs = 300;

const discardMessage = 'You have unsaved changes, are you sure you want to discard them?';

/**
 * @objective Verify that closing the settings modal with an unsaved theme preview shows a discard
 * confirmation which stays on screen, keeps the settings modal open when cancelled, and closes the
 * settings modal and reverts the preview when confirmed.
 *
 * @reference MM-70405
 */
test(
    'Discarding an unsaved theme preview keeps the settings modal open until the confirmation is answered',
    {tag: '@display_settings'},
    async ({pw}) => {
        const {user} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Visit default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const sidebarBg = () =>
            page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-bg').trim());

        // * Verify the user starts on the default Denim theme
        await expect.poll(sidebarBg).toBe(denimSidebarBg);

        // # Open the theme section of the display settings
        const settingsModal = await channelsPage.globalHeader.openSettings();
        const displaySettings = await settingsModal.openDisplayTab();
        await displaySettings.themeEditButton.click();
        await displaySettings.verifySectionIsExpanded('theme');

        // # Select the Onyx theme without saving
        await displaySettings.container.getByRole('button', {name: 'Onyx'}).click();

        // * Verify the theme is previewed live
        await expect.poll(sidebarBg).toBe(onyxSidebarBg);

        // # Close the settings modal
        await settingsModal.closeButton.click();

        // * Verify the discard confirmation is shown
        const confirmDialog = page.locator('#confirmModal');
        await expect(confirmDialog).toBeVisible();
        await expect(confirmDialog).toContainText(discardMessage);

        // * Verify the confirmation stays put instead of closing itself along with the settings modal
        await page.waitForTimeout(modalFadeMs * 3);
        await expect(confirmDialog).toBeVisible();
        await expect(settingsModal.container).toBeVisible();
        await expect.poll(sidebarBg).toBe(onyxSidebarBg);

        // # Cancel the discard
        await confirmDialog.getByRole('button', {name: 'Cancel', exact: true}).click();

        // * Verify the settings modal is still open on the previewed theme
        await expect(confirmDialog).not.toBeVisible();
        await expect(settingsModal.container).toBeVisible();
        await displaySettings.verifySectionIsExpanded('theme');
        await expect.poll(sidebarBg).toBe(onyxSidebarBg);

        // # Ask to close the settings modal with the keyboard this time
        await page.keyboard.press('Escape');

        // * Verify the preview is still unsaved, so the confirmation is shown again
        await expect(confirmDialog).toBeVisible();

        // # Confirm the discard
        await confirmDialog.getByRole('button', {name: 'Yes, Discard', exact: true}).click();

        // * Verify the settings modal closed and the previewed theme was reverted
        await expect(settingsModal.container).not.toBeVisible();
        await expect.poll(sidebarBg).toBe(denimSidebarBg);
    },
);

/**
 * @objective Verify that a saved theme leaves no unsaved changes behind, so neither saving nor
 * closing the settings modal afterwards asks to discard changes.
 *
 * @reference MM-70405
 */
test(
    'Saving a theme closes the settings modal without asking to discard changes',
    {tag: '@display_settings'},
    async ({pw}) => {
        const {user} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Visit default channel page
        await channelsPage.goto();
        await channelsPage.toBeVisible();

        const sidebarBg = () =>
            page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-bg').trim());

        // # Select and save the Onyx theme
        const settingsModal = await channelsPage.globalHeader.openSettings();
        const displaySettings = await settingsModal.openDisplayTab();
        await displaySettings.selectPremadeTheme('Onyx');

        // * Verify saving collapsed the theme section and left nothing to discard
        await expect(displaySettings.themeEditButton).toBeVisible();
        await expect(page.getByText(discardMessage)).not.toBeVisible();

        // # Close the settings modal
        await settingsModal.closeButton.click();

        // * Verify the modal closed without a confirmation and the saved theme is still applied
        await expect(settingsModal.container).not.toBeVisible();
        await expect(page.getByText(discardMessage)).not.toBeVisible();
        await expect.poll(sidebarBg).toBe(onyxSidebarBg);
    },
);

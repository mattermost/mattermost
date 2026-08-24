// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

// Selecting a premade theme applies it as a live preview, which sets these CSS variables.
const denimSidebarBg = '#1e325c';
const onyxSidebarBg = '#202228';

/**
 * @objective Verify that closing the settings modal with an unsaved theme preview shows a discard
 * confirmation which stays on screen, keeps the settings modal open when cancelled, and closes the
 * settings modal and reverts the preview when confirmed.
 *
 * @reference MM-70405
 */
test('Discarding an unsaved theme preview keeps the settings modal open until the confirmation is answered', async ({
    pw,
}) => {
    const {user} = await pw.initSetup();

    // # Log in as a user in new browser context
    const {page, channelsPage} = await pw.testBrowser.login(user);

    // # Visit default channel page
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    const sidebarBg = () =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sidebar-bg').trim());

    // * Verify the user starts on the default Denim theme
    expect(await sidebarBg()).toBe(denimSidebarBg);

    // # Open the theme section of the display settings
    const settingsModal = await channelsPage.globalHeader.openSettings();
    const displaySettings = await settingsModal.openDisplayTab();
    await displaySettings.themeEditButton.click();
    await displaySettings.verifySectionIsExpanded('theme');

    // # Select the Onyx theme without saving
    await displaySettings.container.getByRole('button', {name: 'Onyx'}).click();

    // * Verify the theme is previewed live
    expect(await sidebarBg()).toBe(onyxSidebarBg);

    // # Close the settings modal
    await settingsModal.closeButton.click();

    // * Verify the discard confirmation is shown
    const confirmDialog = page.locator('#confirmModal');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('You have unsaved changes, are you sure you want to discard them?');

    // * Verify the confirmation stays put instead of closing itself along with the settings modal
    await page.waitForTimeout(1500);
    await expect(confirmDialog).toBeVisible();
    await expect(settingsModal.container).toBeVisible();
    expect(await sidebarBg()).toBe(onyxSidebarBg);

    // # Cancel the discard
    await confirmDialog.locator('#cancelModalButton').click();

    // * Verify the settings modal is still open on the previewed theme
    await expect(confirmDialog).not.toBeVisible();
    await expect(settingsModal.container).toBeVisible();
    await displaySettings.verifySectionIsExpanded('theme');
    expect(await sidebarBg()).toBe(onyxSidebarBg);

    // # Close the settings modal again and confirm the discard
    await settingsModal.closeButton.click();
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.locator('#confirmModalButton').click();

    // * Verify the settings modal closed and the previewed theme was reverted
    await expect(settingsModal.container).not.toBeVisible();
    expect(await sidebarBg()).toBe(denimSidebarBg);
});

/**
 * @objective Verify that a saved theme leaves no unsaved changes behind, so the settings modal
 * closes without a discard confirmation and keeps the saved theme applied.
 *
 * @reference MM-70405
 */
test('Saving a theme closes the settings modal without asking to discard changes', async ({pw}) => {
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

    // # Close the settings modal
    await settingsModal.closeButton.click();

    // * Verify no discard confirmation was needed and the saved theme is still applied
    await expect(page.locator('#confirmModal')).not.toBeVisible();
    await expect(settingsModal.container).not.toBeVisible();
    expect(await sidebarBg()).toBe(onyxSidebarBg);
});

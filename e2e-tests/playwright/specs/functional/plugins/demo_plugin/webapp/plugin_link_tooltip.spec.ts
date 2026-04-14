// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../helpers';

const TEST_LINK = 'https://example.com/some-page';

/**
 * @objective Verify that users can see a plugin link tooltip when hovering
 * over a link in a message, and can still interact with the rest of the page while
 * the tooltip is visible.
 *
 * @precondition
 * Demo plugin v0.11.1+ must be installed on the server.
 */
test('shows plugin link tooltip on hover without blocking page interaction', {tag: '@plugin'}, async ({pw}) => {
    // # Initialize setup and enable the demo plugin
    const {adminClient, user} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // # Login after plugin is active so the webapp loads the plugin's JS bundle
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Post a message with a link that triggers the demo plugin tooltip
    await channelsPage.postMessage(`Check this link: ${TEST_LINK}`);

    // # Reload so the webapp picks up the plugin's LinkTooltip registration
    await channelsPage.page.reload();
    await channelsPage.toBeVisible();

    // # Get the last post and hover over the link
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toBeVisible();
    const link = lastPost.body.getByRole('link', {name: TEST_LINK});
    await expect(link).toBeVisible();
    await link.hover();

    // * Verify the tooltip from the demo plugin appears with expected text
    const overlay = channelsPage.page.locator('.plugin-link-tooltip-floating-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('This is a custom tooltip from the Demo Plugin');

    // * Verify the overlay does not block pointer events (pointer-events: none on overlay)
    await expect(overlay).toHaveCSS('pointer-events', 'none');

    // * Verify the tooltip content itself remains interactive (pointer-events not none)
    const tooltipContent = overlay.locator('> *').first();
    await expect(tooltipContent).toBeVisible();
    await expect(tooltipContent).not.toHaveCSS('pointer-events', 'none');
});

/**
 * @objective Verify that users can click links within a plugin link tooltip
 * to navigate to the referenced content, ensuring the tooltip is fully interactive.
 *
 * @precondition
 * Demo plugin v0.11.1+ must be installed on the server.
 */
test('renders clickable links inside plugin link tooltip that respond to clicks', {tag: '@plugin'}, async ({pw}) => {
    // # Initialize setup and enable the demo plugin
    const {adminClient, user} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // # Login after plugin is active so the webapp loads the plugin's JS bundle
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Post a message with a link that triggers the demo plugin tooltip
    await channelsPage.postMessage(`Check this link: ${TEST_LINK}`);

    // # Reload so the webapp picks up the plugin's LinkTooltip registration
    await channelsPage.page.reload();
    await channelsPage.toBeVisible();

    // # Hover over the link in the last post to show the tooltip
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toBeVisible();
    const link = lastPost.body.getByRole('link', {name: TEST_LINK});
    await link.hover();

    // * Verify the tooltip appears
    const overlay = channelsPage.page.locator('.plugin-link-tooltip-floating-overlay');
    await expect(overlay).toBeVisible();

    // * Verify all three clickable links are rendered with correct href
    const titleLink = overlay.getByTestId('demo-tooltip-title-link');
    const sharedViaLink = overlay.getByTestId('demo-tooltip-shared-via-link');
    const descriptionLink = overlay.getByTestId('demo-tooltip-description-link');

    await expect(titleLink).toBeVisible();
    await expect(titleLink).toHaveAttribute('href', TEST_LINK);
    await expect(titleLink).toHaveAttribute('target', '_blank');

    await expect(sharedViaLink).toBeVisible();
    await expect(sharedViaLink).toHaveAttribute('href', TEST_LINK);

    await expect(descriptionLink).toBeVisible();
    await expect(descriptionLink).toHaveAttribute('href', TEST_LINK);

    // # Click the title link to verify pointer events pass through the overlay
    const popupPromise = channelsPage.page.waitForEvent('popup');
    await titleLink.click();
    const popup = await popupPromise;

    // * Verify a new tab opens with the expected URL
    expect(popup.url()).toContain('example.com');
    await popup.close();
});

/**
 * @objective Verify that the plugin link tooltip displays text in the user's preferred
 * language, ensuring a localized experience for non-English users.
 *
 * @precondition
 * Demo plugin v0.11.1+ must be installed on the server.
 */
test('renders plugin link tooltip text in the configured user locale', {tag: '@plugin'}, async ({pw}) => {
    // # Initialize setup and enable the demo plugin
    const {adminClient, user, userClient} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // # Set user locale to Spanish
    await userClient.patchMe({locale: 'es'});

    // # Login after plugin is active and locale is set
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Post a message with a link that triggers the demo plugin tooltip
    await channelsPage.postMessage(`Check this link: ${TEST_LINK}`);

    // # Reload so the webapp picks up the plugin's LinkTooltip registration
    await channelsPage.page.reload();
    await channelsPage.toBeVisible();

    // # Hover over the link in the last post to show the tooltip
    const lastPost = await channelsPage.getLastPost();
    await lastPost.toBeVisible();
    const link = lastPost.body.getByRole('link', {name: TEST_LINK});
    await link.hover();

    // * Verify the tooltip appears
    const overlay = channelsPage.page.locator('.plugin-link-tooltip-floating-overlay');
    await expect(overlay).toBeVisible();

    // * Verify the tooltip renders Spanish locale strings
    await expect(overlay).toContainText(
        'Esta es una información sobre herramientas personalizada del complemento de demostración',
    );
    await expect(overlay).toContainText('Vista previa del enlace de demostración');
    await expect(overlay).toContainText('Compartido a través de');
    await expect(overlay).toContainText('Esta es una descripción de ejemplo.');
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify accessibility support in Browse Channels Dialog screen
 */
test(
    'MM-T1467 Accessibility Support in Browse Channels Dialog screen',
    {tag: ['@accessibility', '@browse_channels']},
    async ({pw}) => {
        // # Skip test if no license
        await pw.skipIfNoLicense();

        // # Initialize setup
        const {team, user, adminClient} = await pw.initSetup();

        // # Create two channels with purposes for testing aria-label
        const channel1 = await adminClient.createChannel({
            team_id: team.id,
            name: 'accessibility-' + Date.now(),
            display_name: 'Accessibility',
            type: 'O',
            purpose: 'some purpose',
        });

        const channel2 = await adminClient.createChannel({
            team_id: team.id,
            name: 'z-accessibility-' + Date.now(),
            display_name: 'Z Accessibility',
            type: 'O',
            purpose: 'other purpose',
        });

        // # Log in as regular user
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Click on Browse or Create Channel button and then Browse Channels
        await channelsPage.sidebarLeft.browseOrCreateChannelButton.click();
        const browseChannelsMenuItem = page.locator('#browseChannelsMenuItem');
        await browseChannelsMenuItem.click();

        // * Verify the Browse Channels dialog is visible
        const dialog = page.getByRole('dialog', {name: 'Browse Channels'});
        await expect(dialog).toBeVisible();

        // * Verify the heading
        await expect(dialog.getByRole('heading', {name: 'Browse Channels'})).toBeVisible();

        // * Verify the search input exists
        const searchInput = dialog.getByPlaceholder('Search channels');
        await expect(searchInput).toBeVisible();

        // # Wait for channel list to load
        const channelList = dialog.locator('#moreChannelsList');
        await expect(channelList).toBeVisible();

        // # Hide already joined channels
        const hideJoinedCheckbox = dialog.getByText('Hide Joined');
        await hideJoinedCheckbox.click();

        // # Focus on Create Channel button and tab through elements
        const createChannelButton = dialog.locator('#createNewChannelButton');
        await createChannelButton.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');

        // * Verify channel name is highlighted and has proper aria-label
        const channel1AriaLabel = `${channel1.display_name.toLowerCase()}, ${channel1.purpose.toLowerCase()}`;
        const channel1Item = dialog.getByLabel(channel1AriaLabel);
        await expect(channel1Item).toBeVisible();
        await expect(channel1Item).toBeFocused();

        // # Press Tab again to move to next channel
        await page.keyboard.press('Tab');

        // * Verify focus moved to next channel
        const channel2AriaLabel = `${channel2.display_name.toLowerCase()}, ${channel2.purpose.toLowerCase()}`;
        const channel2Item = dialog.getByLabel(channel2AriaLabel);
        await expect(channel2Item).toBeFocused();
    },
);

/**
 * @objective Verify Browse Channels dialog passes accessibility scan and matches aria-snapshot
 */
test(
    'accessibility scan and aria-snapshot of Browse Channels dialog',
    {tag: ['@accessibility', '@browse_channels', '@snapshots']},
    async ({pw, axe}) => {
        // # Skip test if no license
        await pw.skipIfNoLicense();

        // # Initialize setup
        const {team, user} = await pw.initSetup();

        // # Log in as regular user
        const {page, channelsPage} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await channelsPage.goto(team.name, 'town-square');
        await channelsPage.toBeVisible();

        // # Click on Browse or Create Channel button and then Browse Channels
        await channelsPage.sidebarLeft.browseOrCreateChannelButton.click();
        const browseChannelsMenuItem = page.locator('#browseChannelsMenuItem');
        await browseChannelsMenuItem.click();

        // * Verify the Browse Channels dialog is visible
        const dialog = page.getByRole('dialog', {name: 'Browse Channels'});
        await expect(dialog).toBeVisible();
        await pw.wait(pw.duration.one_sec);

        // * Verify aria snapshot of Browse Channels dialog
        await expect(dialog).toMatchAriaSnapshot(`
            - dialog "Browse Channels":
              - document:
                - heading "Browse Channels" [level=1]
                - button "Create New Channel"
                - button "Close"
                - textbox "Search Channels"
                - /text: \\d+ Results/
                - /status: \\d+ Results/
                - status: Channel type filter set to All
                - button "Channel type filter"
                - checkbox "Hide joined channels": Hide Joined
                - search
        `);

        // * Analyze the Browse Channels dialog for accessibility issues
        const accessibilityScanResults = await axe
            .builder(page, {disableColorContrast: true})
            .include('[role="dialog"]')
            .analyze();

        // * Should have no violations
        expect(accessibilityScanResults.violations).toHaveLength(0);
    },
);

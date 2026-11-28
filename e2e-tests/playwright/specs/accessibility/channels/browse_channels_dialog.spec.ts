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
        const {app} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();

        // # Open the Browse Channels modal
        await app.lhs.header.openBrowseOrAddMenuButton.clickTo(app.lhs.browseOrAddMenu.browseChannelsMenuItem);
        const dialog = await app.lhs.browseOrAddMenu.browseChannelsMenuItem.clickTo(app.browseChannels);

        // * Verify the search input exists
        await expect(dialog.searchTextbox).toBeVisible();

        // # Wait for channel list to load
        await expect(dialog.loading).toHaveCount(0);

        // # Hide already joined channels
        await dialog.hideJoinedCheckbox.check();
        await expect(dialog.hideJoinedCheckbox).toBeChecked();

        // # Focus on Create Channel button and tab through elements
        // Tab order: Close → Search → Channel type filter → Hide Archived → Hide Joined → first channel
        await dialog.createChannelButton.press('Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab');

        // * Verify channel name is highlighted and has proper aria-label
        const channels = dialog.results.channelList;
        await expect.poll(async () => (await channels.keys()).slice(0, 2)).toEqual([channel1.id, channel2.id]);
        const channel1Item = dialog.results.channel(channel1);
        await expect(channel1Item).toHaveAccessibleName(
            `${channel1.display_name.toLowerCase()}, ${channel1.purpose.toLowerCase()}`,
        );
        await expect(channel1Item).toBeFocused();

        // # Press Tab again to move to next channel
        await channel1Item.container.press('Tab');

        // * Verify focus moved to next channel
        const channel2Item = dialog.results.channel(channel2);
        await expect(channel2Item).toHaveAccessibleName(
            `${channel2.display_name.toLowerCase()}, ${channel2.purpose.toLowerCase()}`,
        );
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
        const {app, page} = await pw.testBrowser.login(user);

        // # Visit town-square channel
        await app.channelsPage.goto({team, channel: 'town-square'});
        await expect(app.center.postCreate).toBeVisible();

        // # Open the Browse Channels modal
        await app.lhs.header.openBrowseOrAddMenuButton.clickTo(app.lhs.browseOrAddMenu.browseChannelsMenuItem);
        const dialog = await app.lhs.browseOrAddMenu.browseChannelsMenuItem.clickTo(app.browseChannels);

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
                - checkbox "Hide archived channels" [checked]: Hide Archived
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

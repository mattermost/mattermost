// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, PlaywrightExtended} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

type OpenDialogOptions = {
    command?: string;
    expectedHeading?: string;
};

/**
 * Performs the common setup for /dialog spec files:
 * 1. Initialise server + demo plugin
 * 2. Login and navigate to Town Square
 * 3. Send the slash command
 * 4. Wait for the dialog to open (and optionally assert the heading)
 *
 * Returns the ChannelsPage and the opened dialog Locator so tests can drive
 * per-scenario behaviour.
 */
export async function openDemoDialog(
    pw: PlaywrightExtended,
    {command = '/dialog', expectedHeading}: OpenDialogOptions = {},
) {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // 3. Navigate to Town Square
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 4. Send the slash command
    await channelsPage.centerView.postCreate.input.fill(command);
    await channelsPage.centerView.postCreate.sendMessage();

    // 5. Confirm dialog opens
    const dialog: Locator = channelsPage.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    if (expectedHeading) {
        await expect(dialog.getByRole('heading', {level: 1})).toContainText(expectedHeading);
    }

    return {adminClient, user, team, channelsPage, dialog};
}

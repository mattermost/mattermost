// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, koreanTestPhrase, test, typeKoreanWithIme} from '@mattermost/playwright-lib';

test('Find Channels modal handles Korean IME input correctly', async ({pw, browserName}) => {
    test.skip(browserName !== 'chromium', 'The API used to test this is only available in Chrome');

    const {adminClient, user, team} = await pw.initSetup();

    // # Create a channel named after the test phrase
    const fullMatchChannel = pw.random.channel({
        teamId: team.id,
        name: 'full-match-channel',
        displayName: koreanTestPhrase,
    });
    await adminClient.createChannel(fullMatchChannel);

    // # And create a channel matching part of the test phrase
    const partialMatchChannel = pw.random.channel({
        teamId: team.id,
        name: 'partial-match-channel',
        displayName: koreanTestPhrase.substring(0, 10),
    });
    await adminClient.createChannel(partialMatchChannel);

    // # Log in and go to Channels
    const {channelsPage, page} = await pw.testBrowser.login(user);

    await channelsPage.goto();
    await channelsPage.toBeVisible();

    // # Open the channel switcher
    await channelsPage.sidebarLeft.findChannelButton.click();
    await channelsPage.findChannelsModal.toBeVisible();

    // # Focus the input
    const input = channelsPage.findChannelsModal.input;
    await input.focus();

    const firstHalf = koreanTestPhrase.substring(0, 5);
    const secondHalf = koreanTestPhrase.substring(5);

    // # Type the first half of the test phrase
    await typeKoreanWithIme(page, firstHalf);

    // * Verify that characters are correctly composed and weren't doubled up
    await expect(input).toHaveValue(firstHalf);

    // * Verify that both channels are visible
    await expect(page.getByRole('option', {name: fullMatchChannel.display_name, exact: true})).toBeVisible();
    await expect(page.getByRole('option', {name: partialMatchChannel.display_name, exact: true})).toBeVisible();

    // # Type the second half of the test phrase
    await typeKoreanWithIme(page, secondHalf);

    // * Verify that characters are correctly composed and weren't doubled up
    await expect(input).toHaveValue(koreanTestPhrase);

    // * Verify that the first channel is still visible but that the second is not
    await expect(page.getByRole('option', {name: fullMatchChannel.display_name, exact: true})).toBeVisible();
    await expect(page.getByRole('option', {name: partialMatchChannel.display_name, exact: true})).not.toBeAttached();
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    decomposeKorean,
    expect,
    koreanTestPhrase,
    test,
    typeHangulCharacterWithIme,
    typeHangulWithIme,
} from '@mattermost/playwright-lib';

test('Find Channels modal handles Korean IME input correctly', async ({pw, browserName}) => {
    test.skip(browserName !== 'chromium', 'The API used to test this is only available in Chrome');

    const {adminClient, user, team, townSquare} = await pw.initSetup();

    // # Create a channel named after the test phrase
    const fullMatchChannel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'full-match-channel',
            displayName: koreanTestPhrase,
        }),
    );

    // # And create a channel matching part of the test phrase
    const partialMatchChannel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'partial-match-channel',
            displayName: koreanTestPhrase.substring(0, 10),
        }),
    );

    // # Log in and go to Channels
    const {app, page} = await pw.testBrowser.login(user);

    await app.channelsPage.goto({team, channel: townSquare});

    // # Open the channel switcher
    await app.lhs.header.findChannelsButton.clickTo(app.quickSwitchModal);
    const switcher = app.quickSwitchModal;

    // # Focus the input
    const input = switcher.searchTextbox;
    await input.focus();
    await expect(input).toBeFocused();

    const firstHalf = koreanTestPhrase.substring(0, 5);
    const secondHalf = koreanTestPhrase.substring(5);

    // # Type the first half of the test phrase
    await typeHangulWithIme(page, firstHalf);

    // * Verify that characters are correctly composed and weren't doubled up
    await expect(input).toHaveValue(firstHalf);

    // * Verify that both channels are visible
    await expect(switcher.suggestions.suggestion(fullMatchChannel.id)).toBeVisible();
    await expect(switcher.suggestions.suggestion(partialMatchChannel.id)).toBeVisible();

    // # Type the second half of the test phrase
    await typeHangulWithIme(page, secondHalf);

    // * Verify that characters are correctly composed and weren't doubled up
    await expect(input).toHaveValue(koreanTestPhrase);

    // * Verify that the first channel is still visible but that the second is not
    await expect(switcher.suggestions.suggestion(fullMatchChannel.id)).toBeVisible();
    await expect(switcher.suggestions.suggestion(partialMatchChannel.id)).not.toBeAttached();
});

test('Find Channels autocomplete lists channel after each incomplete Korean character', async ({pw, browserName}) => {
    test.skip(browserName !== 'chromium', 'The API used to test this is only available in Chrome');

    // For future reference of anyone working on this, if Firefox ever supports an equivalent to CDP, this test will
    // likely fail because it seems to handle input value differently when there incomplete IME characters that haven't
    // been committed yet.

    const {adminClient, user, team, townSquare} = await pw.initSetup();

    const randomPrefix = pw.random.id(8);

    // # Create a channel named after the test phrase
    const channel = await adminClient.createChannel(
        pw.random.channel({
            teamId: team.id,
            name: 'korean-autocomplete-channel',
            displayName: randomPrefix + koreanTestPhrase,
        }),
    );

    // # Log in and go to Channels
    const {app, page} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});

    // # Open the Find Channels modal
    await app.lhs.header.findChannelsButton.clickTo(app.quickSwitchModal);
    const switcher = app.quickSwitchModal;

    // # Focus the input
    const input = switcher.searchTextbox;
    await input.focus();
    await expect(input).toBeFocused();

    await input.fill(randomPrefix);
    await expect(input).toHaveValue(randomPrefix);

    const client = await page.context().newCDPSession(page);

    // # Type the test phrase one character at a time, verifying autocomplete after each completed character
    const decomposed = decomposeKorean(koreanTestPhrase);
    for (let i = 0; i < decomposed.length; i++) {
        // # Type the next character using IME composition
        await typeHangulCharacterWithIme(client, decomposed[i], decomposed[i - 1]);

        // * Verify the input contains the correctly composed text so far
        await expect(input).toHaveValue(randomPrefix + koreanTestPhrase.substring(0, i + 1));

        // * Verify that the channel appears in the autocomplete results
        await expect(switcher.suggestions.suggestion(channel.id)).toBeVisible();
    }

    await client.detach();
});

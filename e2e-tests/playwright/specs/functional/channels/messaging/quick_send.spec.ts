// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify rapidly submitted posts stay in the order in which they were sent.
 */
test('MM-T3309 keeps rapidly sent posts in order', {tag: '@messaging'}, async ({pw}) => {
    const {adminClient, team, user} = await pw.initSetup();
    const channel = await adminClient.createPublicChannel(team.id, 'Quick Send');
    await adminClient.addToChannel(user.id, channel.id);

    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, channel.name);
    await channelsPage.toBeVisible();

    // # Send ten single-character messages as quickly as the UI accepts them
    const input = channelsPage.centerView.postCreate.input;
    const sendButton = channelsPage.centerView.postCreate.sendMessageButton;
    const expectedMessages = Array.from({length: 10}, (_, index) => String(9 - index));
    for (const message of expectedMessages) {
        await input.fill(message);
        await sendButton.click();
        await expect(input).toHaveValue('');
    }

    // * Verify all posts render in their original send order
    const sentMessages = channelsPage.centerView.postViews.getByText(/^[0-9]$/, {exact: true});
    await expect(sentMessages).toHaveCount(expectedMessages.length);
    await expect(sentMessages).toHaveText(expectedMessages);
});

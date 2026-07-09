// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a new search replaces the previous results instead of combining them.
 */
test('MM-T355 replaces old search results with new results', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    const helloToken = `hello${pw.random.id()}`;
    const writingToken = `writing${pw.random.id()}`;

    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message in Town Square and search for it
    await channelsPage.postMessage(`${helloToken} there everyone`);
    await channelsPage.searchFor(helloToken);

    // * Verify the first message is shown in the results
    await channelsPage.searchResultsPanel.toContainText(helloToken);

    // # Post a different message in another channel and run a new search for it
    await channelsPage.sidebarLeft.goToItem('off-topic');
    await channelsPage.postMessage(`${writingToken} to you here`);
    await channelsPage.searchFor(writingToken);

    // * Verify the new results are shown and the old results are gone
    await channelsPage.searchResultsPanel.toContainText(writingToken);
    await expect(channelsPage.searchResultsPanel.getResultByText(helloToken)).toHaveCount(0);
});

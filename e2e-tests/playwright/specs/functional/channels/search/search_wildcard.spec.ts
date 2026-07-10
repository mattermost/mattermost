// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that a wildcard (*) is disregarded when it is not immediately preceded by text.
 */
test('MM-T351 disregards a wildcard that is not preceded by text', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post two messages, one with a longer variant of the search term
    const token = `qwerty${pw.random.id()}`;
    await channelsPage.postMessage(`${token}jkl`);
    await channelsPage.postMessage(token);

    // # Search using a trailing wildcard separated by a space
    await channelsPage.searchFor(`${token} *`);

    // * Verify the wildcard is disregarded and the exact-term message is returned
    await channelsPage.searchResultsPanel.toContainText(token);
});

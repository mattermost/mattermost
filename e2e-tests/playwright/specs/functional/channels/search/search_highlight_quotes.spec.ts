// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that searching with trailing double quotes highlights only the searched terms, with no unexpected highlighting.
 */
test('MM-T354 highlights only the searched terms when searching with double quotes', {tag: '@search'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Post a message that contains the two search words plus an unrelated unique word
    const marker = `zzz${pw.random.id()}`;
    await channelsPage.postMessage(`test tool ${marker}`);

    // # Search using the two words followed by an empty double-quoted phrase
    await channelsPage.searchFor('test tool ""');

    // * Verify the message is returned
    await channelsPage.searchResultsPanel.toContainText(marker);

    // * Verify only the two searched words are highlighted (no unexpected highlighting)
    const highlights = channelsPage.searchResultsPanel.getHighlightedTerms();
    await expect(highlights).toHaveCount(2);
    await expect(highlights.filter({hasText: 'test'})).toHaveCount(1);
    await expect(highlights.filter({hasText: 'tool'})).toHaveCount(1);
    await expect(highlights.filter({hasText: marker})).toHaveCount(0);
});

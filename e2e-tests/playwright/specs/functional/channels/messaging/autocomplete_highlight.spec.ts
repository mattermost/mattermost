// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the autocomplete highlight follows the mouse hover and the arrow keys.
 */
test('MM-T71 moves the autocomplete highlight with hover and arrow keys', {tag: '@messaging'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team} = await pw.initSetup();
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // # Type a partial emoji name to open the autocomplete with multiple suggestions
    const {postCreate} = channelsPage.centerView;
    await postCreate.writeMessage(':sm');
    await expect(postCreate.suggestionList).toBeVisible();

    const options = postCreate.suggestionOptions;
    await expect.poll(() => options.count()).toBeGreaterThanOrEqual(3);

    // # Hover over the second suggestion
    await options.nth(1).hover();

    // * Verify the hovered suggestion becomes highlighted
    await expect(options.nth(1)).toHaveAttribute('data-testid', 'suggestion-selected');

    // # Press ArrowDown
    await postCreate.input.press('ArrowDown');

    // * Verify the highlight follows the arrow down key to the next suggestion
    await expect(options.nth(2)).toHaveAttribute('data-testid', 'suggestion-selected');

    // # Press ArrowUp
    await postCreate.input.press('ArrowUp');

    // * Verify the highlight follows the arrow up key to the previous suggestion
    await expect(options.nth(1)).toHaveAttribute('data-testid', 'suggestion-selected');
});

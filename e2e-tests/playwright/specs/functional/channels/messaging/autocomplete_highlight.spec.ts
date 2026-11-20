// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify that the autocomplete highlight follows the mouse hover and the arrow keys.
 */
test('MM-T71 moves the autocomplete highlight with hover and arrow keys', {tag: '@messaging'}, async ({pw}) => {
    // # Create and log in as a test user
    const {user, team, townSquare: channel} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel});

    // # Type a partial emoji name to open the autocomplete with multiple suggestions
    const composer = app.center.postCreate;
    const {suggestions} = composer.message;
    const input = composer.message.container;
    await input.type(':sm');
    await expect.poll(async () => (await suggestions.suggestionList.keys()).length).toBeGreaterThanOrEqual(3);
    const [, second, third] = await suggestions.suggestionList.keys();

    // # Hover over the second suggestion
    await suggestions.suggestion(second).hover();

    // * Verify the hovered suggestion becomes highlighted
    await expect(suggestions.suggestion(second).locator).toHaveClass(/suggestion--selected/); // the list marks the selected row with this class only (no ARIA state)

    // # Press ArrowDown
    await input.press('ArrowDown');

    // * Verify the highlight follows the arrow down key to the next suggestion
    await expect(suggestions.suggestion(third).locator).toHaveClass(/suggestion--selected/); // the list marks the selected row with this class only (no ARIA state)

    // # Press ArrowUp
    await input.press('ArrowUp');

    // * Verify the highlight follows the arrow up key to the previous suggestion
    await expect(suggestions.suggestion(second).locator).toHaveClass(/suggestion--selected/); // the list marks the selected row with this class only (no ARIA state)
});

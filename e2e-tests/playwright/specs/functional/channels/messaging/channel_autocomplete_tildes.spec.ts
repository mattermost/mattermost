// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

/**
 * @objective Verify channel autocomplete closes when a second tilde turns channel syntax into strikethrough syntax.
 */
test(
    'MM-T173 Edit a post with strikethrough and close channel autocomplete after the second tilde',
    {tag: '@messaging'},
    async ({pw}) => {
        const {user, team} = await pw.initSetup();
        const message = `Hello${pw.random.id()}`;

        // # Log in, post a message, and open it for editing with ArrowUp
        const {channelsPage} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();
        await channelsPage.postMessage(message);
        await channelsPage.centerView.postCreate.input.focus();
        await channelsPage.centerView.postCreate.input.press('ArrowUp');
        await channelsPage.centerView.postEdit.toBeVisible();
        const editInput = channelsPage.centerView.postEdit.input;
        const suggestions = channelsPage.centerView.postEdit.suggestionList;

        // # Type one tilde at the start of the message
        await editInput.press('Home');
        await editInput.type('~');

        // * Verify channel autocomplete opens
        await expect(suggestions).toBeVisible();

        // # Type a second tilde at the start of the message
        await editInput.press('Home');
        await editInput.press('ArrowRight');
        await editInput.type('~');

        // * Verify channel autocomplete closes
        await expect(suggestions).not.toBeVisible();

        // # Type one tilde after a space at the end of the message
        await editInput.press('End');
        await editInput.type(' ~');

        // * Verify channel autocomplete opens
        await expect(suggestions).toBeVisible();

        // # Type the second tilde and remove the preceding space
        await editInput.press('End');
        await editInput.type('~');
        await expect(suggestions).not.toBeVisible();
        await editInput.press('End');
        await editInput.press('ArrowLeft');
        await editInput.press('ArrowLeft');
        await editInput.press('Backspace');

        // * Verify autocomplete stays closed
        await expect(suggestions).not.toBeVisible();

        // # Save the edited message
        await editInput.press('Enter');

        // * Verify the original message is rendered as strikethrough
        const editedPost = await channelsPage.getLastPost();
        await editedPost.toHaveStrikethroughText(message);
    },
);

/**
 * @objective Verify channel autocomplete closes when the tilde that opened it is deleted.
 */
test('MM-T174 Autocomplete should close if tildes are deleted using backspace', {tag: '@messaging'}, async ({pw}) => {
    const {user, team} = await pw.initSetup();

    // # Log in, post a message, and open it for editing with ArrowUp
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'off-topic');
    await channelsPage.toBeVisible();
    await channelsPage.postMessage('foo');
    await channelsPage.centerView.postCreate.input.focus();
    await channelsPage.centerView.postCreate.input.press('ArrowUp');
    await channelsPage.centerView.postEdit.toBeVisible();
    const editInput = channelsPage.centerView.postEdit.input;
    const suggestions = channelsPage.centerView.postEdit.suggestionList;

    // # Insert a tilde at the start of the message
    await editInput.press('Home');
    await editInput.type('~');

    // * Verify channel autocomplete opens
    await expect(suggestions).toBeVisible();

    // # Delete the tilde with Backspace
    await editInput.press('Home');
    await editInput.press('ArrowRight');
    await editInput.press('Backspace');

    // * Verify channel autocomplete closes
    await expect(suggestions).not.toBeVisible();

    // # Finish editing
    await editInput.press('Enter');
    await channelsPage.centerView.postEdit.toNotBeVisible();
});

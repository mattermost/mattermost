// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test, Api, settle} from '@mattermost/playwright-lib';

/**
 * @objective Verify channel autocomplete closes when a second tilde turns channel syntax into strikethrough syntax.
 */
test(
    'MM-T173 Edit a post with strikethrough and close channel autocomplete after the second tilde',
    {tag: '@messaging'},
    async ({pw}) => {
        const {user, team, userClient, offTopic} = await pw.initSetup();
        const message = `Hello${pw.random.id()}`;
        const post = await userClient.createPost({channel_id: offTopic.id, message});

        // # Log in and open the post for editing with ArrowUp
        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: offTopic});
        await app.center.postCreate.message.container.press('ArrowUp');
        const editInput = app.postEdit.editor.message.container;
        await expect(editInput).toHaveValue(message);
        const suggestions = app.postEdit.editor.message.suggestions.suggestionList;
        const offTopicKey = `~${offTopic.name}`;

        // # Type one tilde at the start of the message
        await editInput.press('Home', '~');

        // * Verify channel autocomplete opens
        await expect(suggestions).toContainKeys([offTopicKey]);

        // # Type a second tilde at the start of the message
        await editInput.press('Home', 'ArrowRight', '~');

        // * Verify channel autocomplete closes
        await expect(suggestions).toHaveKeyCount(0);

        // # Type one tilde after a space at the end of the message
        await editInput.press('End', 'Space', '~');

        // * Verify channel autocomplete opens
        await expect(suggestions).toContainKeys([offTopicKey]);

        // # Type the second tilde and remove the preceding space
        await editInput.press('End', '~');
        await expect(suggestions).toHaveKeyCount(0);
        await editInput.press('End', 'ArrowLeft', 'ArrowLeft', 'Backspace');

        // * Verify autocomplete stays closed
        await expect(suggestions).toHaveKeyCount(0);

        // # Save the edited message
        await editInput.press('Enter');
        await expect(editInput).not.toBeVisible();

        // * Verify the original message is rendered as strikethrough
        // eslint-disable-next-line test-surface/e2e-no-literal-locators -- the deletion (strikethrough) element is rendered markdown, which cannot take a test id; its role is what is under test
        const strikethrough = app.center.postList.post(post).message.container.locator.getByRole('deletion');
        await expect(strikethrough).toHaveText(message);
    },
);

/**
 * @objective Verify channel autocomplete closes when the tilde that opened it is deleted.
 */
test('MM-T174 Autocomplete should close if tildes are deleted using backspace', {tag: '@messaging'}, async ({pw}) => {
    const {user, team, userClient, offTopic} = await pw.initSetup();
    await userClient.createPost({channel_id: offTopic.id, message: 'foo'});

    // # Log in and open the post for editing with ArrowUp
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: offTopic});
    await app.center.postCreate.message.container.press('ArrowUp');
    const editInput = app.postEdit.editor.message.container;
    await expect(editInput).toHaveValue('foo');
    const suggestions = app.postEdit.editor.message.suggestions.suggestionList;
    const offTopicKey = `~${offTopic.name}`;

    // # Insert a tilde at the start of the message
    await editInput.press('Home', '~');

    // * Verify channel autocomplete opens
    await expect(suggestions).toContainKeys([offTopicKey]);

    // # Delete the tilde with Backspace (the caret is already after the inserted tilde)
    await editInput.press('Backspace');

    // * Verify channel autocomplete closes
    await expect(suggestions).toHaveKeyCount(0);

    // # Save the edit
    await settle(app.postEdit.editor.saveButton, {wait: Api.PatchPost}).click();
    await expect(editInput).not.toBeVisible();
});

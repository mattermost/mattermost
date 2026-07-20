// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - RHS reply composer', TAGS, () => {
    test('WYSIWYG replaces the classic composer in the RHS thread', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const rootEditor = new WysiwygEditor(page.getByTestId('post-create'));
        await rootEditor.postMessage(`thread-root ${pw.random.id()}`);
        const root = await channelsPage.getLastPost();
        await root.reply();
        await channelsPage.sidebarRight.toBeVisible();

        const rhsEditor = new WysiwygEditor(page.locator('#sidebar-right').getByTestId('comment-create'), true);
        await rhsEditor.toBeVisible();

        // pasteText, not type(): opening a thread briefly re-focuses the
        // center composer, splitting a slow per-keystroke type between panes.
        await rhsEditor.pasteText('wysiwyg reply **bold**');
        await expect(rhsEditor.input.locator('strong')).toHaveText('bold');

        await rhsEditor.sendByButton();
        const lastReply = await channelsPage.sidebarRight.getLastPost();
        await lastReply.toContainText('wysiwyg reply');
        await lastReply.toContainText('bold');
    });
});

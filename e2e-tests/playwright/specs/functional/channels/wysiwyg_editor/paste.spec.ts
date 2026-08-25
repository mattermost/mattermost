// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - paste', TAGS, () => {
    test('pasting plain markdown parses into formatted content', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.pasteText('**bold** and *italic* and `code`');

        await expect(editor.input.locator('strong')).toHaveText('bold');
        await expect(editor.input.locator('em')).toHaveText('italic');
        await expect(editor.input.locator('code')).toHaveText('code');
    });

    test('pasting plain text without markdown syntax stays plain', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.pasteText('just some plain words no formatting');

        await expect(editor.input.locator('strong')).toHaveCount(0);
        await expect(editor.input.locator('em')).toHaveCount(0);
        await expect(editor.input).toContainText('just some plain words no formatting');
    });
});

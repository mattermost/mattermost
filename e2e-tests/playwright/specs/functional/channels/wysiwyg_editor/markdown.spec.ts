// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - markdown-as-you-type rich text', TAGS, () => {
    test('bold, italic, and strikethrough marks render inline', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type('**bold** *italic* ~~strike~~');

        await expect(editor.input.locator('strong')).toHaveText('bold');
        await expect(editor.input.locator('em')).toHaveText('italic');
        await expect(editor.input.locator('s')).toHaveText('strike');

        await editor.sendByButton();
        const last = await channelsPage.getLastPost();
        await last.toContainText('bold');
        await last.toContainText('italic');
        await last.toContainText('strike');
    });

    test('heading, list, and blockquote markdown shortcuts are recognized', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        await editor.type('## heading');
        await expect(editor.input.locator('h2')).toHaveText('heading');

        await editor.clear();
        await editor.type('- item one');
        await expect(editor.input.locator('ul li').first()).toContainText('item one');

        await editor.clear();
        await editor.type('> quoted');
        await expect(editor.input.locator('blockquote')).toContainText('quoted');
    });

    test('all-emoji document gets the jumbo class', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type('😀😀😀');

        await expect(editor.input.locator('.WysiwygEditor__emoji--jumbo').first()).toBeVisible();

        await editor.type(' text');
        await expect(editor.input.locator('.WysiwygEditor__emoji--jumbo')).toHaveCount(0);
        await expect(editor.input.locator('.WysiwygEditor__emoji').first()).toBeVisible();
    });
});

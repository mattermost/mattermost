// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - composing and posting', TAGS, () => {
    test('posts a plain-text message', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        const msg = `wysiwyg plain ${pw.random.id()}`;
        await editor.postMessage(msg);

        const last = await channelsPage.getLastPost();
        await last.toContainText(msg);
        expect(await editor.isEmpty()).toBe(true);
    });

    test('placeholder shows when empty and hides after typing', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        await expect(editor.placeholder().first()).toBeVisible();
        await editor.type('x');
        await expect(editor.placeholder()).toHaveCount(0);
    });

    test('ArrowUp on empty composer opens the inline edit for the last post', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.postMessage(`edit-me ${pw.random.id()}`);
        await editor.press('ArrowUp');

        await expect(page.getByTestId('post-edit-container')).toBeVisible();
    });
});

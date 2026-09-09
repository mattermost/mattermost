// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - formatting bar', TAGS, () => {
    test('bold and italic toolbar buttons wrap the selection', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();
        await editor.type('formatme');
        await editor.press('ControlOrMeta+a');

        await editor.formattingBar.getByRole('button', {name: /bold/i}).click();
        await expect(editor.input.locator('strong')).toHaveText('formatme');

        await editor.formattingBar.getByRole('button', {name: /italic/i}).click();
        await expect(editor.input.locator('strong em, em strong')).toHaveText('formatme');
    });
});

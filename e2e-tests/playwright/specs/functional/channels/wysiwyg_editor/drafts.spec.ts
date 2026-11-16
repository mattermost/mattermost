// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, setWysiwygUserPreference, test, WysiwygEditor} from '@mattermost/playwright-lib';

const TAGS = {tag: ['@channels', '@wysiwyg_editor']};

test.describe('WYSIWYG editor - drafts', TAGS, () => {
    test.beforeEach(async ({pw}) => {
        await pw.ensureFeatureFlag('WysiwygEditor', true);
    });

    /**
     * @objective Verify drafts typed right before switching channels are kept for each channel,
     * even when the next channel's draft changes before the first one is saved.
     */
    test('keeps drafts typed right before quick channel switches', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        const offTopicDraft = `off-topic-draft-${pw.random.id()}`;
        const townSquareDraft = `town-square-draft-${pw.random.id()}`;

        // # Type in Off-Topic and switch away without waiting for the draft to save
        await editor.type(offTopicDraft);
        await channelsPage.sidebarLeft.goToItem('town-square');
        await channelsPage.centerView.header.toHaveTitle('Town Square');

        // # Type in Town Square and switch back right away
        await editor.type(townSquareDraft);
        await channelsPage.sidebarLeft.goToItem('off-topic');
        await channelsPage.centerView.header.toHaveTitle('Off-Topic');

        // * Each channel restores its own draft
        await expect(editor.input).toHaveText(offTopicDraft);

        await channelsPage.sidebarLeft.goToItem('town-square');
        await channelsPage.centerView.header.toHaveTitle('Town Square');
        await expect(editor.input).toHaveText(townSquareDraft);
    });

    /**
     * @objective Verify pressing Enter immediately after typing sends the full text.
     */
    test('Enter sends text typed just before it', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        const msg = `wysiwyg quick send ${pw.random.id()}`;

        // # Type and press Enter without waiting for the send button to enable
        await editor.type(msg);
        await editor.press('Enter');

        // * The whole message is posted and the editor is cleared
        const last = await channelsPage.getLastPost();
        await last.toContainText(msg);
        await expect(editor.input).toHaveText('');
    });

    /**
     * @objective Verify a restored draft places the cursor at the end so typing continues it.
     */
    test('continues a restored draft at its end', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        await editor.toBeVisible();

        const draft = `restored-draft-${pw.random.id()}`;

        // # Leave a draft, then switch away and back
        await editor.type(draft);
        await channelsPage.sidebarLeft.goToItem('town-square');
        await channelsPage.centerView.header.toHaveTitle('Town Square');
        await channelsPage.sidebarLeft.goToItem('off-topic');
        await channelsPage.centerView.header.toHaveTitle('Off-Topic');
        await expect(editor.input).toHaveText(draft);

        // # Keep typing without moving the cursor
        await expect(editor.input).toBeFocused();
        await page.keyboard.type(' continued');

        // * The new text is appended to the draft
        await expect(editor.input).toHaveText(`${draft} continued`);
    });

    /**
     * @objective Verify editing a post places the cursor at the end of its message.
     */
    test('continues a message opened for editing at its end', async ({pw}) => {
        const {user, userClient, team} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {channelsPage, page} = await pw.testBrowser.login(user);
        await channelsPage.goto(team.name, 'off-topic');
        await channelsPage.toBeVisible();

        const editor = new WysiwygEditor(page.getByTestId('post-create'));
        const msg = `edit-me ${pw.random.id()}`;
        await editor.postMessage(msg);
        await (await channelsPage.getLastPost()).toContainText(msg);

        // # Open the last post for editing and type without moving the cursor
        await editor.press('ArrowUp');
        const editInput = page.getByTestId('post-edit-container').getByTestId('edit_textbox');
        await expect(editInput).toHaveText(msg);
        await expect(editInput).toBeFocused();
        await page.keyboard.type(' edited');
        await expect(editInput).toHaveText(`${msg} edited`);

        // # Save the edit
        await editInput.press('Enter');

        // * The post shows the appended text
        await expect(page.getByTestId('post-edit-container')).toHaveCount(0);
        await (await channelsPage.getLastPost()).toContainText(`${msg} edited`);
    });
});

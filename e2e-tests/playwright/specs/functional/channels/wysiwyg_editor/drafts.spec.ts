// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Api, expect, postWith, setWysiwygUserPreference, settle, test} from '@mattermost/playwright-lib';

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
        const {user, userClient, team, offTopic, townSquare} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: offTopic});

        const editor = app.center.postCreate.message.container;
        await expect(editor).toBeVisible();

        const offTopicDraft = `off-topic-draft-${pw.random.id()}`;
        const townSquareDraft = `town-square-draft-${pw.random.id()}`;

        // # Type in Off-Topic and switch away without waiting for the draft to save
        await editor.type(offTopicDraft);
        await app.lhs.channelList.channel(townSquare).container.click();
        await expect(app.channelHeader.openMenuButton).toContainText(townSquare.display_name);
        await expect(app.channelHeader.openMenuButton).toContainText('Town Square');

        // # Type in Town Square and switch back right away
        await editor.type(townSquareDraft);
        await app.lhs.channelList.channel(offTopic).container.click();
        await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
        await expect(app.channelHeader.openMenuButton).toContainText('Off-Topic');

        // * Each channel restores its own draft
        await expect(editor).toHaveText(offTopicDraft);

        await app.lhs.channelList.channel(townSquare).container.click();

        await expect(app.channelHeader.openMenuButton).toContainText(townSquare.display_name);
        await expect(app.channelHeader.openMenuButton).toContainText('Town Square');
        await expect(editor).toHaveText(townSquareDraft);
    });

    /**
     * @objective Verify pressing Enter immediately after typing sends the full text.
     */
    test('Enter sends text typed just before it', async ({pw}) => {
        const {user, userClient, team, offTopic} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: offTopic});

        const editor = app.center.postCreate.message.container;
        await expect(editor).toBeVisible();

        const msg = `wysiwyg quick send ${pw.random.id()}`;

        // # Type and press Enter without waiting for the send button to enable
        await editor.type(msg);
        await settle(editor, {wait: Api.CreatePost}).press('Enter');

        // * The whole message is posted and the editor is cleared
        await postWith(app.center.postList, {text: msg});
        await expect(editor).toHaveText('');
    });

    /**
     * @objective Verify a restored draft places the cursor at the end so typing continues it.
     */
    test('continues a restored draft at its end', async ({pw}) => {
        const {user, userClient, team, offTopic, townSquare} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {page, app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: offTopic});

        const editor = app.center.postCreate.message.container;
        await expect(editor).toBeVisible();

        const draft = `restored-draft-${pw.random.id()}`;

        // # Leave a draft, then switch away and back
        await editor.type(draft);
        await app.lhs.channelList.channel(townSquare).container.click();
        await expect(app.channelHeader.openMenuButton).toContainText(townSquare.display_name);
        await expect(app.channelHeader.openMenuButton).toContainText('Town Square');
        await app.lhs.channelList.channel(offTopic).container.click();
        await expect(app.channelHeader.openMenuButton).toContainText(offTopic.display_name);
        await expect(app.channelHeader.openMenuButton).toContainText('Off-Topic');
        await expect(editor).toHaveText(draft);

        // # Keep typing without moving the cursor
        await expect(editor).toBeFocused();
        await page.keyboard.type(' continued');

        // * The new text is appended to the draft
        await expect(editor).toHaveText(`${draft} continued`);
    });

    /**
     * @objective Verify editing a post places the cursor at the end of its message.
     */
    test('continues a message opened for editing at its end', async ({pw}) => {
        const {user, userClient, team, offTopic} = await pw.initSetup();
        await setWysiwygUserPreference(userClient, user.id, true);

        const {page, app} = await pw.testBrowser.login(user);
        await app.channelsPage.goto({team, channel: offTopic});

        const editor = app.center.postCreate.message.container;
        const msg = `edit-me ${pw.random.id()}`;
        await editor.type(msg);
        await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();
        await postWith(app.center.postList, {text: msg});

        // # Open the last post for editing and type without moving the cursor
        await editor.press('ArrowUp');
        const editInput = app.postEdit.editor.message.container;
        await expect(editInput).toHaveText(msg);
        await expect(editInput).toBeFocused();
        await page.keyboard.type(' edited');
        await expect(editInput).toHaveText(`${msg} edited`);

        // # Save the edit
        await settle(editInput, {wait: Api.PatchPost}).press('Enter');

        // * The post shows the appended text
        await expect(app.postEdit.editor).not.toBeVisible();
        await postWith(app.center.postList, {text: `${msg} edited`});
    });
});

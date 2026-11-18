// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getAsset} from '@/asset';
import {Api, settle, expect, test, type App, type PlaywrightExtended} from '@mattermost/playwright-lib';

const ORIGINAL_MESSAGE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

type Composer = App['center']['postCreate'] | App['postEdit']['editor'];
type Post = ReturnType<App['center']['postList']['post']>;

/** Attaches files through a composer's attach button and waits for their previews. */
async function attach(app: App, composer: Composer, files: string[]) {
    const before = (await composer.filePreviews.fileList.keys()).length;
    await composer.uploadInput.chooseFiles(files.map((file) => getAsset(file)));
    await expect(composer.filePreviews.fileList).toHaveKeyCount(before + files.length);
}

/** Opens the user's town square. */
async function open(pw: PlaywrightExtended) {
    const {user, team, townSquare} = await pw.initSetup();
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: townSquare});
    return app;
}

/** Posts a message (with files) from the center composer and returns the new post. */
async function postMessage(app: App, message: string, files: string[] = []): Promise<{id: string; post: Post}> {
    const {postCreate, postList} = app.center;
    if (files.length) {
        await attach(app, postCreate, files);
    }
    await postCreate.message.container.fill(message);
    const sent = await settle(postCreate.sendButton, {wait: Api.CreatePost}).click();
    const post = postList.post(sent);
    await expect(post.message.container).toContainText(message);
    return {id: sent.id, post};
}

/** Opens a post's dot menu. */
async function openDotMenu(app: App, post: {container: Post['container']; menu: Post['menu']}) {
    await post.container.hover();
    await post.menu.dotMenuButton.clickTo(app.postDotMenu);
    const menu = app.postDotMenu;

    // park the cursor so it doesn't open a submenu (e.g. "Remind") under it, which hides the menu from roles
    await app.page.mouse.move(0, 0);
    return menu;
}

/** Opens the inline editor on a post from its dot menu. */
async function openEditor(app: App, post: {container: Post['container']; menu: Post['menu']}) {
    await (await openDotMenu(app, post)).editMenuItem.click();
    const editor = app.postEdit.editor;
    await expect(editor.message.container).toBeVisible();
    return editor;
}

/** Removes a file from the editor by its name. */
async function removeFile(editor: Composer, name: string) {
    const file = await editor.filePreviews.fileList.itemWith({text: name});
    await file.removeButton.click();
    await expect(file).toHaveCount(0);
}

/** Saves the editor and waits for it to close. */
async function save(editor: App['postEdit']['editor']) {
    await settle(editor.saveButton, {wait: Api.PatchPost}).click();
    await expect(editor.message.container).not.toBeVisible();
}

/**
 * @objective Verify that users can edit a post and modify its content
 */
test('MM-T5654_1 should be able to add attachments while editing a post', {tag: ['@smoke']}, async ({pw}) => {
    // # Initialize user, login and post a message
    const app = await open(pw);
    const {post} = await postMessage(app, ORIGINAL_MESSAGE);

    // # Edit the message and save
    const editor = await openEditor(app, post);
    await editor.message.container.fill('Edited message');
    await expect(editor.message.container).toHaveValue('Edited message');
    await save(editor);

    // * Verify the post was updated with the edited message
    await expect(post.message.container).toContainText('Edited message');
});

test('MM-T5654_2 should be able to add attachments while editing a threaded post', async ({pw}) => {
    const app = await open(pw);
    const {post} = await postMessage(app, ORIGINAL_MESSAGE);

    // # Reply to the post in the RHS
    await (await openDotMenu(app, post)).replyMenuItem.click();
    const {postCreate, thread} = app.rhs;
    await expect(postCreate.message.container).toBeVisible();
    await postCreate.message.container.fill('Replying to the post');
    const sentReply = await settle(postCreate.sendButton, {wait: Api.CreatePost}).click();
    await expect(thread.postList).toHaveKeyCount(2);
    const reply = thread.post(sentReply);
    await expect(reply.message.container).toContainText('Replying to the post');

    // # Edit the reply
    let editor = await openEditor(app, reply);
    await editor.message.container.fill('Edited reply message');
    await expect(editor.message.container).toHaveValue('Edited reply message');
    await save(editor);
    await expect(reply.message.container).toContainText('Edited reply message');

    // # Edit the reply again and add files to it
    editor = await openEditor(app, reply);
    await editor.message.container.fill('Edited reply message with files');
    await expect(editor.message.container).toHaveValue('Edited reply message with files');
    await attach(app, editor, ['sample_text_file.txt', 'mattermost.png']);
    await save(editor);
    await expect(reply).toContainText('Edited reply message with files');
    await expect(reply).toContainText('sample_text_file.txt');
    await expect(reply).toContainText('mattermost.png');

    // # Remove the files
    editor = await openEditor(app, reply);
    await removeFile(editor, 'sample_text_file.txt');
    await removeFile(editor, 'mattermost.png');
    await save(editor);

    await expect(reply).toContainText('Edited reply message with files');
    await expect(reply).not.toContainText('sample_text_file.txt');
    await expect(reply).not.toContainText('mattermost.png');
});

test('MM-T5654_3 should be able to edit post message originally containing files', async ({pw}) => {
    const app = await open(pw);
    const {post} = await postMessage(app, ORIGINAL_MESSAGE, ['sample_text_file.txt']);

    const editor = await openEditor(app, post);
    await editor.message.container.fill('Edited message');
    await expect(editor.message.container).toHaveValue('Edited message');
    await save(editor);

    await expect(post.message.container).toContainText('Edited message');
    await expect(post).toContainText('sample_text_file.txt');
});

test('MM-T5654_4 should be able to add files when editing a post', async ({pw}) => {
    const app = await open(pw);
    const {post} = await postMessage(app, ORIGINAL_MESSAGE);

    let editor = await openEditor(app, post);
    await editor.message.container.fill('Edited message');
    await expect(editor.message.container).toHaveValue('Edited message');
    await attach(app, editor, ['sample_text_file.txt']);
    await save(editor);

    await expect(post.message.container).toContainText('Edited message');
    await expect(post).toContainText('sample_text_file.txt');

    // # Add multiple files
    editor = await openEditor(app, post);
    await attach(app, editor, ['mattermost.png', 'archive.zip']);
    await save(editor);

    await expect(post.message.container).toContainText('Edited message');
    await expect(post).toContainText('sample_text_file.txt');
    await expect(post).toContainText('mattermost.png');
    await expect(post).toContainText('archive.zip');
});

test('MM-5654_5 should be able to remove attachments while editing a post', async ({pw}) => {
    const app = await open(pw);
    const {post} = await postMessage(app, ORIGINAL_MESSAGE, ['sample_text_file.txt', 'mattermost.png', 'archive.zip']);
    await expect(post).toContainText('sample_text_file.txt');
    await expect(post).toContainText('mattermost.png');
    await expect(post).toContainText('archive.zip');

    const editor = await openEditor(app, post);
    await removeFile(editor, 'sample_text_file.txt');
    await save(editor);

    await expect(post.message.container).toContainText(ORIGINAL_MESSAGE);
    await expect(post).toContainText('mattermost.png');
    await expect(post).toContainText('archive.zip');
    await expect(post).not.toContainText('sample_text_file.txt');
});

test('MM-T5655_1 removing message content and files should delete the post', async ({pw}) => {
    const app = await open(pw);
    const {post} = await postMessage(app, ORIGINAL_MESSAGE, ['sample_text_file.txt']);
    await expect(post).toContainText('sample_text_file.txt');

    // # Remove the file and the message, then save
    const editor = await openEditor(app, post);
    await removeFile(editor, 'sample_text_file.txt');
    await editor.message.container.clear();
    await editor.saveButton.clickTo(app.deletePostModal);

    // # Confirm the deletion it asks for
    await app.deletePostModal.deleteButton.click();
    await expect(app.deletePostModal).not.toBeVisible();

    // * The post is gone
    await expect(post).toHaveCount(0);
    await expect(app.center.postList).not.toContainText(ORIGINAL_MESSAGE);
});

test('MM-T5655_2 should be able to remove all files when editing a post', async ({pw}) => {
    const app = await open(pw);
    const {post} = await postMessage(app, ORIGINAL_MESSAGE, ['sample_text_file.txt', 'mattermost.png', 'archive.zip']);
    await expect(post).toContainText('archive.zip');

    const editor = await openEditor(app, post);
    await removeFile(editor, 'sample_text_file.txt');
    await removeFile(editor, 'mattermost.png');
    await removeFile(editor, 'archive.zip');
    await save(editor);

    await expect(post.message.container).toContainText(ORIGINAL_MESSAGE);
    await expect(post).not.toContainText('archive.zip');
    await expect(post).not.toContainText('mattermost.png');
    await expect(post).not.toContainText('sample_text_file.txt');
});

test('MM-T5656_1 should be able to restore previously edited post version that contains attachments', async ({pw}) => {
    const newMessage = 'New Message';
    const app = await open(pw);
    const {id: postId, post} = await postMessage(app, ORIGINAL_MESSAGE, ['sample_text_file.txt']);
    await expect(post).toContainText('sample_text_file.txt');

    // # Edit: remove the file and change the message
    const editor = await openEditor(app, post);
    await removeFile(editor, 'sample_text_file.txt');
    await editor.message.container.fill(newMessage);
    await expect(editor.message.container).toHaveValue(newMessage);
    await save(editor);

    await expect(post.message.container).toContainText(newMessage);
    await expect(post).not.toContainText('sample_text_file.txt');

    // # Open the edit history from the post's Edited indicator
    await post.editedHistoryButton.click();
    const history = app.rhs.editHistory;

    // * The current version (keyed by the post's id) shows the new message
    const current = history.version({id: postId});
    await expect(current.current).toBeVisible();
    await expect(current.message.container).toContainText(newMessage);

    // # Restore the previous version (the other one in the history), and confirm
    await expect(history.versionList).toHaveKeyCount(2);
    const [previousId] = (await history.versionList.keys()).filter((key) => key !== postId);
    const previous = history.version({id: previousId});
    await previous.container.hover();
    await previous.restoreButton.click();
    await expect(app.restorePostModal).toBeVisible();
    await settle(app.restorePostModal.confirmButton, {wait: Api.RestorePostVersion}).click();
    await expect(app.restorePostModal).not.toBeVisible();

    // * The restored post has its file again
    await expect(post).toContainText('sample_text_file.txt');
});

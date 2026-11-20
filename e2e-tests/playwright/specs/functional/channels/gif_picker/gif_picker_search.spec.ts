// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';

import {expect, test, type App, Api, settle} from '@mattermost/playwright-lib';

/**
 * The picker shows GIPHY's description as a GIF's alt text, while the posted image is alt-texted with the GIF's
 * title, so a GIF is matched by its GIPHY media id: the path segment before the file name in both image URLs
 * (`/media/<id>/200.gif`, `/media/v1.<token>/<id>/giphy.webp`).
 */
function giphyId(src: string | null) {
    return src ? new URL(src).pathname.split('/').at(-2) : undefined;
}

/** Searches the open picker's GIF tab for `term`, picks the first result, and returns its GIPHY media id. */
async function pickGif(app: App, term: string) {
    // * Verify emoji/gif picker popup appears
    await expect(app.emojiGifPicker.tab('gifs')).toBeVisible();

    // # Switch to GIF tab in the picker
    // The picker's tabs are plain elements without a role, so the tab is clicked through its locator.
    await app.emojiGifPicker.tab('gifs').click();
    await expect(app.gifPicker.items).toBeVisible();

    // # Search for GIFs using the term
    await app.gifPicker.searchTextbox.fill(term);

    // # Select the first GIF from search results
    const first = app.gifPicker.items.locator.getByRole('img').first();
    await expect(first).toBeVisible();
    const id = giphyId(await first.getAttribute('src'));
    expect(id).toBeTruthy();
    await first.click();
    await expect(first).not.toBeVisible();
    return id;
}

/** The image in the post a list shows after its first `before` posts, once that post shows. */
async function newPostImage(list: App['center']['postList'] | App['rhs']['thread'], before: number): Promise<Locator> {
    await expect.poll(async () => (await list.postList.keys()).length).toBeGreaterThan(before);
    const id = (await list.postList.keys()).at(-1)!;
    return list.post({id}).markdown.image.container.locator;
}

/**
 * @objective Verify that users can search for GIFs, select them, and post them correctly when using the center textbox.
 */
test.fixme(
    'MM-T5445 searches for GIF from center textbox and posts selected GIF correctly',
    {tag: '@gif_picker'},
    async ({pw}) => {
        // # Initialize a test user
        const {user, team} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {app} = await pw.testBrowser.login(user);

        // # Navigate to default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();

        // # Open emoji/gif picker from center textbox, and pick a GIF for "hello"
        const composer = app.center.postCreate;
        await composer.emojiButton.click();
        await expect(app.emojiGifPicker.tab('gifs')).toBeVisible();
        const picked = await pickGif(app, 'hello');

        // # Send the selected GIF as a message
        const before = (await app.center.postList.postList.keys()).length;
        await settle(composer.sendButton, {wait: Api.CreatePost}).click();

        // * Verify the posted message contains the selected GIF
        const image = await newPostImage(app.center.postList, before);
        await expect(image).toHaveAttribute('src', new RegExp(`/${picked}/`));
    },
);

/**
 * @objective Verify that users can search for GIFs, select them, and post them correctly when using the right-hand sidebar.
 */
test.fixme(
    'MM-T5446 searches for GIF from RHS textbox and posts selected GIF correctly in thread',
    {tag: '@gif_picker'},
    async ({pw}) => {
        // # Initialize a test user
        const {user, team} = await pw.initSetup();

        // # Log in as a user in new browser context
        const {app} = await pw.testBrowser.login(user);

        // # Navigate to default channel page
        await app.teamPage.goto({team});
        await expect(app.center.composer).toBeVisible();

        // # Post a message to create a thread
        const center = app.center.postCreate;
        await center.message.container.fill('Message to open RHS');
        await settle(center.sendButton, {wait: Api.CreatePost}).click();

        // # Open the message in right-hand sidebar to start a thread
        const {postList} = app.center;
        await expect.poll(async () => (await postList.postList.keys()).length).toBeGreaterThan(0);
        const post = postList.post({id: (await postList.postList.keys()).at(-1)!});
        await post.container.hover();
        await post.menu.replyButton.click();

        // * Verify right sidebar opens and is visible
        const reply = app.rhs.postCreate;
        await expect(reply.message.container).toBeVisible();

        // # Post an initial reply in the thread
        await reply.message.container.fill('Replying to a thread');
        await settle(reply.sendButton, {wait: Api.CreatePost}).click();

        // # Open emoji/gif picker from the RHS textbox, and pick a GIF for "hello"
        await reply.emojiButton.click();
        await expect(app.emojiGifPicker.tab('gifs')).toBeVisible();
        const picked = await pickGif(app, 'hello');

        // # Send the selected GIF as a message in the thread
        const before = (await app.rhs.thread.postList.keys()).length;
        await settle(reply.sendButton, {wait: Api.CreatePost}).click();

        // * Verify the posted message in the thread contains the selected GIF
        const image = await newPostImage(app.rhs.thread, before);
        await expect(image).toHaveAttribute('src', new RegExp(`/${picked}/`));
    },
);

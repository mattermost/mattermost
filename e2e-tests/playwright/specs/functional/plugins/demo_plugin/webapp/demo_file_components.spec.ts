// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {Api, expect, getFileFromAsset, settle, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal, uploadFileViaYourComputer} from '../helpers';

async function uploadDemoFile(client: Client4, channelId: string) {
    const file = getFileFromAsset('sample-file.demo');
    const formData = new FormData();
    formData.set('files', file, 'sample-file.demo');
    formData.set('channel_id', channelId);
    const result = await client.uploadFile(formData);
    const post = await client.createPost({
        channel_id: channelId,
        message: '',
        file_ids: [result.file_infos[0].id],
    });
    return {post, file: result.file_infos[0]};
}

test('should show "Upload using Demo Plugin" entry in attachment menu and open Root Modal', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Click the attachment button to open the upload type menu
    await app.center.postCreate.attachButton.click();

    // * Verify both upload entries are visible
    await expect(app.page.getByText('Your computer')).toBeVisible();
    await expect(app.page.getByText('Upload using Demo Plugin')).toBeVisible();

    // # Click "Upload using Demo Plugin"
    await app.page.getByText('Upload using Demo Plugin').click();
    await expect(
        app.page.getByText('You have triggered the root component of the demo plugin.', {exact: true}),
    ).toBeVisible();

    // * Verify Root Modal opens (no element context for this entry point)
    await assertRootModal(app.page);
    await closeRootModal(app.page);
});

test('should show Demo Plugin entry in file attachment dropdown for .demo files and open Root Modal', async ({pw}) => {
    // # Setup
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Create a channel, add user, upload a .demo file via API
    // (API upload avoids the demo plugin's attachment submenu interception)
    const channel = pw.random.channel({
        teamId: team.id,
        name: 'demo-file-test',
        displayName: 'Demo File Test',
    });
    const createdChannel = await adminClient.createChannel(channel);
    await adminClient.addToChannel(user.id, createdChannel.id);
    const uploaded = await uploadDemoFile(adminClient, createdChannel.id);

    // # Login and navigate to the channel
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'demo-file-test'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Hover the file attachment to reveal the kebab menu, scoped to the post
    const post = app.center.postList.post({id: uploaded.post.id});
    const file = post.attachments.fileCard({id: uploaded.file.id});
    await expect(file).toContainText('sample-file.demo');
    await file.container.hover();
    await expect(file.moreActionsButton).toBeVisible();
    await file.moreActionsButton.click();

    // * Verify the file attachment dropdown contains the Demo Plugin entry
    await expect(app.page.getByRole('menuitem', {name: 'Get a public link'})).toBeVisible();
    await expect(app.page.getByRole('menuitem', {name: 'Demo Plugin'})).toBeVisible();

    // # Click "Demo Plugin"
    await app.page.getByRole('menuitem', {name: 'Demo Plugin'}).click();
    await expect(
        app.page.getByText('You have triggered the root component of the demo plugin.', {exact: true}),
    ).toBeVisible();

    // * Verify Root Modal opens
    await assertRootModal(app.page);
    await closeRootModal(app.page);
});

test('should render custom preview for .demo files', async ({pw}) => {
    // # Setup
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Upload a .demo file via API to a dedicated channel
    const channel = pw.random.channel({
        teamId: team.id,
        name: 'demo-preview-test',
        displayName: 'Demo Preview Test',
    });
    const createdChannel = await adminClient.createChannel(channel);
    await adminClient.addToChannel(user.id, createdChannel.id);
    const uploaded = await uploadDemoFile(adminClient, createdChannel.id);

    // # Login and navigate to the channel
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'demo-preview-test'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Click the file thumbnail to open the preview
    const file = app.center.postList.post({id: uploaded.post.id}).attachments.fileCard({id: uploaded.file.id});
    await expect(file.thumbnailLink).toHaveAccessibleName(/file thumbnail sample-file\.demo/);
    await file.thumbnailLink.click();

    // * Verify the preview dialog opens with the custom demo plugin content
    const previewDialog = app.page.getByRole('dialog');
    await expect(previewDialog).toBeVisible();

    // The custom demo plugin preview renders the filename as an h3 heading
    await expect(previewDialog.getByRole('heading', {name: 'sample-file.demo', level: 3})).toBeVisible();

    // The plugin also renders a Close button inside the preview content area
    // (distinct from the standard modal Close/X in the header)
    const pluginCloseButton = previewDialog.getByRole('button', {name: 'Close'}).last();
    await expect(pluginCloseButton).toBeVisible();

    // Standard file preview chrome is also present
    await expect(previewDialog.getByText(/Shared in ~/)).toBeVisible();
    await expect(previewDialog.getByRole('link', {name: 'Download'})).toBeVisible();

    // # Close via the plugin's Close button
    await pluginCloseButton.click();

    // * Verify the preview dialog closes
    await expect(previewDialog).not.toBeVisible();
});

test('should upload a file via "Your computer" from the demo plugin attachment submenu', async ({pw}) => {
    // # Setup
    const {user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Login and navigate to Town Square
    const {app} = await pw.testBrowser.login(user);
    await app.channelsPage.goto({team, channel: {name: 'town-square'}});
    await expect(app.center.postCreate.message.container).toBeVisible();

    // # Upload a file via the UI — the demo plugin intercepts the attachment button
    // and shows a submenu. uploadFileViaYourComputer clicks "Your computer" to reach
    // the native file chooser.
    await uploadFileViaYourComputer(app.page, app.center.postCreate.attachButton, 'sample_text_file.txt');

    // * Verify the file preview appears in the compose area before sending
    const previews = app.center.postCreate.filePreviews;
    await expect(previews.fileList).toHaveKeyCount(1);
    const [fileId] = await previews.fileList.keys();
    await expect(previews.file({id: fileId}).details).toBeVisible();
    await expect(previews).toContainText('sample_text_file.txt');

    // # Send the message with file
    await app.center.postCreate.message.container.fill('file upload test');
    await expect(app.center.postCreate.message.container).toHaveValue('file upload test');
    const sent = await settle(app.center.postCreate.sendButton, {wait: Api.CreatePost}).click();

    // * Verify the file attachment appears in the channel post
    const lastPost = app.center.postList.post({id: sent.id});
    // File cards have no generated filename text part; retain the visible filename check inside the sent post's attachments.
    await expect(lastPost.attachments.container.locator.getByText('sample_text_file.txt')).toBeVisible();
});

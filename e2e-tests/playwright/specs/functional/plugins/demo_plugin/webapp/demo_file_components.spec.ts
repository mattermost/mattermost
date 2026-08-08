// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {expect, getFileFromAsset, test} from '@mattermost/playwright-lib';

import {assertRootModal, closeRootModal, setupDemoPlugin, uploadFileViaYourComputer} from '../helpers';

async function uploadDemoFile(client: Client4, channelId: string): Promise<void> {
    const file = getFileFromAsset('sample-file.demo');
    const formData = new FormData();
    formData.set('files', file, 'sample-file.demo');
    formData.set('channel_id', channelId);
    const result = await client.uploadFile(formData);
    await client.createPost({
        channel_id: channelId,
        message: '',
        file_ids: [result.file_infos[0].id],
    });
}

test('should show "Upload using Demo Plugin" entry in attachment menu and open Root Modal', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Click the attachment button to open the upload type menu
    await channelsPage.centerView.postCreate.attachmentButton.click();

    // 4. Verify both upload entries are visible
    await expect(channelsPage.page.getByText('Your computer')).toBeVisible();
    await expect(channelsPage.page.getByText('Upload using Demo Plugin')).toBeVisible();

    // 5. Click "Upload using Demo Plugin" — opens the Root Modal
    await channelsPage.page.getByText('Upload using Demo Plugin').click();

    // 6. Assert Root Modal (no element context for this entry point)
    await assertRootModal(channelsPage.page);
    await closeRootModal(channelsPage.page);
});

test('should show Demo Plugin entry in file attachment dropdown for .demo files and open Root Modal', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Create a channel, add user, upload a .demo file via API
    // (API upload avoids the demo plugin's attachment submenu interception)
    const channel = pw.random.channel({
        teamId: team.id,
        name: 'demo-file-test',
        displayName: 'Demo File Test',
    });
    const createdChannel = await adminClient.createChannel(channel);
    await adminClient.addToChannel(user.id, createdChannel.id);
    await uploadDemoFile(adminClient, createdChannel.id);

    // 3. Login and navigate to the channel
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'demo-file-test');
    await channelsPage.toBeVisible();

    // 4. Hover the file attachment to reveal the kebab menu, scoped to the post
    const post = channelsPage.centerView.container.getByRole('listitem').filter({hasText: 'sample-file.demo'}).last();
    await post.getByText('sample-file.demo').hover();
    await post.getByRole('button', {name: 'more actions'}).click();

    // 5. Verify the file attachment dropdown contains the Demo Plugin entry
    await expect(channelsPage.page.getByRole('menuitem', {name: 'Get a public link'})).toBeVisible();
    await expect(channelsPage.page.getByRole('menuitem', {name: 'Demo Plugin'})).toBeVisible();

    // 6. Click "Demo Plugin" — opens Root Modal
    await channelsPage.page.getByRole('menuitem', {name: 'Demo Plugin'}).click();

    // 7. Assert Root Modal
    await assertRootModal(channelsPage.page);
    await closeRootModal(channelsPage.page);
});

test('should render custom preview for .demo files', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Upload a .demo file via API to a dedicated channel
    const channel = pw.random.channel({
        teamId: team.id,
        name: 'demo-preview-test',
        displayName: 'Demo Preview Test',
    });
    const createdChannel = await adminClient.createChannel(channel);
    await adminClient.addToChannel(user.id, createdChannel.id);
    await uploadDemoFile(adminClient, createdChannel.id);

    // 3. Login and navigate to the channel
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'demo-preview-test');
    await channelsPage.toBeVisible();

    // 4. Click the file thumbnail to open the preview
    await channelsPage.page.getByRole('link', {name: /file thumbnail sample-file\.demo/}).click();

    // 5. Verify the preview dialog opens with the custom demo plugin content
    const previewDialog = channelsPage.page.getByRole('dialog');
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

    // 6. Close via the plugin's Close button
    await pluginCloseButton.click();
    await expect(previewDialog).not.toBeVisible();
});

test('should upload a file via "Your computer" from the demo plugin attachment submenu', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Login and navigate to Town Square
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'town-square');
    await channelsPage.toBeVisible();

    // 3. Upload a file via the UI — the demo plugin intercepts the attachment button
    // and shows a submenu. uploadFileViaYourComputer clicks "Your computer" to reach
    // the native file chooser.
    await uploadFileViaYourComputer(
        channelsPage.page,
        channelsPage.centerView.postCreate.attachmentButton,
        'sample_text_file.txt',
    );

    // 4. Verify the file preview appears in the compose area before sending
    await channelsPage.centerView.postCreate.waitUntilFilePreviewContains(['sample_text_file.txt']);

    // 5. Send the message with file
    await channelsPage.centerView.postCreate.postMessage('file upload test');

    // 6. Verify the file attachment appears in the channel post
    const lastPost = await channelsPage.centerView.getLastPost();
    await expect(lastPost.container.getByText('sample_text_file.txt')).toBeVisible();
});

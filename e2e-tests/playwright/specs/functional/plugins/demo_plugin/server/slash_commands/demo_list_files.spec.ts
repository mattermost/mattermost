// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';

import {expect, getFileFromAsset, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../../helpers';

/**
 * Uploads a batch of files to the channel via API and posts them as a single message.
 * Using the API avoids the demo plugin's custom file upload menu which intercepts
 * the attachment button in the UI.
 */
async function uploadAndPostFiles(client: Client4, channelId: string, filenames: string[]): Promise<void> {
    const fileIds: string[] = [];

    for (const filename of filenames) {
        const file = getFileFromAsset(filename);
        const formData = new FormData();
        formData.set('files', file, filename);
        formData.set('channel_id', channelId);
        const result = await client.uploadFile(formData);
        fileIds.push(result.file_infos[0].id);
    }

    await client.createPost({
        channel_id: channelId,
        message: '',
        file_ids: fileIds,
    });
}

test('should list uploaded files with running total via /list_files command', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    // 2. Create a dedicated channel for file isolation
    const channel = pw.random.channel({
        teamId: team.id,
        name: 'list-files-test',
        displayName: 'List Files Test',
    });
    const createdChannel = await adminClient.createChannel(channel);
    await adminClient.addToChannel(user.id, createdChannel.id);

    // 3. Login and navigate to the channel
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'list-files-test');
    await channelsPage.toBeVisible();

    // 4. Send /list_files with no files — expect 0 count
    await channelsPage.centerView.postCreate.input.fill('/list_files');
    await channelsPage.centerView.postCreate.sendMessage();

    await expect(
        channelsPage.centerView.container.getByText('Last 0 Files uploaded to this channel', {exact: true}),
    ).toBeVisible();

    // 5. Upload first batch of 2 files via API
    // (avoids demo plugin's custom attachment menu intercepting the UI)
    await uploadAndPostFiles(adminClient, createdChannel.id, ['sample_text_file.txt', 'mattermost-icon_128x128.png']);

    // 6. Send /list_files — expect count of 2 and both file names
    await channelsPage.centerView.postCreate.input.fill('/list_files');
    await channelsPage.centerView.postCreate.sendMessage();

    const response2 = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'Last 2 Files uploaded to this channel'})
        .last();
    await expect(response2).toBeVisible();
    await expect(response2.getByRole('heading', {name: 'mattermost-icon_128x128.png'})).toBeVisible();
    await expect(response2.getByRole('heading', {name: 'sample_text_file.txt'})).toBeVisible();

    // 7. Upload second batch of 2 more files via API
    await uploadAndPostFiles(adminClient, createdChannel.id, ['mattermost.png', 'archive.zip']);

    // 8. Send /list_files — expect count of 4 and all file names
    await channelsPage.centerView.postCreate.input.fill('/list_files');
    await channelsPage.centerView.postCreate.sendMessage();

    const response4 = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'Last 4 Files uploaded to this channel'})
        .last();
    await expect(response4).toBeVisible();
    await expect(response4.getByRole('heading', {name: 'mattermost.png'})).toBeVisible();
    await expect(response4.getByRole('heading', {name: 'archive.zip'})).toBeVisible();
    await expect(response4.getByRole('heading', {name: 'mattermost-icon_128x128.png'})).toBeVisible();
    await expect(response4.getByRole('heading', {name: 'sample_text_file.txt'})).toBeVisible();
});

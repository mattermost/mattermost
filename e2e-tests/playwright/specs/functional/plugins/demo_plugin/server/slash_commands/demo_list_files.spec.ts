// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Page} from '@playwright/test';
import type {Client4} from '@mattermost/client';

import {demoPluginId, duration, expect, getFileFromAsset, test} from '@mattermost/playwright-lib';

async function sendSlashCommand(page: Page, send: () => Promise<void>, adminClient: Client4): Promise<void> {
    // Slash commands hit POST /api/v4/commands/execute — not POST /posts (see web client executeCommand).
    // Retry once if the server returns 500 (plugin transiently inactive between setup and first use).
    for (let attempt = 0; attempt < 2; attempt++) {
        const responsePromise = page.waitForResponse(
            (r) => r.url().includes('/api/v4/commands/execute') && r.request().method() === 'POST',
            {timeout: duration.half_min},
        );
        const [, response] = await Promise.all([send(), responsePromise]);
        if (response.ok()) {
            return;
        }
        if (attempt === 0 && response.status() === 500) {
            // Plugin may be transiently inactive — re-enable and retry.
            try {
                await adminClient.enablePlugin(demoPluginId);
                await new Promise((r) => setTimeout(r, 1500));
            } catch {
                // Ignore; retry the slash command anyway.
            }
            continue;
        }
        expect(response.ok(), `slash command failed: HTTP ${response.status()}`).toBeTruthy();
    }
}

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
    // # Setup
    const {adminClient, user, team} = await pw.initSetup();
    await pw.ensureDemoPlugin();

    // # Create a dedicated channel for file isolation
    const channel = pw.random.channel({
        teamId: team.id,
        name: 'list-files-test',
        displayName: 'List Files Test',
    });
    const createdChannel = await adminClient.createChannel(channel);
    await adminClient.addToChannel(user.id, createdChannel.id);

    // # Login and navigate to the channel
    const {channelsPage} = await pw.testBrowser.login(user);
    await channelsPage.goto(team.name, 'list-files-test');
    await channelsPage.toBeVisible();

    const page = channelsPage.page;

    // # Send /list_files with no files
    await sendSlashCommand(
        page,
        async () => {
            await channelsPage.centerView.postCreate.input.fill('/list_files');
            await channelsPage.centerView.postCreate.sendMessage();
        },
        adminClient,
    );

    // * Verify the bot reply shows 0 files
    await expect(
        channelsPage.centerView.container.getByText('Last 0 Files uploaded to this channel', {exact: true}),
    ).toBeVisible();

    // # Upload first batch of 2 files via API
    // (avoids demo plugin's custom attachment menu intercepting the UI)
    await uploadAndPostFiles(adminClient, createdChannel.id, ['sample_text_file.txt', 'mattermost-icon_128x128.png']);

    // # Send /list_files again
    await sendSlashCommand(
        page,
        async () => {
            await channelsPage.centerView.postCreate.input.fill('/list_files');
            await channelsPage.centerView.postCreate.sendMessage();
        },
        adminClient,
    );

    // * Verify the bot reply shows a count of 2 and both file names
    const response2 = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'Last 2 Files uploaded to this channel'})
        .last();
    await expect(response2).toBeVisible();
    await expect(response2.getByRole('link', {name: 'mattermost-icon_128x128.png'})).toBeVisible();
    await expect(response2.getByRole('link', {name: 'sample_text_file.txt'})).toBeVisible();

    // # Upload second batch of 2 more files via API
    await uploadAndPostFiles(adminClient, createdChannel.id, ['mattermost.png', 'archive.zip']);

    // # Send /list_files again
    await sendSlashCommand(
        page,
        async () => {
            await channelsPage.centerView.postCreate.input.fill('/list_files');
            await channelsPage.centerView.postCreate.sendMessage();
        },
        adminClient,
    );

    // * Verify the bot reply shows a count of 4 and all file names
    const response4 = channelsPage.centerView.container
        .getByRole('listitem')
        .filter({hasText: 'Last 4 Files uploaded to this channel'})
        .last();
    await expect(response4).toBeVisible();
    await expect(response4.getByRole('link', {name: 'mattermost.png'})).toBeVisible();
    await expect(response4.getByRole('link', {name: 'archive.zip'})).toBeVisible();
    await expect(response4.getByRole('link', {name: 'mattermost-icon_128x128.png'})).toBeVisible();
    await expect(response4.getByRole('link', {name: 'sample_text_file.txt'})).toBeVisible();
});

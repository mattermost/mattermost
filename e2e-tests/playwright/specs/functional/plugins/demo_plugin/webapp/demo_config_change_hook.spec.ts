// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, getFileFromAsset, test} from '@mattermost/playwright-lib';

import {setupDemoPlugin} from '../helpers';

test('should validate the config change hook by observing RejectPublicLinkDownloads behavior', async ({pw}) => {
    // 1. Setup
    const {adminClient, user, team} = await pw.initSetup();
    await setupDemoPlugin(adminClient, pw);

    const channel = pw.random.channel({
        teamId: team.id,
        name: 'public-link-test',
        displayName: 'Public Link Test',
    });
    const createdChannel = await adminClient.createChannel(channel);
    await adminClient.addToChannel(user.id, createdChannel.id);

    // 2. Upload an image and attach it to a post
    const file = getFileFromAsset('small-image.png');
    const formData = new FormData();
    formData.set('files', file, 'small-image.png');
    formData.set('channel_id', createdChannel.id);
    const uploadResult = await adminClient.uploadFile(formData);
    const fileId = uploadResult.file_infos[0].id;
    await adminClient.createPost({
        channel_id: createdChannel.id,
        message: '',
        file_ids: [fileId],
    });

    // 3. Get the file's public link (FileSettings.EnablePublicLink is enabled by setupDemoPlugin)
    const {link} = await adminClient.getFilePublicLink(fileId);

    const {channelsPage} = await pw.testBrowser.login(user);

    // 4. Baseline: with the restriction off, the public link is accessible. This is a
    // black-box check — it verifies the plugin's FileWillBeDownloaded hook observes the config
    // value directly, rather than depending on the plugin's separate (and less reliable)
    // OnConfigurationChange post-creation pipeline.
    await adminClient.patchConfig({
        PluginSettings: {
            Plugins: {
                'com.mattermost.demo-plugin': {
                    username: 'demouser',
                    channelname: 'demo_plugin',
                    lastname: 'User',
                    rejectpubliclinkdownloads: false,
                },
            },
        },
    });
    const allowedResponse = await channelsPage.page.request.get(link);
    expect(allowedResponse.status()).toBe(200);

    // 5. Enable the restriction and confirm the same link is now rejected.
    await adminClient.patchConfig({
        PluginSettings: {
            Plugins: {
                'com.mattermost.demo-plugin': {
                    username: 'demouser',
                    channelname: 'demo_plugin',
                    lastname: 'User',
                    rejectpubliclinkdownloads: true,
                },
            },
        },
    });
    const rejectedResponse = await channelsPage.page.request.get(link);
    expect(rejectedResponse.status()).toBe(403);

    // 6. Reset the setting so it doesn't leak into other tests on this shared server.
    await adminClient.patchConfig({
        PluginSettings: {
            Plugins: {
                'com.mattermost.demo-plugin': {
                    username: 'demouser',
                    channelname: 'demo_plugin',
                    lastname: 'User',
                    rejectpubliclinkdownloads: false,
                },
            },
        },
    });
});

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {ServerChannel} from '@mattermost/types/channels';

import {expect, test} from '@mattermost/playwright-lib';

import {file, filename, initUploadFileTestContext} from './support';

let userClient: Client4;
let townSquareChannel: ServerChannel;

test.beforeEach(async ({pw}) => {
    ({userClient, townSquareChannel} = await initUploadFileTestContext(pw));
});

test('should fail on invalid channel ID', async ({pw}) => {
    const clientId = pw.random.id();

    // # Set with invalid channel ID
    let formData = new FormData();
    formData.set('channel_id', 'invalid.channel.id');
    formData.set('client_ids', clientId);
    formData.set('files', file, filename);

    await expect(userClient.uploadFile(formData)).rejects.toThrowError(
        'Invalid or missing channel_id parameter in request URL.',
    );

    // # Set without channel ID
    formData = new FormData();
    formData.set('client_ids', clientId);
    formData.set('files', file, filename);

    await expect(userClient.uploadFile(formData)).rejects.toThrowError(
        'Invalid or missing channel_id in request body.',
    );
});

test('should fail on missing files', async ({pw}) => {
    const clientId = pw.random.id();

    // # Set with invalid channel ID
    const formData = new FormData();
    formData.set('channel_id', townSquareChannel.id);
    formData.set('client_ids', clientId);

    await expect(userClient.uploadFile(formData)).rejects.toThrowError(
        'Unable to upload file(s). Have 1 client_ids for 0 files.',
    );
});

test('should fail on incorrect order setting up FormData', async ({pw}) => {
    const clientId = pw.random.id();

    // # Set with files before client_ids
    const formData = new FormData();
    formData.set('channel_id', townSquareChannel.id);
    formData.set('files', file, filename);
    formData.set('client_ids', clientId);

    await expect(userClient.uploadFile(formData)).rejects.toThrowError(
        'Invalid or missing client_ids in request body.',
    );
});

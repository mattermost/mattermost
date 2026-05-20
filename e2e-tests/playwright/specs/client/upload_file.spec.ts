// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {ServerChannel} from '@mattermost/types/channels';
import {FileUploadResponse} from '@mattermost/types/files';
import {Team} from '@mattermost/types/teams';
import {UserProfile} from '@mattermost/types/users';

import {expect, test, getFileFromAsset, getBlobFromAsset} from '@mattermost/playwright-lib';

import {FileUploadResponseSchema} from './schema';

let userClient: Client4;
let user: UserProfile;
let team: Team;
let townSquareChannel: ServerChannel;

const filename = 'mattermost-icon_128x128.png';
const file = getFileFromAsset(filename);
const blob = getBlobFromAsset(filename);

test.beforeEach(async ({pw}) => {
    ({userClient, user, team} = await pw.initSetup());
    townSquareChannel = await userClient.getChannelByName(team.id, 'town-square');
});

test('should succeed with File', async ({pw}) => {
    // # Prepare data with File
    const clientId = pw.random.id();
    const formData = new FormData();
    formData.set('channel_id', townSquareChannel.id);
    formData.set('client_ids', clientId);
    formData.set('files', file, filename);

    // # Do upload then validate the response
    const data = await userClient.uploadFile(formData);
    validateFileUploadResponse(data, clientId, user.id, townSquareChannel.id);
});

test('should succeed with Blob', async ({pw}) => {
    // # Prepare data with Blob
    const clientId = pw.random.id();
    const formData = new FormData();
    formData.set('channel_id', townSquareChannel.id);
    formData.set('client_ids', clientId);
    formData.set('files', blob, filename);

    // # Do upload then validate the response
    const data = await userClient.uploadFile(formData);
    validateFileUploadResponse(data, clientId, user.id, townSquareChannel.id);
});

test('should succeed even with channel_id only', async () => {
    // # Set without channel ID
    const formData = new FormData();
    formData.set('channel_id', townSquareChannel.id);

    // # Do upload then validate the response
    const data = await userClient.uploadFile(formData);

    // * Validate that it doe snot throw an error
    const validate = () => FileUploadResponseSchema.parse(data);
    expect(validate).not.toThrow();

    // * Validate that file_infos and client_ids are as expected
    expect(data.client_ids).toMatchObject([]);
    expect(data.file_infos.length).toBe(0);
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

function validateFileUploadResponse(data: FileUploadResponse, clientId: string, userId: string, channelId: string) {
    // * Validate the schema
    const validate = () => FileUploadResponseSchema.parse(data);
    expect(validate).not.toThrow();

    // * Validate that file_infos and client_ids are as expected
    expect(data.client_ids).toMatchObject([clientId]);
    expect(data.file_infos.length).toBe(1);

    // * Validate important contents of file_infos
    const fileInfo = data.file_infos[0];
    expect(fileInfo.user_id).toBe(userId);
    expect(fileInfo.channel_id).toBe(channelId);
    expect(fileInfo.delete_at).toBe(0);
    expect(fileInfo.extension).toBe('png');
    expect(fileInfo.mime_type).toBe('image/png');
    expect(fileInfo.archived).toBe(false);
}

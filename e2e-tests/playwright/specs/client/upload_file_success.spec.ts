// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {ServerChannel} from '@mattermost/types/channels';
import {FileUploadResponse} from '@mattermost/types/files';
import {UserProfile} from '@mattermost/types/users';

import {expect, test} from '@mattermost/playwright-lib';

import {FileUploadResponseSchema} from './schema';
import {blob, file, filename, initUploadFileTestContext} from './support';

let userClient: Client4;
let user: UserProfile;
let townSquareChannel: ServerChannel;

test.beforeEach(async ({pw}) => {
    ({userClient, user, townSquareChannel} = await initUploadFileTestContext(pw));
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

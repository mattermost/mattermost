// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Client4} from '@mattermost/client';

import {expect, getFileFromAsset, getRandomId} from '@mattermost/playwright-lib';

/**
 * Uploads the shared test asset to the given team's town-square channel and downloads it back
 * through Mattermost, asserting the round-tripped bytes match exactly. When `listObjectKeys` is
 * provided (Minio/Azurite), also asserts the object landed in the backend's own listing —
 * local storage has no such listing to check.
 */
export async function uploadAndVerifyFile(
    userClient: Client4,
    teamId: string,
    listObjectKeys?: () => Promise<string[]>,
): Promise<void> {
    const townSquare = await userClient.getChannelByName(teamId, 'town-square');
    const filename = 'mattermost-icon_128x128.png';
    const file = getFileFromAsset(filename);

    const formData = new FormData();
    formData.set('channel_id', townSquare.id);
    formData.set('client_ids', getRandomId());
    formData.set('files', file, filename);

    const objectKeysBeforeUpload = listObjectKeys ? await listObjectKeys() : undefined;

    const uploadResponse = await userClient.uploadFile(formData);
    const fileId = uploadResponse.file_infos[0].id;

    if (listObjectKeys) {
        const objectKeysAfterUpload = await listObjectKeys();
        const newObjectKeys = objectKeysAfterUpload.filter((key) => !objectKeysBeforeUpload?.includes(key));
        expect(newObjectKeys.length).toBeGreaterThan(0);
    }

    const downloadResponse = await fetch(userClient.getFileUrl(fileId, 0), {
        headers: {Authorization: `Bearer ${userClient.getToken()}`},
    });
    expect(downloadResponse.ok).toBe(true);

    const downloadedBytes = Buffer.from(await downloadResponse.arrayBuffer());
    const originalBytes = Buffer.from(await file.arrayBuffer());
    expect(downloadedBytes.equals(originalBytes)).toBe(true);
}

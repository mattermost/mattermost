// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export async function getRandomId(length = 7): Promise<string> {
    const MAX_SUBSTRING_INDEX = 27;

    // Dynamically import uuid (works even in CommonJS)
    const {v4: uuidv4} = await import('uuid');

    return uuidv4()
        .replace(/-/g, '')
        .substring(MAX_SUBSTRING_INDEX - length, MAX_SUBSTRING_INDEX);
}

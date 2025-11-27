// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

let uuidv4: (() => string) | null = null;

export async function getRandomId(length = 7): Promise<string> {
    if (!uuidv4) {
        const {v4} = await import('uuid');
        uuidv4 = v4;
    }

    const MAX_SUBSTRING_INDEX = 27;
    return uuidv4()
        .replace(/-/g, '')
        .substring(MAX_SUBSTRING_INDEX - length, MAX_SUBSTRING_INDEX);
}

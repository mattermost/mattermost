// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {randomUUID} from 'crypto';

export function getRandomId(length = 7): string {
    const MAX_SUBSTRING_INDEX = 27;

    return randomUUID()
        .replace(/-/g, '')
        .substring(MAX_SUBSTRING_INDEX - length, MAX_SUBSTRING_INDEX);
}

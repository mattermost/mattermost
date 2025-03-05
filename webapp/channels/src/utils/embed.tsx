// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Returns true if the user is running Mattermost in an embedded view
 */
export function isEmbedded(): boolean {
    return document.cookie.indexOf('MMEMBED=1') !== -1;
}

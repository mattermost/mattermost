// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export function getSuppressOutOfChannelEphemeralKey(channelId: string, rootId = ''): string {
    return `${channelId}:${rootId}`;
}

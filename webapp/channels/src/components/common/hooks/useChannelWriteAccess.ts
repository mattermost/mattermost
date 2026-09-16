// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ACCESS_CONTROL_ACTION_CHANNEL_WRITE_ACCESS} from '@mattermost/types/access_control';

import {useRenderPermission} from './useRenderPermission';

export function useChannelWriteAccess(channelId: string): boolean {
    return useRenderPermission({
        resourceType: 'channel',
        resourceId: channelId,
        action: ACCESS_CONTROL_ACTION_CHANNEL_WRITE_ACCESS,
    }, true);
}

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {ACCESS_CONTROL_ACTION_CREATE_BURN_ON_READ} from '@mattermost/types/access_control';

import {isBurnOnReadABACPermissionEnabled} from 'mattermost-redux/selectors/entities/general';

import {useRenderPermission} from './useRenderPermission';

// Whether the current user may compose a burn-on-read post in this channel, for rendering
// decisions only — the server re-checks on send.
//
// Pass no channel id where the question doesn't arise (an ordinary post, a surface with no
// channel): nothing is asked of the server then.
export function useCreateBurnOnReadAccess(channelId?: string): boolean {
    const flagEnabled = useSelector(isBurnOnReadABACPermissionEnabled);

    const allowed = useRenderPermission(
        {
            resourceType: 'channel',

            // An empty id is how useRenderPermission is told there is nothing to decide — it
            // then neither reads a decision nor asks for one. Both reasons to withhold the
            // question live here so no caller has to know either of them.
            resourceId: flagEnabled && channelId ? channelId : '',
            action: ACCESS_CONTROL_ACTION_CREATE_BURN_ON_READ,
        },
        false, // fail closed until the decision arrives
    );

    // With the flag off the action isn't registered for render decisions at all, so it is
    // ungated rather than pending — and asking would reject the whole batched request.
    return flagEnabled ? allowed : true;
}

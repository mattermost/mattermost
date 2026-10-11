// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {hasDirectOrGroupChannels} from 'mattermost-redux/selectors/entities/channels';
import {isPermissionPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {isDmGmReadDenied} from 'mattermost-redux/selectors/entities/render_permissions';

import {fetchDmGmAccess, hideDirectAndGroupChannels, restoreDirectAndGroupChannels} from 'actions/dm_gm_access';
import {areDirectAndGroupChannelsHidden} from 'selectors/views/channel';

// Keeps local DMs and GMs in line with the session's dm_gm_read_access decision, whichever way
// that decision arrives: the fetch on load, a 403, or a refetch after a WebSocket event.
export default function DmGmAccessSync() {
    const dispatch = useDispatch();
    const enabled = useSelector(isPermissionPoliciesEnabled);
    const readDenied = useSelector(isDmGmReadDenied);
    const hasConversations = useSelector(hasDirectOrGroupChannels);
    const hidden = useSelector(areDirectAndGroupChannelsHidden);

    // Also the refetch after the flag turns on, which clears every decision.
    useEffect(() => {
        dispatch(fetchDmGmAccess());
    }, [dispatch, enabled]);

    useEffect(() => {
        // Hides again whenever a conversation slips back in, and marks the state hidden even
        // when there is nothing to drop, so a later regain restores.
        if (readDenied && (hasConversations || !hidden)) {
            dispatch(hideDirectAndGroupChannels());
        } else if (!readDenied && hidden) {
            dispatch(restoreDirectAndGroupChannels());
        }
    }, [dispatch, readDenied, hasConversations, hidden]);

    return null;
}

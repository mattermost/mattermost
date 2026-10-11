// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fetchMyCategories} from 'mattermost-redux/actions/channel_categories';
import {fetchAllMyChannelMembers, fetchAllMyTeamsChannels} from 'mattermost-redux/actions/channels';
import {fetchSessionRenderDecisions} from 'mattermost-redux/actions/render_permissions';
import {getMyTeamUnreads} from 'mattermost-redux/actions/teams';
import {getThreadCounts} from 'mattermost-redux/actions/threads';
import {getDirectChannelsSet} from 'mattermost-redux/selectors/entities/channels';
import {isPermissionPoliciesEnabled} from 'mattermost-redux/selectors/entities/general';
import {isCollapsedThreadsEnabled} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {dropChannelsLocally} from 'actions/channel_read_access';
import {loadProfilesForSidebar} from 'actions/user_actions';

import {ActionTypes} from 'utils/constants';

import type {ThunkActionFunc} from 'types/store';

// Spreads the refetches of an event broadcast to every client, such as a policy change.
const FETCH_JITTER_MS = 5000;

let jitterTimer: ReturnType<typeof setTimeout> | undefined;

// Refetches the session's DM/GM decisions. With jitter, waits a random delay first and folds
// further requests into the one already pending.
export function fetchDmGmAccess({jitter = false} = {}): ThunkActionFunc<void> {
    return (dispatch, getState) => {
        if (!isPermissionPoliciesEnabled(getState())) {
            return;
        }

        if (!jitter) {
            dispatch(fetchSessionRenderDecisions());
            return;
        }

        if (jitterTimer) {
            return;
        }

        jitterTimer = setTimeout(() => {
            jitterTimer = undefined;
            dispatch(fetchSessionRenderDecisions());
        }, Math.random() * FETCH_JITTER_MS);
    };
}

// Drops every DM and GM from local state while Read is denied. Suppression only: nothing is sent
// to the server, so memberships, preferences, categories and drafts are all untouched there.
export function hideDirectAndGroupChannels(): ThunkActionFunc<void> {
    return (dispatch, getState) => {
        const channelIds = Array.from(getDirectChannelsSet(getState()));

        dispatch({type: ActionTypes.SET_DM_GM_HIDDEN, data: true});
        dispatch(dropChannelsLocally(channelIds, {conversation: true}));
    };
}

// Refetches what hiding dropped, as a reconnect does, so conversations return with their
// categories and unread counts.
export function restoreDirectAndGroupChannels(): ThunkActionFunc<Promise<void>> {
    return async (dispatch, getState) => {
        dispatch({type: ActionTypes.SET_DM_GM_HIDDEN, data: false});

        const state = getState();
        const currentTeamId = getCurrentTeamId(state);
        const crtEnabled = isCollapsedThreadsEnabled(state);

        await Promise.all([
            dispatch(fetchAllMyTeamsChannels()),
            dispatch(fetchAllMyChannelMembers()),
        ]);

        if (currentTeamId) {
            dispatch(fetchMyCategories(currentTeamId));
        }
        loadProfilesForSidebar();

        dispatch(getMyTeamUnreads(crtEnabled));
        if (crtEnabled && currentTeamId) {
            dispatch(getThreadCounts(getCurrentUserId(state), currentTeamId));
        }
    };
}

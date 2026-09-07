// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {Channel} from '@mattermost/types/channels';

import {ChannelTypes} from 'mattermost-redux/action_types';
import {fetchAllMyTeamsChannels} from 'mattermost-redux/actions/channels';
import {General} from 'mattermost-redux/constants';
import {getCurrentChannelId, getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';
import {isAccessChannelABACPermissionEnabled} from 'mattermost-redux/selectors/entities/general';

import {redirectUserToDefaultTeam} from 'actions/global_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';
import {getSelectedChannelId} from 'selectors/rhs';

import ChannelAccessDeniedModal from 'components/channel_access_denied_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {ThunkActionFunc} from 'types/store';

// How often a client re-checks which channels it may still see. An access_channel
// rule can reference the session's device or network, so a session can lose access
// without any server-side change to react to — nothing would otherwise tell the
// client until it reloaded.
export const ACCESS_CHANNEL_REFRESH_INTERVAL = 15 * 60 * 1000;

let refreshIntervalId: ReturnType<typeof setInterval> | undefined;

// DMs and GMs are exempt from access_channel on the server, so their absence from
// a response never means "denied" and must not drop local data.
function isGoverned(channel: Channel): boolean {
    return channel.type !== General.DM_CHANNEL && channel.type !== General.GM_CHANNEL;
}

/**
 * Reconciles local channel state against the channels the server is still willing
 * to return, and reports it when the open channel is one of the losses.
 *
 * The server suppresses a denied channel from the channel list rather than removing
 * the user from it, so the client is left holding data for a channel it can no
 * longer show. Dropping that data locally is what makes the channel disappear.
 *
 * LEAVE_CHANNEL here is a local reducer action only — no request is made, and the
 * membership, followed threads, saved posts and unread counts all survive on the
 * server. That is what lets the channel reappear intact, with its accumulated
 * mentions, once access returns.
 */
export function reconcileChannelAccess(): ThunkActionFunc<Promise<void>> {
    return async (doDispatch, doGetState) => {
        if (!isAccessChannelABACPermissionEnabled(doGetState())) {
            return;
        }

        const before = doGetState();
        const knownChannelIds = Object.keys(getMyChannelMemberships(before));

        // Read the channel record directly rather than through getCurrentChannel,
        // which resolves DM/GM display names from preferences we have no use for.
        const currentChannelId = getCurrentChannelId(before);

        const {data: channels} = await doDispatch(fetchAllMyTeamsChannels());
        if (!channels) {
            // The fetch failed and already logged. Dropping local state on a
            // network error would hide channels the policy still allows.
            return;
        }

        const stillAccessible = new Set((channels as Channel[]).map((channel) => channel.id));

        const after = doGetState();
        const dropped = knownChannelIds.filter((channelId) => {
            if (stillAccessible.has(channelId)) {
                return false;
            }
            const channel = after.entities.channels.channels[channelId];
            return Boolean(channel) && isGoverned(channel);
        });

        if (dropped.length === 0) {
            return;
        }

        // One batch, so the fifteen-odd reducers that clean up after
        // LEAVE_CHANNEL run once rather than once per channel.
        doDispatch(batchActions(dropped.map((channelId) => ({
            type: ChannelTypes.LEAVE_CHANNEL,
            data: {
                id: channelId,
                user_id: after.entities.users.currentUserId,
                team_id: after.entities.channels.channels[channelId]?.team_id,
            },
        }))));

        const rhsChannelId = getSelectedChannelId(after);
        if (rhsChannelId && dropped.includes(rhsChannelId)) {
            doDispatch(closeRightHandSide());
        }

        // Losing the channel in view is the one case worth interrupting for: the
        // user is looking at it, and it is about to vanish underneath them.
        if (currentChannelId && dropped.includes(currentChannelId)) {
            doDispatch(openModal({
                modalId: ModalIdentifiers.CHANNEL_ACCESS_DENIED,
                dialogType: ChannelAccessDeniedModal,
                dialogProps: {channelName: before.entities.channels.channels[currentChannelId]?.display_name},
            }));
            redirectUserToDefaultTeam();
        }
    };
}

/**
 * Starts the periodic reconciliation. Safe to call repeatedly — only the first
 * call schedules — and a no-op while the feature is off, so a server without the
 * flag pays nothing.
 */
export function startChannelAccessRefresh(): ThunkActionFunc<void> {
    return (doDispatch, doGetState) => {
        if (refreshIntervalId !== undefined || !isAccessChannelABACPermissionEnabled(doGetState())) {
            return;
        }

        refreshIntervalId = setInterval(() => {
            doDispatch(reconcileChannelAccess());
        }, ACCESS_CHANNEL_REFRESH_INTERVAL);
    };
}

export function stopChannelAccessRefresh(): void {
    if (refreshIntervalId !== undefined) {
        clearInterval(refreshIntervalId);
        refreshIntervalId = undefined;
    }
}

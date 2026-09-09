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

// DMs and GMs are exempt from access_channel on the server, so their absence from
// a response never means "denied" and must not drop local data.
function isGoverned(channel: Channel): boolean {
    return channel.type !== General.DM_CHANNEL && channel.type !== General.GM_CHANNEL;
}

/**
 * Reconciles local channel state against the channels the server is still willing to
 * return. The server suppresses a denied channel rather than removing the user from
 * it, so dropping the local copy is what makes the channel disappear.
 *
 * LEAVE_CHANNEL here is a local reducer action only — no request is made, and the
 * membership, followed threads, saved posts and unread counts all survive on the
 * server, so the channel reappears intact once access returns.
 */
export function reconcileChannelAccess(): ThunkActionFunc<Promise<void>> {
    return async (doDispatch, doGetState) => {
        if (!isAccessChannelABACPermissionEnabled(doGetState())) {
            return;
        }

        const before = doGetState();
        const knownChannelIds = Object.keys(getMyChannelMemberships(before));

        const currentChannelId = getCurrentChannelId(before);

        const {data: channels} = await doDispatch(fetchAllMyTeamsChannels());
        if (!channels) {
            // Dropping local state on a network error would hide channels the
            // policy still allows.
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

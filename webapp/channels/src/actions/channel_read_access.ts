// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {batchActions} from 'redux-batched-actions';

import type {Channel} from '@mattermost/types/channels';

import {ChannelTypes} from 'mattermost-redux/action_types';
import {fetchAllMyTeamsChannels} from 'mattermost-redux/actions/channels';
import {General} from 'mattermost-redux/constants';
import {getCurrentChannelId, getMyChannelMemberships} from 'mattermost-redux/selectors/entities/channels';

import {redirectUserToDefaultTeam} from 'actions/global_actions';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';
import {getSelectedChannelId} from 'selectors/rhs';

import ChannelReadAccessDeniedModal from 'components/channel_read_access_denied_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {DispatchFunc, GetStateFunc, ThunkActionFunc} from 'types/store';

// A channel missing from the response only means "denied" if the response could have
// carried it. DMs and GMs are exempt from channel_read_access on the server, and the
// channel list omits archived channels whatever the policy says.
function isGoverned(channel: Channel): boolean {
    return channel.type !== General.DM_CHANNEL &&
        channel.type !== General.GM_CHANNEL &&
        channel.delete_at === 0;
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
async function reconcile(doDispatch: DispatchFunc, doGetState: GetStateFunc) {
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
            dialogType: ChannelReadAccessDeniedModal,
            dialogProps: {channelName: before.entities.channels.channels[currentChannelId]?.display_name},
        }));
        redirectUserToDefaultTeam();
    }
}

// Set while a reconcile runs. A request made meanwhile can't rely on that run, whose
// response may predate the change behind the request, so it asks for one more; every
// request made during the same run shares it.
let running: Promise<void> | undefined;
let rerunRequested = false;

/**
 * Reconciles channel read access, one run at a time. The returned promise settles once
 * a run that started after the request has finished.
 */
export function reconcileChannelReadAccess(): ThunkActionFunc<Promise<void>> {
    return (doDispatch, doGetState) => {
        if (running) {
            rerunRequested = true;
            return running;
        }

        running = (async () => {
            try {
                do {
                    rerunRequested = false;

                    // eslint-disable-next-line no-await-in-loop
                    await reconcile(doDispatch, doGetState);
                } while (rerunRequested);
            } finally {
                running = undefined;
            }
        })();

        return running;
    };
}

const POLICY_EVENT_RECONCILE_MAX_DELAY_MS = 30 * 1000;

// Set while a jittered reconcile waits to start. Its fetch is still to come, so it
// already covers any request made meanwhile.
let pendingJitter: ReturnType<typeof setTimeout> | undefined;

/**
 * Reconciles after a random delay of up to 30 seconds. A policy event reaches every
 * affected client at once, and without the spread they would all fetch their channel
 * list in the same second.
 */
export function reconcileChannelReadAccessWithJitter(): ThunkActionFunc<void> {
    return (doDispatch) => {
        if (pendingJitter) {
            return;
        }

        pendingJitter = setTimeout(() => {
            pendingJitter = undefined;
            doDispatch(reconcileChannelReadAccess());
        }, Math.random() * POLICY_EVENT_RECONCILE_MAX_DELAY_MS);
    };
}

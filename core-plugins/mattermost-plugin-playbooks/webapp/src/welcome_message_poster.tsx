// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Store} from 'redux';
import {GlobalState} from '@mattermost/types/store';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {matchPath} from 'react-router-dom';

import {hasViewedByChannelID} from 'src/selectors';
import {fetchChannelActions, fetchCheckAndSendMessageOnJoin} from 'src/client';
import {setHasViewedChannel} from 'src/actions';
import {ChannelActionType, ChannelTriggerType} from 'src/types/channel_actions';

export function makeWelcomeMessagePoster(store: Store<GlobalState>): () => Promise<void> {
    let currentChannelId = '';

    return async () => {
        const state = store.getState();
        const currentChannel = getCurrentChannel(state);
        const url = new URL(window.location.href);
        const isInChannel = matchPath(url.pathname, {path: '/:team/:path(channels|messages)/:identifier/:postid?'});

        // Wait for a valid team and channel before doing anything.
        if (!isInChannel || !currentChannel) {
            return;
        }

        // Wait for the user to select a new channel.
        if (currentChannel.id === currentChannelId) {
            return;
        }

        currentChannelId = currentChannel.id;

        // if the user has already viewed the channel,
        // there's no need to fetch actions again
        if (hasViewedByChannelID(state)[currentChannelId]) {
            return;
        }

        // If there are no welcome message actions enabled, stop
        const actions = await fetchChannelActions(currentChannelId, ChannelTriggerType.NewMemberJoins);

        const welcomeAction = actions.find((action) =>
            action.trigger_type === ChannelTriggerType.NewMemberJoins && action.action_type === ChannelActionType.WelcomeMessage
        );
        if (!welcomeAction?.enabled) {
            return;
        }

        const hasViewed = await fetchCheckAndSendMessageOnJoin(currentChannelId);
        if (hasViewed) {
            store.dispatch(setHasViewedChannel(currentChannelId));
        }
    };
}

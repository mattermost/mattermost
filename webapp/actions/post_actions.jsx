// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import ChannelStore from 'stores/channel_store.jsx';
import PostStore from 'stores/post_store.jsx';
import TeamStore from 'stores/team_store.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import Client from 'utils/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

export function handleNewPost(post, msg) {
    if (ChannelStore.getCurrentId() === post.channel_id) {
        if (window.isActive) {
            AsyncClient.updateLastViewedAt();
        } else {
            AsyncClient.getChannel(post.channel_id);
        }
    } else if (msg && (TeamStore.getCurrentId() === msg.team_id || msg.props.channel_type === Constants.DM_CHANNEL)) {
        AsyncClient.getChannel(post.channel_id);
    }

    var websocketMessageProps = null;
    if (msg) {
        websocketMessageProps = msg.data;
    }

    if (post.root_id && PostStore.getPost(post.channel_id, post.root_id) == null) {
        Client.getPost(
            post.channel_id,
            post.root_id,
            (data) => {
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POSTS,
                    id: post.channel_id,
                    numRequested: 0,
                    post_list: data
                });

                // Required to update order
                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POST,
                    post,
                    websocketMessageProps
                });
            },
            (err) => {
                AsyncClient.dispatchError(err, 'getPost');
            }
        );

        return;
    }

    AppDispatcher.handleServerAction({
        type: ActionTypes.RECEIVED_POST,
        post,
        websocketMessageProps
    });
}

// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PostStore from 'stores/post_store.jsx';
import ChannelStore from 'stores/channel_store.jsx';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';

import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';

import Constants from 'utils/constants.jsx';
const ActionTypes = Constants.ActionTypes;

import {FormattedMessage} from 'react-intl';

import React from 'react';

export default class PendingPostOptions extends React.Component {
    constructor(props) {
        super(props);
        this.retryPost = this.retryPost.bind(this);
        this.cancelPost = this.cancelPost.bind(this);
        this.state = {};
    }
    retryPost(e) {
        e.preventDefault();

        var post = this.props.post;
        Client.createPost(post,
            (data) => {
                AsyncClient.getPosts(post.channel_id);

                var channel = ChannelStore.get(post.channel_id);
                var member = ChannelStore.getMember(post.channel_id);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = (new Date()).getTime();
                ChannelStore.setChannelMember(member);

                AppDispatcher.handleServerAction({
                    type: ActionTypes.RECEIVED_POST,
                    post: data
                });
            },
            () => {
                post.state = Constants.POST_FAILED;
                PostStore.updatePendingPost(post);
                this.forceUpdate();
            }
        );

        post.state = Constants.POST_LOADING;
        PostStore.updatePendingPost(post);
        this.forceUpdate();
    }
    cancelPost(e) {
        e.preventDefault();

        var post = this.props.post;
        PostStore.removePendingPost(post.channel_id, post.pending_post_id);
        this.forceUpdate();
    }
    render() {
        return (<span className='pending-post-actions'>
            <a
                className='post-retry'
                href='#'
                onClick={this.retryPost}
            >
                <FormattedMessage
                    id='pending_post_actions.retry'
                    defaultMessage='Retry'
                />
            </a>
            {' - '}
            <a
                className='post-cancel'
                href='#'
                onClick={this.cancelPost}
            >
                <FormattedMessage
                    id='pending_post_actions.cancel'
                    defaultMessage='Cancel'
                />
            </a>
        </span>);
    }
}

PendingPostOptions.propTypes = {
    post: React.PropTypes.object
};

// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information

import PostViewController from './post_view_controller.jsx';

import ChannelStore from 'stores/channel_store.jsx';

import React from 'react';

const MAXIMUM_CACHED_VIEWS = 5;

export default class PostViewCache extends React.Component {
    constructor(props) {
        super(props);

        this.onChannelChange = this.onChannelChange.bind(this);

        const channel = ChannelStore.getCurrent();

        this.state = {
            currentChannelId: channel.id,
            channels: [channel]
        };
    }

    componentDidMount() {
        ChannelStore.addChangeListener(this.onChannelChange);
    }

    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.onChannelChange);
    }

    onChannelChange() {
        const channels = Object.assign([], this.state.channels);
        const currentChannel = ChannelStore.getCurrent();

        if (currentChannel == null) {
            return;
        }

        // make sure current channel really changed
        if (currentChannel.id === this.state.currentChannelId) {
            return;
        }

        if (channels.length > MAXIMUM_CACHED_VIEWS) {
            channels.shift();
        }

        const index = channels.map((c) => c.id).indexOf(currentChannel.id);
        if (index !== -1) {
            channels.splice(index, 1);
        }

        channels.push(currentChannel);

        this.setState({
            currentChannelId: currentChannel.id,
            channels
        });
    }

    render() {
        const channels = this.state.channels;
        const currentChannelId = this.state.currentChannelId;

        let postViews = [];
        for (let i = 0; i < channels.length; i++) {
            postViews.push(
                <PostViewController
                    key={'postviewcontroller_' + channels[i].id}
                    channel={channels[i]}
                    active={channels[i].id === currentChannelId}
                />
            );
        }

        return (
            <div id='post-list'>
                {postViews}
            </div>
        );
    }
}

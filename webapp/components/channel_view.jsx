// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import $ from 'jquery';
import React from 'react';

import ChannelHeader from 'components/channel_header.jsx';
import Constants from 'utils/constants.jsx';
import FileUploadOverlay from 'components/file_upload_overlay.jsx';
import CreatePost from 'components/create_post.jsx';
import PostsViewContainer from 'components/posts_view_container.jsx';

import ChannelStore from 'stores/channel_store.jsx';

import * as Utils from 'utils/utils.jsx';
import * as GlobalActions from 'action_creators/global_actions.jsx';

export default class ChannelView extends React.Component {
    constructor(props) {
        super(props);

        this.getStateFromStores = this.getStateFromStores.bind(this);
        this.isStateValid = this.isStateValid.bind(this);
        this.updateState = this.updateState.bind(this);

        this.state = this.getStateFromStores(props);
    }
    getStateFromStores(props) {
        const channel = ChannelStore.getByName(props.params.channel);
        const channelId = channel ? channel.id : '';
        return {
            channelId
        };
    }
    isStateValid() {
        return this.state.channelId !== '';
    }
    updateState() {
        this.setState(this.getStateFromStores(this.props));
    }
    componentDidMount() {
        ChannelStore.addChangeListener(this.updateState);

        $('body').addClass('app__body');

        document.addEventListener('keydown', (e) => {
            if (e.altKey && (e.keyCode === Constants.KeyCodes.UP || e.keyCode === Constants.KeyCodes.DOWN)) {
                const allChannels = ChannelStore.getAll();
                const curChannel = this.state.channel;
                const curIndex = allChannels.find(curChannel);
                let nextChannel = curChannel;
                let nextIndex = curIndex;
                if (e.keyCode === Constants.KeyCodes.DOWN) {
                    nextIndex = Math.min(curIndex + 1, allChannels.length - 1);
                } else if (e.keyCode === Constants.KeyCodes.UP) {
                    nextIndex = Math.max(curIndex - 1, 0);
                }
                nextChannel = allChannels[nextIndex];
                GlobalActions.emitChannelClickEvent(nextChannel);
            }
        });
    }
    componentWillUnmount() {
        ChannelStore.removeChangeListener(this.updateState);

        $('body').removeClass('app__body');
    }
    componentWillReceiveProps(nextProps) {
        this.setState(this.getStateFromStores(nextProps));
    }
    shouldComponentUpdate(nextProps, nextState) {
        if (!Utils.areObjectsEqual(nextProps.params, this.props.params)) {
            return true;
        }

        if (nextState.channelId !== this.state.channelId) {
            return true;
        }

        return false;
    }
    render() {
        return (
            <div
                id='app-content'
                className='app__content'
            >
                <FileUploadOverlay overlayType='center'/>
                <ChannelHeader
                    channelId={this.state.channelId}
                />
                <PostsViewContainer/>
                <div
                    className='post-create__container'
                    id='post-create'
                >
                    <CreatePost/>
                </div>
            </div>
        );
    }
}
ChannelView.defaultProps = {
};

ChannelView.propTypes = {
    params: React.PropTypes.object.isRequired
};
